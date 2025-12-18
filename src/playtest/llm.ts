import {
  type ActorContext,
  type CampaignState,
  type GameCommand,
  type GameEvent,
  GameRuleError,
  type PlayerChecks,
  type PlayerState,
  asUserId,
  createSeededRng,
  decide,
  reduceEvents,
} from '../core';

import { createLLM } from '../llm';

import {
  type AgentCommand,
  actionKeyOf,
  planTurnWithLlm,
  toGameCommand,
} from './llmAgent';
import { getScenario, listScenarioNames } from './scenarios';

type CliArgs = {
  rounds: number;
  seed: number;
  scenario: string;
  players: number | null;
  model: string | null;
  out: string | null;
  mdOut: string | null;
  json: boolean;
  pretty: boolean;
  listScenarios: boolean;
  help: boolean;
};

type PlayerProfile = {
  userId: string;
  playerId: string;
  displayName: string;
  checks: PlayerChecks;
  systemPreamble?: string;
  lastPublicLogIndex: number;
};

type StepLog = {
  round: number;
  playerId: string;
  playerName: string;
  kind: 'facility' | 'action';
  command: AgentCommand;
  ok: boolean;
  error?: { message: string; code?: string };
  outcome?: { actionKey: string; tier: string };
};

type LlmPlayReport = {
  generatedAt: string;
  config: Pick<CliArgs, 'rounds' | 'seed' | 'scenario' | 'players' | 'model'>;
  players: Array<Pick<PlayerProfile, 'userId' | 'playerId' | 'displayName'>>;
  steps: StepLog[];
  final: {
    round: number;
    phase: string;
    byPlayer: Array<{
      playerId: string;
      displayName: string;
      gold: number;
      rawTotal: number;
      specialTotal: number;
      holdings: {
        domains: Array<{ id: string; tier: string }>;
        cityProperties: Array<{ id: string; tier: string; mode: string }>;
        offices: Array<{ id: string; tier: string; yieldMode: string }>;
        organizations: Array<{ id: string; kind: string; tier: string }>;
        tradeEnterprises: Array<{ id: string; tier: string; mode: string }>;
        workshops: Array<{ id: string; tier: string }>;
        storages: Array<{ id: string; tier: string }>;
      };
    }>;
  };
};

function usage(): string {
  return [
    'LLM Runner (Myranor Aufbausystem, v1)',
    '',
    'Usage:',
    '  bun src/playtest/llm.ts [options]',
    '',
    'Options:',
    '  --rounds <n>        Runden spielen (default: 10)',
    '  --seed <n>          RNG-Seed für Engine (default: 1)',
    '  --scenario <name>   Szenario-Name (default: core-v1-all5)',
    '  --players <n>       Statt Szenario: N generische Spieler (Checks +5)',
    '  --model <id>        Model-ID überschreiben (default via MYRANOR_ANTHROPIC_MODEL)',
    '  --out <file>        Report als JSON schreiben',
    '  --md-out <file>     Report als Markdown schreiben',
    '  --json              Report als JSON nach stdout',
    '  --pretty            JSON pretty-print (Indent=2)',
    '  --list-scenarios    Szenarien auflisten',
    '  --help              Hilfe anzeigen',
    '',
    'Env:',
    '  ANTHROPIC_API_KEY              (required)',
    '  MYRANOR_ANTHROPIC_MODEL        (default: claude-opus-4-5)',
    '',
    'Example:',
    '  bun src/playtest/llm.ts --rounds 20 --seed 42 --scenario core-v1-strategies --out llm-run.json --pretty',
  ].join('\n');
}

function parseIntArg(value: string | undefined, name: string): number {
  if (!value) throw new Error(`Missing value for ${name}`);
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${name}: ${value}`);
  return parsed;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    rounds: 10,
    seed: 1,
    scenario: 'core-v1-all5',
    players: null,
    model: null,
    out: null,
    mdOut: null,
    json: false,
    pretty: false,
    listScenarios: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;

    const [flag, inline] =
      token.startsWith('--') && token.includes('=')
        ? token.split('=', 2)
        : [token, undefined];

    switch (flag) {
      case '--rounds':
        args.rounds = parseIntArg(inline ?? argv[++i], '--rounds');
        break;
      case '--seed':
        args.seed = parseIntArg(inline ?? argv[++i], '--seed');
        break;
      case '--scenario':
        args.scenario = inline ?? argv[++i] ?? args.scenario;
        break;
      case '--players':
        args.players = parseIntArg(inline ?? argv[++i], '--players');
        break;
      case '--model':
        args.model = inline ?? argv[++i] ?? null;
        break;
      case '--out':
        args.out = inline ?? argv[++i] ?? null;
        break;
      case '--md-out':
        args.mdOut = inline ?? argv[++i] ?? null;
        break;
      case '--json':
        args.json = true;
        break;
      case '--pretty':
        args.pretty = true;
        break;
      case '--list-scenarios':
        args.listScenarios = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        if (flag.startsWith('--')) throw new Error(`Unknown flag: ${flag}`);
        break;
    }
  }

  return args;
}

function execute(
  state: CampaignState | null,
  command: GameCommand,
  actor: ActorContext,
  rng: ReturnType<typeof createSeededRng>
): { state: CampaignState | null; events: GameEvent[]; error: Error | null } {
  try {
    const events = decide(state, command, { actor, rng });
    const next = reduceEvents(state, events);
    return { state: next, events, error: null };
  } catch (error) {
    return {
      state,
      events: [],
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

function getPlayerByUserId(state: CampaignState, userId: string) {
  const playerId = state.playerIdByUserId[asUserId(userId)];
  return state.players[playerId];
}

function sumStock(stock: Record<string, number>): number {
  let sum = 0;
  for (const v of Object.values(stock)) sum += v;
  return sum;
}

function canonicalActionKey(actionKey: string): string {
  const idx = actionKey.indexOf('@');
  return idx === -1 ? actionKey : actionKey.slice(0, idx);
}

function hasUsedCanonicalAction(me: PlayerState, canonical: string): boolean {
  return me.turn.actionKeysUsed.some(
    (k) => canonicalActionKey(k) === canonical
  );
}

function hasUsedMarker(me: PlayerState, marker: string): boolean {
  const needle = `@${marker}`;
  return me.turn.actionKeysUsed.some((k) => k.includes(needle));
}

function bonusInfluenceSlots(me: PlayerState): number {
  const largeOffices = me.holdings.offices.filter(
    (o) => o.tier === 'large'
  ).length;
  const hasLargeCult = me.holdings.organizations.some(
    (o) => o.kind === 'cult' && o.tier === 'large' && !o.followers.inUnrest
  );
  return largeOffices + (hasLargeCult ? 1 : 0);
}

function bonusMoneySlots(me: PlayerState): number {
  const hasLargeTradeCollegium = me.holdings.organizations.some(
    (o) =>
      o.kind === 'collegiumTrade' && o.tier === 'large' && !o.followers.inUnrest
  );
  return hasLargeTradeCollegium ? 1 : 0;
}

function bonusMaterialsSlots(me: PlayerState): number {
  const hasLargeCraftCollegium = me.holdings.organizations.some(
    (o) =>
      o.kind === 'collegiumCraft' && o.tier === 'large' && !o.followers.inUnrest
  );
  return hasLargeCraftCollegium ? 1 : 0;
}

function hasRemainingInfluenceBonus(me: PlayerState): boolean {
  const slots = bonusInfluenceSlots(me);
  for (let i = 1; i <= slots; i += 1) {
    const canonical = `influence.bonus.${i}`;
    if (!hasUsedCanonicalAction(me, canonical)) return true;
  }
  return false;
}

function hasAnyActionCapacity(
  me: PlayerState,
  actionsPerRound: number
): boolean {
  if (me.turn.actionsUsed < actionsPerRound) return true;
  if (bonusMoneySlots(me) > 0 && !hasUsedMarker(me, 'bonus.money.1'))
    return true;
  if (bonusMaterialsSlots(me) > 0 && !hasUsedMarker(me, 'bonus.materials.1'))
    return true;
  if (hasRemainingInfluenceBonus(me)) return true;
  return false;
}

function extractOutcome(
  events: GameEvent[]
): { actionKey: string; tier: string } | null {
  for (const e of events) {
    switch (e.type) {
      case 'PlayerMaterialsGained':
        return { actionKey: e.actionKey, tier: e.tier };
      case 'PlayerInfluenceGained':
        return { actionKey: e.actionKey, tier: e.tier };
      case 'PlayerMoneyLent':
        return { actionKey: e.actionKey, tier: e.tier };
      case 'PlayerMoneySold':
        return { actionKey: e.actionKey, tier: e.tier };
      case 'PlayerMoneyBought':
        return { actionKey: e.actionKey, tier: e.tier };
      case 'PlayerDomainAcquired':
      case 'PlayerCityPropertyAcquired':
      case 'PlayerOfficeAcquired':
      case 'PlayerOrganizationAcquired':
      case 'PlayerTradeEnterpriseAcquired':
      case 'PlayerTenantsAcquired':
      case 'PlayerTroopsRecruited':
        return { actionKey: e.actionKey, tier: e.tierResult };
      default:
        break;
    }
  }
  return null;
}

function formatMarkdown(report: LlmPlayReport): string {
  const lines: string[] = [];
  lines.push(`# LLM-Play Report — ${report.config.scenario}`);
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(
    `Config: rounds=${report.config.rounds}, seed=${report.config.seed}, model=${report.config.model ?? '(default)'}`
  );
  lines.push('');

  lines.push('## Final');
  for (const p of report.final.byPlayer) {
    lines.push(
      `- ${p.displayName}: gold=${p.gold} raw=${p.rawTotal} special=${p.specialTotal}`
    );
  }
  lines.push('');

  lines.push('## Steps (gekürzt)');
  for (const step of report.steps.slice(-60)) {
    const outcome = step.outcome
      ? ` → ${step.outcome.actionKey}/${step.outcome.tier}`
      : '';
    const ok = step.ok ? 'OK' : `ERR(${step.error?.code ?? ''})`;
    lines.push(
      `- R${step.round} ${step.playerName} ${step.kind}: ${step.command.type} ${ok}${outcome}`
    );
  }
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(usage());
    process.exitCode = 0;
    return;
  }

  if (args.listScenarios) {
    for (const name of listScenarioNames()) console.log(name);
    return;
  }

  const scenario = args.players ? null : getScenario(args.scenario);
  if (!args.players && !scenario) {
    throw new Error(
      `Unknown scenario "${args.scenario}". Available: ${listScenarioNames().join(', ')}`
    );
  }

  const model = createLLM();
  const rng = createSeededRng(args.seed);
  const campaignId = `llm-${args.seed}`;
  const gm: ActorContext = { role: 'gm', userId: 'gm' };

  const profiles: PlayerProfile[] = args.players
    ? Array.from({ length: args.players }, (_, i) => ({
        userId: `u-${i + 1}`,
        playerId: `p-${i + 1}`,
        displayName: `Spieler ${i + 1}`,
        checks: { influence: 5, money: 5, materials: 5 },
        systemPreamble: undefined,
        lastPublicLogIndex: 0,
      }))
    : scenario!.players.map((p) => ({
        userId: p.userId,
        playerId: p.playerId,
        displayName: p.displayName,
        checks: p.checks,
        systemPreamble: p.llmPreamble,
        lastPublicLogIndex: 0,
      }));

  const publicLog: string[] = [];
  const steps: StepLog[] = [];

  let state: CampaignState | null = null;
  ({ state } = execute(
    state,
    { type: 'CreateCampaign', campaignId, name: args.scenario },
    gm,
    rng
  ));
  if (!state) throw new Error('Campaign create failed');

  for (const p of profiles) {
    const res = execute(
      state,
      {
        type: 'JoinCampaign',
        campaignId,
        playerId: p.playerId,
        displayName: p.displayName,
        checks: p.checks,
      },
      { role: 'player', userId: p.userId },
      rng
    );
    state = res.state;
    if (!state) throw new Error('Join failed');
    for (const e of res.events) {
      if (e.type === 'PublicLogEntryAdded') publicLog.push(e.message);
    }
  }

  for (let round = 1; round <= args.rounds; round += 1) {
    if (!state) break;
    if (state.phase !== 'maintenance')
      throw new Error(
        `Expected maintenance at round ${round}, got ${state.phase}`
      );

    // maintenance -> actions
    {
      const res = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng);
      state = res.state;
      for (const e of res.events) {
        if (e.type === 'PublicLogEntryAdded') publicLog.push(e.message);
      }
    }
    if (!state) break;

    for (const profile of profiles) {
      if (!state) break;
      const actor: ActorContext = { role: 'player', userId: profile.userId };

      const me = getPlayerByUserId(state, profile.userId);
      const newPublicLog = publicLog.slice(profile.lastPublicLogIndex);
      profile.lastPublicLogIndex = publicLog.length;

      const plan = await planTurnWithLlm({
        model,
        agentName: profile.displayName,
        me,
        round: state.round,
        publicLog: newPublicLog,
        systemPreamble: profile.systemPreamble,
        market: state.market,
      });

      if (plan.facility) {
        const cmd = toGameCommand(plan.facility, campaignId);
        const res = execute(state, cmd, actor, rng);
        state = res.state;
        const outcome = extractOutcome(res.events);
        steps.push({
          round,
          playerId: profile.playerId,
          playerName: profile.displayName,
          kind: 'facility',
          command: cmd,
          ok: !res.error,
          error: res.error
            ? {
                message: res.error.message,
                code:
                  res.error instanceof GameRuleError
                    ? res.error.code
                    : undefined,
              }
            : undefined,
          outcome: outcome ?? undefined,
        });
      }

      const actionsPerRound = state.rules.actionsPerRound;
      const maxSlotsThisRound =
        actionsPerRound +
        bonusInfluenceSlots(me) +
        bonusMoneySlots(me) +
        bonusMaterialsSlots(me);
      for (let slot = 0; slot < maxSlotsThisRound; slot += 1) {
        if (!state) break;
        const meNow = getPlayerByUserId(state, profile.userId);
        if (!hasAnyActionCapacity(meNow, actionsPerRound)) break;

        let executed = false;
        for (const candidate of plan.actionPriority) {
          const key = actionKeyOf(candidate);
          if (key) {
            const used = hasUsedCanonicalAction(meNow, key);
            if (used) {
              const canRepeatInfluence =
                key === 'influence' && hasRemainingInfluenceBonus(meNow);
              if (!canRepeatInfluence) continue;
            }
          }

          const cmd = toGameCommand(candidate, campaignId);
          const res = execute(state, cmd, actor, rng);
          state = res.state;

          if (res.error) {
            steps.push({
              round,
              playerId: profile.playerId,
              playerName: profile.displayName,
              kind: 'action',
              command: cmd,
              ok: false,
              error: {
                message: res.error.message,
                code:
                  res.error instanceof GameRuleError
                    ? res.error.code
                    : undefined,
              },
            });
            continue;
          }

          const outcome = extractOutcome(res.events);
          steps.push({
            round,
            playerId: profile.playerId,
            playerName: profile.displayName,
            kind: 'action',
            command: cmd,
            ok: true,
            outcome: outcome ?? undefined,
          });
          executed = true;
          break;
        }

        if (!executed) break;
      }
    }

    // actions -> conversion
    ({ state } = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng));
    if (!state) break;

    // conversion -> reset
    ({ state } = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng));
    if (!state) break;

    // reset -> maintenance
    ({ state } = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng));
  }

  if (!state) throw new Error('Simulation ended without state');

  const report: LlmPlayReport = {
    generatedAt: new Date().toISOString(),
    config: {
      rounds: args.rounds,
      seed: args.seed,
      scenario: args.scenario,
      players: args.players,
      model: args.model,
    },
    players: profiles.map((p) => ({
      userId: p.userId,
      playerId: p.playerId,
      displayName: p.displayName,
    })),
    steps,
    final: {
      round: state.round,
      phase: state.phase,
      byPlayer: profiles.map((p) => {
        const me = getPlayerByUserId(state!, p.userId);
        return {
          playerId: p.playerId,
          displayName: p.displayName,
          gold: me.economy.gold,
          rawTotal: sumStock(me.economy.inventory.raw),
          specialTotal: sumStock(me.economy.inventory.special),
          holdings: {
            domains: me.holdings.domains.map((d) => ({
              id: d.id,
              tier: d.tier,
            })),
            cityProperties: me.holdings.cityProperties.map((c) => ({
              id: c.id,
              tier: c.tier,
              mode: c.mode,
            })),
            offices: me.holdings.offices.map((o) => ({
              id: o.id,
              tier: o.tier,
              yieldMode: o.yieldMode,
            })),
            organizations: me.holdings.organizations.map((o) => ({
              id: o.id,
              kind: o.kind,
              tier: o.tier,
            })),
            tradeEnterprises: me.holdings.tradeEnterprises.map((t) => ({
              id: t.id,
              tier: t.tier,
              mode: t.mode,
            })),
            workshops: me.holdings.workshops.map((w) => ({
              id: w.id,
              tier: w.tier,
            })),
            storages: me.holdings.storages.map((s) => ({
              id: s.id,
              tier: s.tier,
            })),
          },
        };
      }),
    },
  };

  if (args.out) {
    const json = JSON.stringify(report, null, args.pretty ? 2 : 0);
    await Bun.write(args.out, json);
  }

  if (args.mdOut) {
    await Bun.write(args.mdOut, formatMarkdown(report));
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, args.pretty ? 2 : 0));
    return;
  }

  console.log(formatMarkdown(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.log('');
  console.log(usage());
  process.exitCode = 1;
});
