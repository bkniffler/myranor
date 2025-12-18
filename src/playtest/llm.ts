import {
  type ActorContext,
  type CampaignState,
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
import { llmEnv } from '../llm/env';

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
  config: Pick<
    CliArgs,
    'rounds' | 'seed' | 'scenario' | 'players' | 'model'
  > & {
    // modelUsed: string;
    temperature: number;
    maxOutputTokens: number;
  };
  players: Array<Pick<PlayerProfile, 'userId' | 'playerId' | 'displayName'>>;
  steps: StepLog[];
  final: {
    round: number;
    phase: string;
    byPlayer: Array<{
      playerId: string;
      displayName: string;
      gold: number;
      rawMaterials: number;
      specialMaterials: number;
      officesGold: number;
      infrastructure: PlayerState['infrastructure'];
    }>;
  };
};

function usage(): string {
  return [
    'LLM Runner (Myranor Aufbausystem, v0)',
    '',
    'Usage:',
    '  bun src/playtest/llm.ts [options]',
    '',
    'Options:',
    '  --rounds <n>        Runden spielen (default: 10)',
    '  --seed <n>          RNG-Seed für Engine (default: 1)',
    '  --scenario <name>   Szenario-Name (default: core-v0-all5)',
    '  --players <n>       Statt Szenario: N generische Spieler (Checks +5)',
    '  --model <id>        Model-ID überschreiben (default via MYRANOR_ANTHROPIC_MODEL)',
    '  --out <file>        Report als JSON schreiben',
    '  --json              Report als JSON nach stdout',
    '  --pretty            JSON pretty-print (Indent=2)',
    '  --list-scenarios    Szenarien auflisten',
    '  --help              Hilfe anzeigen',
    '',
    'Env:',
    '  ANTHROPIC_API_KEY              (required)',
    '  MYRANOR_ANTHROPIC_MODEL        (default: claude-opus-4-5)',
    '  MYRANOR_LLM_TEMPERATURE        (default: 0.2)',
    '  MYRANOR_LLM_MAX_OUTPUT_TOKENS  (default: 400)',
    '',
    'Example:',
    '  bun src/playtest/llm.ts --rounds 20 --seed 42 --scenario core-v0-all5 --out llm-run.json --pretty',
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
    scenario: 'core-v0-all5',
    players: null,
    model: null,
    out: null,
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

function capturePublicLog(events: GameEvent[], sink: string[]): void {
  for (const event of events) {
    if (event.type === 'PublicLogEntryAdded') {
      sink.push(event.message);
    }
  }
}

function execute(
  state: CampaignState | null,
  command: Parameters<typeof decide>[1],
  actor: ActorContext,
  rng: ReturnType<typeof createSeededRng>
): { state: CampaignState | null; events: GameEvent[]; error: Error | null } {
  try {
    const events = decide(state, command as any, { actor, rng });
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

function extractOutcome(
  events: GameEvent[]
): { actionKey: string; tier: string } | null {
  for (const event of events) {
    switch (event.type) {
      case 'PlayerGatherMaterialsResolved':
      case 'PlayerGainInfluenceResolved':
      case 'PlayerLendMoneyResolved':
      case 'PlayerSellMaterialsResolved':
      case 'PlayerOfficeAcquired':
        return { actionKey: event.actionKey, tier: event.tier };
      default:
        break;
    }
  }
  return null;
}

function defaultChecks() {
  return { influence: 5, money: 5, materials: 5 };
}

function buildProfiles(args: CliArgs): PlayerProfile[] {
  if (args.players && args.players > 0) {
    return Array.from({ length: args.players }, (_, i) => {
      const n = i + 1;
      return {
        userId: `u-llm-${n}`,
        playerId: `p-llm-${n}`,
        displayName: `LLM ${n}`,
        checks: defaultChecks(),
        systemPreamble: `Du spielst als Spieler ${n}.`,
        lastPublicLogIndex: 0,
      };
    });
  }

  const scenario = getScenario(args.scenario);
  if (!scenario) {
    throw new Error(
      `Unknown scenario "${args.scenario}". Available: ${listScenarioNames().join(', ')}`
    );
  }

  return scenario.players.map((p) => ({
    userId: p.userId,
    playerId: p.playerId,
    displayName: p.displayName,
    checks: p.checks,
    systemPreamble: `Du spielst als ${p.displayName}.`,
    lastPublicLogIndex: 0,
  }));
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

  const players = buildProfiles(args);
  const rng = createSeededRng(args.seed);
  const model = createLLM(args.model ?? undefined);

  const startedAt = Date.now();
  const progress = (message: string) => {
    console.error(message);
  };

  const campaignId = `llm-${args.seed}-${Date.now()}`;
  const gm: ActorContext = { role: 'gm', userId: 'gm' };

  let state: CampaignState | null = null;
  const publicLog: string[] = [];
  const steps: StepLog[] = [];

  progress(
    `LLM-Run start: scenario=${args.scenario}, rounds=${args.rounds}, players=${players.length}, seed=${args.seed}, model=${args.model ?? llmEnv.MYRANOR_ANTHROPIC_MODEL}`
  );

  // Create campaign
  {
    const res = execute(
      state,
      { type: 'CreateCampaign', campaignId, name: args.scenario },
      gm,
      rng
    );
    state = res.state;
    capturePublicLog(res.events, publicLog);
    if (!state) throw new Error('Campaign create failed');
  }

  // Join players
  for (const profile of players) {
    const res = execute(
      state,
      {
        type: 'JoinCampaign',
        campaignId,
        playerId: profile.playerId,
        displayName: profile.displayName,
        checks: profile.checks,
      },
      { role: 'player', userId: profile.userId },
      rng
    );
    state = res.state;
    capturePublicLog(res.events, publicLog);
    if (!state) throw new Error('Join failed');
  }

  progress(
    `Campaign ready: id=${campaignId}, players=${players.map((p) => p.displayName).join(', ')}`
  );

  let llmCallCount = 0;
  const totalLlmCalls = args.rounds * players.length;

  for (let round = 1; round <= args.rounds; round += 1) {
    if (!state) break;
    if (state.phase !== 'maintenance') {
      throw new Error(
        `Expected maintenance at round ${round}, got ${state.phase}`
      );
    }

    progress(`\n[R${state.round}] maintenance → actions`);

    // maintenance -> actions
    {
      const res = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng);
      state = res.state;
      capturePublicLog(res.events, publicLog);
    }
    if (!state) break;

    // players act (actions phase)
    for (const profile of players) {
      if (!state) break;

      const actor: ActorContext = { role: 'player', userId: profile.userId };
      const me = getPlayerByUserId(state, profile.userId);
      const newPublicLog = publicLog.slice(profile.lastPublicLogIndex);
      profile.lastPublicLogIndex = publicLog.length;

      if (state.phase !== 'actions') {
        throw new Error(
          `Expected actions phase while players act, got ${state.phase}`
        );
      }

      llmCallCount += 1;
      const llmStartedAt = Date.now();
      progress(
        `[R${state.round}] ${profile.displayName}: LLM decision (${llmCallCount}/${totalLlmCalls})…`
      );

      const plan = await planTurnWithLlm({
        model,
        agentName: profile.displayName,
        me,
        round: state.round,
        publicLog: newPublicLog,
        systemPreamble: profile.systemPreamble,
      });

      progress(
        `[R${state.round}] ${profile.displayName}: plan ready in ${Date.now() - llmStartedAt}ms${plan.note ? ` (${plan.note})` : ''}`
      );

      if (plan.facility) {
        const cmd = toGameCommand(plan.facility, campaignId);
        const res = execute(state, cmd as any, actor, rng);
        state = res.state;
        capturePublicLog(res.events, publicLog);

        const facilityLabel =
          plan.facility.type === 'BuildFacility'
            ? plan.facility.facility
            : plan.facility.type;
        progress(
          `[R${state?.round ?? round}] ${profile.displayName}: facility ${facilityLabel} ${res.error ? `ERROR: ${res.error.message}` : 'OK'}`
        );

        steps.push({
          round: state?.round ?? round,
          playerId: profile.playerId,
          playerName: profile.displayName,
          kind: 'facility',
          command: plan.facility,
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
        });
      }

      for (let actionSlot = 0; actionSlot < 2; actionSlot += 1) {
        if (!state) break;
        const meNow = getPlayerByUserId(state, profile.userId);
        if (meNow.turn.actionsUsed >= 2) break;

        let executed = false;
        for (const planned of plan.actionPriority) {
          if (!state) break;

          const actionKey = actionKeyOf(planned);
          if (actionKey && meNow.turn.actionKeysUsed.includes(actionKey))
            continue;

          const cmd = toGameCommand(planned, campaignId);
          const res = execute(state, cmd as any, actor, rng);
          state = res.state;
          capturePublicLog(res.events, publicLog);

          const outcome = res.error ? null : extractOutcome(res.events);
          progress(
            `[R${state?.round ?? round}] ${profile.displayName}: action ${planned.type}${actionKey ? ` (${actionKey})` : ''} ${res.error ? `ERROR: ${res.error.message}` : outcome ? `OK: ${outcome.tier}` : 'OK'}`
          );

          steps.push({
            round: state?.round ?? round,
            playerId: profile.playerId,
            playerName: profile.displayName,
            kind: 'action',
            command: planned,
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
            outcome: res.error ? undefined : (outcome ?? undefined),
          });

          if (res.error) continue;
          executed = true;
          break;
        }

        if (!executed) break;
      }
    }

    progress(`[R${state.round}] actions → conversion`);
    // actions -> conversion
    {
      const res = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng);
      state = res.state;
      capturePublicLog(res.events, publicLog);
    }
    if (!state) break;

    progress(`[R${state.round}] conversion → reset`);
    // conversion -> reset
    {
      const res = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng);
      state = res.state;
      capturePublicLog(res.events, publicLog);
    }
    if (!state) break;

    progress(`[R${state.round}] reset → maintenance`);
    // reset -> maintenance (round increments)
    {
      const res = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng);
      state = res.state;
      capturePublicLog(res.events, publicLog);
    }
  }

  if (!state) throw new Error('Game ended unexpectedly (no state).');

  const byPlayer = players.map((p) => {
    const me = getPlayerByUserId(state, p.userId);
    return {
      playerId: p.playerId,
      displayName: p.displayName,
      gold: me.economy.gold,
      rawMaterials: me.economy.rawMaterials,
      specialMaterials: me.economy.specialMaterials,
      officesGold: me.holdings.officesGold,
      infrastructure: me.infrastructure,
    };
  });

  const report: LlmPlayReport = {
    generatedAt: new Date().toISOString(),
    config: {
      rounds: args.rounds,
      seed: args.seed,
      scenario: args.scenario,
      players: args.players,
      model: args.model,
      temperature: llmEnv.MYRANOR_LLM_TEMPERATURE,
      maxOutputTokens: llmEnv.MYRANOR_LLM_MAX_OUTPUT_TOKENS,
    },
    players: players.map((p) => ({
      userId: p.userId,
      playerId: p.playerId,
      displayName: p.displayName,
    })),
    steps,
    final: {
      round: state.round,
      phase: state.phase,
      byPlayer: byPlayer.sort((a, b) => b.gold - a.gold),
    },
  };

  if (args.out) {
    const json = JSON.stringify(report, null, args.pretty ? 2 : 0);
    await Bun.write(args.out, json);
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, args.pretty ? 2 : 0));
    return;
  }

  console.log(
    `LLM-Run "${args.scenario}" — ${args.rounds} Runden, Seed ${args.seed}`
  );
  for (const p of report.final.byPlayer) {
    console.log(
      `- ${p.displayName}: gold=${p.gold}, offices=${p.officesGold}, rm=${p.rawMaterials}, sm=${p.specialMaterials}, domain=${p.infrastructure.domainTier}, storage=${p.infrastructure.storageTier}`
    );
  }

  progress(`\nDone in ${Date.now() - startedAt}ms`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.log('');
  console.log(usage());
  process.exitCode = 1;
});
