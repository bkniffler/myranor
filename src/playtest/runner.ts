import {
  decide,
  reduceEvents,
  type ActorContext,
  type CampaignState,
  type GameCommand,
  type GameEvent,
  GameRuleError,
  asUserId,
  createSeededRng,
  type MaterialTier,
  type SuccessTier,
} from '../core';

import type { AgentId, PlaytestConfig, PlayerProfile } from './types';
import { gini, mean, median, percentile } from './stats';
import { tierProbabilities } from './probabilities';
import { computeCampaignEventModifiers } from '../core/rules/events_v0';

type AgentAggregate = {
  samples: number;
  wins: number;
  finalGold: number[];
  finalOfficesGold: number[];
  firstOfficeRound: number[];
  firstDomainUpgradeRound: number[];
  firstStorageBuiltRound: number[];
  roundGoldSum: number[];
  roundGoldCount: number[];
  actionCount: Record<string, number>;
  actionTierCount: Record<string, Record<SuccessTier, number>>;
  errors: Record<string, number>;
  facilities: Record<string, number>;
  idleActions: number;
  sellSamples: number;
  sellByResource: Record<'raw' | 'special', number>;
  sellGoldPerInvestment: number[];
  sellMarketModifierPerInvestment: number[];
  conversionSamples: number;
  conversionGoldSum: number;
  conversionRawStoredSum: number;
  conversionSpecialStoredSum: number;
  conversionRawLostSum: number;
};

export type PlaytestReport = {
  generatedAt: string;
  config: PlaytestConfig;
  scenario: {
    name: string;
    players: Array<{
      agentId: AgentId;
      displayName: string;
      checks: PlayerProfile['checks'];
    }>;
  };
  outcomes: {
    giniGold: { mean: number; p50: number; p90: number };
    byAgent: Record<
      AgentId,
      {
        samples: number;
        wins: number;
        winRate: number;
        finalGold: { mean: number; p50: number; p10: number; p90: number };
        finalOfficesGold: { mean: number; p50: number };
        milestones: {
          firstOfficeRound: { mean: number; p50: number; neverRate: number };
          firstDomainUpgradeRound: { mean: number; p50: number; neverRate: number };
          firstStorageBuiltRound: { mean: number; p50: number; neverRate: number };
        };
        idleActionRate: number;
        meanGoldByRound: number[];
        sell: {
          samples: number;
          byResource: Record<'raw' | 'special', number>;
          goldPerInvestment: { mean: number; p50: number; p10: number; p90: number };
          marketModifierPerInvestment: { mean: number; p50: number; p10: number; p90: number };
        };
        conversion: {
          samples: number;
          goldFromConversionMean: number;
          rawStoredMean: number;
          specialStoredMean: number;
          rawLostMean: number;
        };
        actions: Record<
          string,
          {
            count: number;
            tiers: Record<SuccessTier, number>;
          }
        >;
        facilities: Record<string, number>;
        errors: Record<string, number>;
      }
    >;
  };
  checkMath: {
    examples: Array<{
      name: string;
      dc: number;
      modifier: number;
      probs: Record<SuccessTier, number>;
    }>;
  };
  systems: {
    market: {
      raw: {
        samples: number;
        byRoll: Record<string, number>;
        byCategory: Record<string, number>;
        byDemand: Record<string, number>;
        modifiers: Record<MaterialTier, { mean: number; p50: number; p10: number; p90: number }>;
      };
      special: {
        samples: number;
        byRoll: Record<string, number>;
        byCategory: Record<string, number>;
        byDemand: Record<string, number>;
        modifiers: Record<MaterialTier, { mean: number; p50: number; p10: number; p90: number }>;
      };
    };
    events: {
      sections: number;
      events: number;
      byRoll: Record<string, number>;
      byName: Record<string, number>;
      modifiers: {
        taxGoldPerRound: { mean: number; p90: number; nonZeroRate: number };
        oneTimeGoldTaxPerOffice: { mean: number; p90: number; nonZeroRate: number };
        officeGoldIncomeMultiplier: { mean: number; p10: number; p50: number };
        officeGoldIncomeBonusPerOffice: { mean: number; p90: number; nonZeroRate: number };
        lendMoneyDcBonus: { mean: number; p90: number; nonZeroRate: number };
        sellMaterialsDcBonus: { mean: number; p90: number; nonZeroRate: number };
        influenceActionDcBonus: { mean: number; p10: number; p50: number };
        workshopUpkeepLaborBonusFlat: { mean: number; p90: number; nonZeroRate: number };
        workshopUpkeepGoldBonusFlat: { mean: number; p90: number; nonZeroRate: number };
        workshopUpkeepGoldBonusPerTier: { mean: number; p90: number; nonZeroRate: number };
        rawAutoConvertDivisor: { mean: number; p10: number; p50: number };
        lendMoneyPayoutMultiplier: { mean: number; p10: number; p50: number };
        moneyBonusGoldPerTwoInvestments: { mean: number; p90: number; nonZeroRate: number };
      };
    };
  };
};

function emptyTierCounts(): Record<SuccessTier, number> {
  return { veryGood: 0, good: 0, success: 0, poor: 0, fail: 0 };
}

function summary(values: number[]): { mean: number; p50: number; p10: number; p90: number } {
  return {
    mean: mean(values),
    p50: median(values),
    p10: percentile(values, 0.1),
    p90: percentile(values, 0.9),
  };
}

function nonZeroRate(values: number[]): number {
  if (values.length === 0) return 0;
  return values.filter((v) => v !== 0).length / values.length;
}

function ensureAgg(aggs: Record<string, AgentAggregate>, id: AgentId, rounds: number): AgentAggregate {
  const existing = aggs[id];
  if (existing) return existing;
  const agg: AgentAggregate = {
    samples: 0,
    wins: 0,
    finalGold: [],
    finalOfficesGold: [],
    firstOfficeRound: [],
    firstDomainUpgradeRound: [],
    firstStorageBuiltRound: [],
    roundGoldSum: Array.from({ length: rounds }, () => 0),
    roundGoldCount: Array.from({ length: rounds }, () => 0),
    actionCount: {},
    actionTierCount: {},
    errors: {},
    facilities: {},
    idleActions: 0,
    sellSamples: 0,
    sellByResource: { raw: 0, special: 0 },
    sellGoldPerInvestment: [],
    sellMarketModifierPerInvestment: [],
    conversionSamples: 0,
    conversionGoldSum: 0,
    conversionRawStoredSum: 0,
    conversionSpecialStoredSum: 0,
    conversionRawLostSum: 0,
  };
  aggs[id] = agg;
  return agg;
}

function bump(obj: Record<string, number>, key: string, by = 1): void {
  obj[key] = (obj[key] ?? 0) + by;
}

function neverAwareRoundSummary(values: number[]): { mean: number; p50: number; neverRate: number } {
  if (values.length === 0) return { mean: 0, p50: 0, neverRate: 0 };
  const never = values.filter((v) => v <= 0).length;
  const nonZero = values.filter((v) => v > 0);
  return {
    mean: mean(nonZero),
    p50: median(nonZero),
    neverRate: values.length > 0 ? never / values.length : 0,
  };
}

function recordAction(
  agg: AgentAggregate,
  actionKey: string,
  tier: SuccessTier,
): void {
  bump(agg.actionCount, actionKey, 1);
  agg.actionTierCount[actionKey] ??= emptyTierCounts();
  agg.actionTierCount[actionKey][tier] += 1;
}

function patchCampaignId(command: GameCommand, campaignId: string): GameCommand {
  return { ...command, campaignId } as GameCommand;
}

function execute(
  state: CampaignState | null,
  command: GameCommand,
  actor: ActorContext,
  rng: ReturnType<typeof createSeededRng>,
): { state: CampaignState | null; events: GameEvent[]; error: Error | null } {
  try {
    const events = decide(state, command, { actor, rng });
    const next = reduceEvents(state, events);
    return { state: next, events, error: null };
  } catch (error) {
    return { state, events: [], error: error instanceof Error ? error : new Error('Unknown error') };
  }
}

function getPlayerByUserId(state: CampaignState, userId: string) {
  const playerId = state.playerIdByUserId[asUserId(userId)];
  return state.players[playerId];
}

type MarketAgg = {
  samples: number;
  byRoll: Record<string, number>;
  byCategory: Record<string, number>;
  byDemand: Record<string, number>;
  modsByTier: Record<MaterialTier, number[]>;
};

function emptyMarketAgg(): MarketAgg {
  return {
    samples: 0,
    byRoll: {},
    byCategory: {},
    byDemand: {},
    modsByTier: { cheap: [], basic: [], expensive: [] },
  };
}

function recordMarketSide(
  agg: MarketAgg,
  side: {
    tableRollTotal: number;
    categoryLabel: string;
    demandLabel: string;
    modifiers: Record<MaterialTier, number>;
  },
): void {
  agg.samples += 1;
  bump(agg.byRoll, String(side.tableRollTotal), 1);
  bump(agg.byCategory, side.categoryLabel, 1);
  bump(agg.byDemand, side.demandLabel, 1);
  for (const tier of ['cheap', 'basic', 'expensive'] as const) {
    agg.modsByTier[tier].push(side.modifiers[tier]);
  }
}

type EventAgg = {
  sections: number;
  events: number;
  byRoll: Record<string, number>;
  byName: Record<string, number>;
  mods: Record<keyof ReturnType<typeof computeCampaignEventModifiers>, number[]>;
};

function emptyEventAgg(): EventAgg {
  return {
    sections: 0,
    events: 0,
    byRoll: {},
    byName: {},
    mods: {
      taxGoldPerRound: [],
      oneTimeGoldTaxPerOffice: [],
      officeGoldIncomeMultiplier: [],
      officeGoldIncomeBonusPerOffice: [],
      lendMoneyDcBonus: [],
      sellMaterialsDcBonus: [],
      influenceActionDcBonus: [],
      workshopUpkeepLaborBonusFlat: [],
      workshopUpkeepGoldBonusFlat: [],
      workshopUpkeepGoldBonusPerTier: [],
      rawAutoConvertDivisor: [],
      lendMoneyPayoutMultiplier: [],
      moneyBonusGoldPerTwoInvestments: [],
    },
  };
}

function recordSectionEvents(
  agg: EventAgg,
  e: Extract<GameEvent, { type: 'SectionEventsRolled' }>,
): void {
  agg.sections += 1;
  agg.events += e.events.length;
  for (const row of e.events) {
    bump(agg.byRoll, String(row.tableRoll.total), 1);
    bump(agg.byName, row.name, 1);
  }

  const globalEvents = e.events.map((row) => ({
    startsAtRound: e.startsAtRound,
    endsAtRound: e.endsAtRound,
    tableRollTotal: row.tableRoll.total,
    name: row.name,
    effectsText: row.effectsText,
  }));
  const mods = computeCampaignEventModifiers(globalEvents);
  for (const [key, value] of Object.entries(mods) as Array<
    [keyof typeof mods, number]
  >) {
    agg.mods[key].push(value);
  }
}

function recordMarketAndEvents(
  events: GameEvent[],
  marketAgg: { raw: MarketAgg; special: MarketAgg },
  eventAgg: EventAgg,
): void {
  for (const event of events) {
    if (event.type === 'MarketRolled') {
      recordMarketSide(marketAgg.raw, {
        tableRollTotal: event.raw.tableRoll.total,
        categoryLabel: event.raw.categoryLabel,
        demandLabel: event.raw.demandLabel,
        modifiers: event.raw.modifiers,
      });
      recordMarketSide(marketAgg.special, {
        tableRollTotal: event.special.tableRoll.total,
        categoryLabel: event.special.categoryLabel,
        demandLabel: event.special.demandLabel,
        modifiers: event.special.modifiers,
      });
    }
    if (event.type === 'SectionEventsRolled') {
      recordSectionEvents(eventAgg, event);
    }
  }
}

function recordSellAndConversion(
  events: GameEvent[],
  profileByPlayerId: Record<string, PlayerProfile>,
  aggs: Record<string, AgentAggregate>,
  rounds: number,
): void {
  for (const event of events) {
    if (event.type === 'PlayerSellMaterialsResolved') {
      const profile = profileByPlayerId[String(event.playerId)];
      if (!profile) continue;
      const agg = ensureAgg(aggs, profile.agent.id, rounds);
      agg.sellSamples += 1;
      agg.sellByResource[event.resource] += 1;
      agg.sellGoldPerInvestment.push(event.goldGained / event.investments);
      agg.sellMarketModifierPerInvestment.push(event.marketModifierPerInvestment);
      continue;
    }

    if (event.type === 'PlayerMaterialsConverted') {
      const profile = profileByPlayerId[String(event.playerId)];
      if (!profile) continue;
      const agg = ensureAgg(aggs, profile.agent.id, rounds);
      agg.conversionSamples += 1;
      agg.conversionGoldSum += event.goldGained;
      agg.conversionRawStoredSum += event.storage.rawStored;
      agg.conversionSpecialStoredSum += event.storage.specialStored;
      agg.conversionRawLostSum += event.rawLost;
    }
  }
}

function extractOutcome(events: GameEvent[]): { actionKey: string; tier: SuccessTier } | null {
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

function extractFacility(events: GameEvent[]): string | null {
  for (const event of events) {
    if (event.type === 'PlayerFacilityBuilt') return event.facility;
  }
  return null;
}

function extractOfficesGained(events: GameEvent[]): number {
  for (const event of events) {
    if (event.type === 'PlayerOfficeAcquired') return event.officesGoldGained;
  }
  return 0;
}

function expectedActionKey(command: GameCommand): string | null {
  switch (command.type) {
    case 'GatherMaterials':
      return command.mode === 'domain' ? 'material.domain' : 'material.workshop';
    case 'GainInfluence':
      return 'influence';
    case 'LendMoney':
      return 'money.lend';
    case 'SellMaterials':
      return 'money.sell';
    case 'AcquireOffice':
      return 'acquire.office';
    default:
      return null;
  }
}

export function runPlaytest(
  config: PlaytestConfig,
  scenarioName: string,
  players: PlayerProfile[],
): PlaytestReport {
  const aggs: Record<string, AgentAggregate> = {};
  const giniByRun: number[] = [];
  const marketAgg = { raw: emptyMarketAgg(), special: emptyMarketAgg() };
  const eventAgg = emptyEventAgg();
  const profileByPlayerId: Record<string, PlayerProfile> = Object.fromEntries(
    players.map((p) => [p.playerId, p]),
  );

  for (let runIndex = 0; runIndex < config.runs; runIndex += 1) {
    const rng = createSeededRng(config.seed + runIndex);
    const campaignId = `pt-${config.seed}-${runIndex}`;
    const gm: ActorContext = { role: 'gm', userId: 'gm' };

    let state: CampaignState | null = null;
    ({ state } = execute(state, { type: 'CreateCampaign', campaignId, name: scenarioName }, gm, rng));
    if (!state) throw new Error('Campaign create failed');

    for (const player of players) {
      const result = execute(
        state,
        {
          type: 'JoinCampaign',
          campaignId,
          playerId: player.playerId,
          displayName: player.displayName,
          checks: player.checks,
        },
        { role: 'player', userId: player.userId },
        rng,
      );
      state = result.state;
      if (!state) throw new Error('Join failed');
    }

    const firstOfficeRoundByUserId: Record<string, number> = Object.fromEntries(
      players.map((p) => [p.userId, 0]),
    );
    const firstDomainUpgradeRoundByUserId: Record<string, number> = Object.fromEntries(
      players.map((p) => [p.userId, 0]),
    );
    const firstStorageBuiltRoundByUserId: Record<string, number> = Object.fromEntries(
      players.map((p) => [p.userId, 0]),
    );

    for (let round = 1; round <= config.rounds; round += 1) {
      if (!state) break;
      if (state.phase !== 'maintenance') {
        throw new Error(`Expected maintenance at round ${round}, got ${state.phase}`);
      }

      // maintenance -> actions
      {
        const res = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng);
        state = res.state;
        recordMarketAndEvents(res.events, marketAgg, eventAgg);
      }
      if (!state) break;

      // players act
      for (const profile of players) {
        if (!state) break;
        const actor: ActorContext = { role: 'player', userId: profile.userId };
        const me = getPlayerByUserId(state, profile.userId);
        const ctx = { state, round: state.round, me, profile };

        const facility = profile.agent.decideFacility(ctx);
        if (facility) {
          const res = execute(state, patchCampaignId(facility, campaignId), actor, rng);
          state = res.state;
          const built = extractFacility(res.events);
          if (built) {
            const agg = ensureAgg(aggs, profile.agent.id, config.rounds);
            bump(agg.facilities, built, 1);
            if (
              built === 'upgradeStarterDomainToSmall' &&
              firstDomainUpgradeRoundByUserId[profile.userId] === 0
            ) {
              firstDomainUpgradeRoundByUserId[profile.userId] = round;
            }
            if (built === 'buildSmallStorage' && firstStorageBuiltRoundByUserId[profile.userId] === 0) {
              firstStorageBuiltRoundByUserId[profile.userId] = round;
            }
          } else if (res.error) {
            const agg = ensureAgg(aggs, profile.agent.id, config.rounds);
            const key = facility.type === 'BuildFacility' ? facility.facility : facility.type;
            bump(agg.errors, `facility:${key}`, 1);
          }
        }

        for (let actionSlot = 0; actionSlot < 2; actionSlot += 1) {
          if (!state) break;

          const meNow = getPlayerByUserId(state, profile.userId);
          if (!meNow) break;
          if (meNow.turn.actionsUsed >= 2) break;

          const ctxNow = { state, round: state.round, me: meNow, profile };
          const candidates = profile.agent.decideActions(ctxNow);
          const agg = ensureAgg(aggs, profile.agent.id, config.rounds);

          let executed = false;
          for (const planned of candidates) {
            if (!state) break;

            const actionKey = expectedActionKey(planned);
            if (actionKey && meNow.turn.actionKeysUsed.includes(actionKey)) continue;

            const res = execute(state, patchCampaignId(planned, campaignId), actor, rng);
            state = res.state;

            if (res.error) {
              const key =
                res.error instanceof GameRuleError ? `rule:${res.error.code}` : `err:${planned.type}`;
              bump(agg.errors, key, 1);
              continue;
            }

            executed = true;

            const outcome = extractOutcome(res.events);
            if (outcome) recordAction(agg, outcome.actionKey, outcome.tier);
            recordSellAndConversion(res.events, profileByPlayerId, aggs, config.rounds);

            const officesGained = extractOfficesGained(res.events);
            if (officesGained > 0 && firstOfficeRoundByUserId[profile.userId] === 0) {
              firstOfficeRoundByUserId[profile.userId] = round;
            }

            break;
          }

          if (!executed) agg.idleActions += 1;
        }
      }

      // actions -> conversion (automatic conversion happens here)
      {
        const res = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng);
        state = res.state;
        recordSellAndConversion(res.events, profileByPlayerId, aggs, config.rounds);
      }
      if (!state) break;

      // record end-of-round gold (phase=conversion)
      for (const profile of players) {
        const me = getPlayerByUserId(state, profile.userId);
        const agg = ensureAgg(aggs, profile.agent.id, config.rounds);
        agg.roundGoldSum[round - 1] += me.economy.gold;
        agg.roundGoldCount[round - 1] += 1;
      }

      // conversion -> reset
      ({ state } = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng));
      if (!state) break;

      // reset -> maintenance (round increments)
      ({ state } = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng));
    }

    if (!state) continue;
    const finalGolds = players.map((p) => getPlayerByUserId(state, p.userId).economy.gold);
    giniByRun.push(gini(finalGolds));

    const maxGold = Math.max(...finalGolds);
    const winners = players.filter((p) => getPlayerByUserId(state, p.userId).economy.gold === maxGold);
    for (const winner of winners) {
      const agg = ensureAgg(aggs, winner.agent.id, config.rounds);
      agg.wins += 1;
    }

    for (const profile of players) {
      const me = getPlayerByUserId(state, profile.userId);
      const agg = ensureAgg(aggs, profile.agent.id, config.rounds);
      agg.samples += 1;
      agg.finalGold.push(me.economy.gold);
      agg.finalOfficesGold.push(me.holdings.officesGold);
      agg.firstOfficeRound.push(firstOfficeRoundByUserId[profile.userId] ?? 0);
      agg.firstDomainUpgradeRound.push(firstDomainUpgradeRoundByUserId[profile.userId] ?? 0);
      agg.firstStorageBuiltRound.push(firstStorageBuiltRoundByUserId[profile.userId] ?? 0);
    }
  }

  const byAgent = Object.fromEntries(
    Object.entries(aggs).map(([agentId, agg]) => {
      const meanGoldByRound = agg.roundGoldSum.map((sum, i) =>
        agg.roundGoldCount[i] > 0 ? sum / agg.roundGoldCount[i] : 0,
      );

      const actions = Object.fromEntries(
        Object.entries(agg.actionCount).map(([actionKey, count]) => [
          actionKey,
          {
            count,
            tiers: agg.actionTierCount[actionKey] ?? emptyTierCounts(),
          },
        ]),
      );

      const actionSlots = agg.samples * config.rounds * 2;

      return [
        agentId,
        {
          samples: agg.samples,
          wins: agg.wins,
          winRate: agg.samples > 0 ? agg.wins / agg.samples : 0,
          finalGold: {
            mean: mean(agg.finalGold),
            p50: median(agg.finalGold),
            p10: percentile(agg.finalGold, 0.1),
            p90: percentile(agg.finalGold, 0.9),
          },
          finalOfficesGold: {
            mean: mean(agg.finalOfficesGold),
            p50: median(agg.finalOfficesGold),
          },
          milestones: {
            firstOfficeRound: neverAwareRoundSummary(agg.firstOfficeRound),
            firstDomainUpgradeRound: neverAwareRoundSummary(agg.firstDomainUpgradeRound),
            firstStorageBuiltRound: neverAwareRoundSummary(agg.firstStorageBuiltRound),
          },
          idleActionRate: actionSlots > 0 ? agg.idleActions / actionSlots : 0,
          meanGoldByRound,
          sell: {
            samples: agg.sellSamples,
            byResource: agg.sellByResource,
            goldPerInvestment: summary(agg.sellGoldPerInvestment),
            marketModifierPerInvestment: summary(agg.sellMarketModifierPerInvestment),
          },
          conversion: {
            samples: agg.conversionSamples,
            goldFromConversionMean:
              agg.conversionSamples > 0
                ? agg.conversionGoldSum / agg.conversionSamples
                : 0,
            rawStoredMean:
              agg.conversionSamples > 0
                ? agg.conversionRawStoredSum / agg.conversionSamples
                : 0,
            specialStoredMean:
              agg.conversionSamples > 0
                ? agg.conversionSpecialStoredSum / agg.conversionSamples
                : 0,
            rawLostMean:
              agg.conversionSamples > 0
                ? agg.conversionRawLostSum / agg.conversionSamples
                : 0,
          },
          actions,
          facilities: agg.facilities,
          errors: agg.errors,
        },
      ];
    }),
  ) as PlaytestReport['outcomes']['byAgent'];

  const checkExamples: PlaytestReport['checkMath']['examples'] = [
    { name: 'Materialgewinn (Domäne) DC10 +5', dc: 10, modifier: 5, probs: tierProbabilities(10, 5) },
    { name: 'Materialgewinn (Werkstatt) DC12 +5', dc: 12, modifier: 5, probs: tierProbabilities(12, 5) },
    { name: 'Geldgewinn (Verkauf/Verleih) DC14 +5', dc: 14, modifier: 5, probs: tierProbabilities(14, 5) },
    { name: 'Einflussgewinn DC12 +5', dc: 12, modifier: 5, probs: tierProbabilities(12, 5) },
  ];

  return {
    generatedAt: new Date().toISOString(),
    config,
    scenario: {
      name: scenarioName,
      players: players.map((p) => ({
        agentId: p.agent.id,
        displayName: p.displayName,
        checks: p.checks,
      })),
    },
    outcomes: {
      giniGold: {
        mean: mean(giniByRun),
        p50: median(giniByRun),
        p90: percentile(giniByRun, 0.9),
      },
      byAgent,
    },
    checkMath: {
      examples: checkExamples,
    },
    systems: {
      market: {
        raw: {
          samples: marketAgg.raw.samples,
          byRoll: marketAgg.raw.byRoll,
          byCategory: marketAgg.raw.byCategory,
          byDemand: marketAgg.raw.byDemand,
          modifiers: {
            cheap: summary(marketAgg.raw.modsByTier.cheap),
            basic: summary(marketAgg.raw.modsByTier.basic),
            expensive: summary(marketAgg.raw.modsByTier.expensive),
          },
        },
        special: {
          samples: marketAgg.special.samples,
          byRoll: marketAgg.special.byRoll,
          byCategory: marketAgg.special.byCategory,
          byDemand: marketAgg.special.byDemand,
          modifiers: {
            cheap: summary(marketAgg.special.modsByTier.cheap),
            basic: summary(marketAgg.special.modsByTier.basic),
            expensive: summary(marketAgg.special.modsByTier.expensive),
          },
        },
      },
      events: {
        sections: eventAgg.sections,
        events: eventAgg.events,
        byRoll: eventAgg.byRoll,
        byName: eventAgg.byName,
        modifiers: {
          taxGoldPerRound: {
            mean: mean(eventAgg.mods.taxGoldPerRound),
            p90: percentile(eventAgg.mods.taxGoldPerRound, 0.9),
            nonZeroRate: nonZeroRate(eventAgg.mods.taxGoldPerRound),
          },
          oneTimeGoldTaxPerOffice: {
            mean: mean(eventAgg.mods.oneTimeGoldTaxPerOffice),
            p90: percentile(eventAgg.mods.oneTimeGoldTaxPerOffice, 0.9),
            nonZeroRate: nonZeroRate(eventAgg.mods.oneTimeGoldTaxPerOffice),
          },
          officeGoldIncomeMultiplier: {
            mean: mean(eventAgg.mods.officeGoldIncomeMultiplier),
            p10: percentile(eventAgg.mods.officeGoldIncomeMultiplier, 0.1),
            p50: median(eventAgg.mods.officeGoldIncomeMultiplier),
          },
          officeGoldIncomeBonusPerOffice: {
            mean: mean(eventAgg.mods.officeGoldIncomeBonusPerOffice),
            p90: percentile(eventAgg.mods.officeGoldIncomeBonusPerOffice, 0.9),
            nonZeroRate: nonZeroRate(eventAgg.mods.officeGoldIncomeBonusPerOffice),
          },
          lendMoneyDcBonus: {
            mean: mean(eventAgg.mods.lendMoneyDcBonus),
            p90: percentile(eventAgg.mods.lendMoneyDcBonus, 0.9),
            nonZeroRate: nonZeroRate(eventAgg.mods.lendMoneyDcBonus),
          },
          sellMaterialsDcBonus: {
            mean: mean(eventAgg.mods.sellMaterialsDcBonus),
            p90: percentile(eventAgg.mods.sellMaterialsDcBonus, 0.9),
            nonZeroRate: nonZeroRate(eventAgg.mods.sellMaterialsDcBonus),
          },
          influenceActionDcBonus: {
            mean: mean(eventAgg.mods.influenceActionDcBonus),
            p10: percentile(eventAgg.mods.influenceActionDcBonus, 0.1),
            p50: median(eventAgg.mods.influenceActionDcBonus),
          },
          workshopUpkeepLaborBonusFlat: {
            mean: mean(eventAgg.mods.workshopUpkeepLaborBonusFlat),
            p90: percentile(eventAgg.mods.workshopUpkeepLaborBonusFlat, 0.9),
            nonZeroRate: nonZeroRate(eventAgg.mods.workshopUpkeepLaborBonusFlat),
          },
          workshopUpkeepGoldBonusFlat: {
            mean: mean(eventAgg.mods.workshopUpkeepGoldBonusFlat),
            p90: percentile(eventAgg.mods.workshopUpkeepGoldBonusFlat, 0.9),
            nonZeroRate: nonZeroRate(eventAgg.mods.workshopUpkeepGoldBonusFlat),
          },
          workshopUpkeepGoldBonusPerTier: {
            mean: mean(eventAgg.mods.workshopUpkeepGoldBonusPerTier),
            p90: percentile(eventAgg.mods.workshopUpkeepGoldBonusPerTier, 0.9),
            nonZeroRate: nonZeroRate(eventAgg.mods.workshopUpkeepGoldBonusPerTier),
          },
          rawAutoConvertDivisor: {
            mean: mean(eventAgg.mods.rawAutoConvertDivisor),
            p10: percentile(eventAgg.mods.rawAutoConvertDivisor, 0.1),
            p50: median(eventAgg.mods.rawAutoConvertDivisor),
          },
          lendMoneyPayoutMultiplier: {
            mean: mean(eventAgg.mods.lendMoneyPayoutMultiplier),
            p10: percentile(eventAgg.mods.lendMoneyPayoutMultiplier, 0.1),
            p50: median(eventAgg.mods.lendMoneyPayoutMultiplier),
          },
          moneyBonusGoldPerTwoInvestments: {
            mean: mean(eventAgg.mods.moneyBonusGoldPerTwoInvestments),
            p90: percentile(eventAgg.mods.moneyBonusGoldPerTwoInvestments, 0.9),
            nonZeroRate: nonZeroRate(eventAgg.mods.moneyBonusGoldPerTwoInvestments),
          },
        },
      },
    },
  };
}
