import {
  asUserId,
  createSeededRng,
  decide,
  reduceEvents,
  GameRuleError,
  type ActorContext,
  type CampaignState,
  type GameCommand,
  type GameEvent,
  type GlobalEventState,
  type MaterialTier,
  type SuccessTier,
} from '../core';

import { moneyActionMods, officeIncomeMods, rawAutoConvertDivisor, taxGoldPerRound, workshopUpkeepMods } from '../core/rules/eventModifiers_v1';
import { officesIncomePerRound } from '../core/rules/v1';

import type { AgentId, PlaytestConfig, PlayerProfile } from './types';
import { tierProbabilities } from './probabilities';
import { gini, mean, median, percentile } from './stats';

type AgentAggregate = {
  samples: number;
  wins: number;
  finalGold: number[];
  finalOfficesGoldPerRound: number[];
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
        finalOfficesGoldPerRound: { mean: number; p50: number };
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
        officeGoldIncomeMultiplier: { mean: number; p10: number; p50: number };
        officeGoldIncomeBonusPerTier: { mean: number; p90: number; nonZeroRate: number };
        lendMoneyDcBonus: { mean: number; p90: number; nonZeroRate: number };
        sellMaterialsDcBonus: { mean: number; p90: number; nonZeroRate: number };
        influenceActionDcBonus: { mean: number; p10: number; p50: number };
        workshopUpkeepLaborBonusFlat: { mean: number; p90: number; nonZeroRate: number };
        workshopUpkeepGoldBonusFlat: { mean: number; p90: number; nonZeroRate: number };
        workshopUpkeepGoldBonusPerTier: { mean: number; p90: number; nonZeroRate: number };
        rawAutoConvertDivisorFood: { mean: number; p10: number; p50: number };
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

function ensureAgg(
  aggs: Record<string, AgentAggregate>,
  id: AgentId,
  rounds: number,
): AgentAggregate {
  const existing = aggs[id];
  if (existing) return existing;
  const agg: AgentAggregate = {
    samples: 0,
    wins: 0,
    finalGold: [],
    finalOfficesGoldPerRound: [],
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
  const canonical = canonicalActionKey(actionKey);
  const normalized = canonical.startsWith('influence.bonus.') ? 'influence' : canonical;
  bump(agg.actionCount, normalized, 1);
  agg.actionTierCount[normalized] ??= emptyTierCounts();
  agg.actionTierCount[normalized][tier] += 1;
}

function canonicalActionKey(actionKey: string): string {
  const idx = actionKey.indexOf('@');
  return idx === -1 ? actionKey : actionKey.slice(0, idx);
}

function hasUsedCanonicalAction(
  me: { turn: { actionKeysUsed: string[] } },
  canonical: string,
): boolean {
  return me.turn.actionKeysUsed.some((k) => canonicalActionKey(k) === canonical);
}

function hasUsedMarker(
  me: { turn: { actionKeysUsed: string[] } },
  marker: string,
): boolean {
  const needle = `@${marker}`;
  return me.turn.actionKeysUsed.some((k) => k.includes(needle));
}

function bonusInfluenceSlots(me: { holdings: any }): number {
  const largeOffices = (me.holdings.offices ?? []).filter((o: any) => o.tier === 'large').length;
  const hasLargeCult = (me.holdings.organizations ?? []).some(
    (o: any) => o.kind === 'cult' && o.tier === 'large' && !o.followers?.inUnrest,
  );
  return largeOffices + (hasLargeCult ? 1 : 0);
}

function bonusMoneySlots(me: { holdings: any }): number {
  const hasLargeTradeCollegium = (me.holdings.organizations ?? []).some(
    (o: any) => o.kind === 'collegiumTrade' && o.tier === 'large' && !o.followers?.inUnrest,
  );
  return hasLargeTradeCollegium ? 1 : 0;
}

function bonusMaterialsSlots(me: { holdings: any }): number {
  const hasLargeCraftCollegium = (me.holdings.organizations ?? []).some(
    (o: any) => o.kind === 'collegiumCraft' && o.tier === 'large' && !o.followers?.inUnrest,
  );
  return hasLargeCraftCollegium ? 1 : 0;
}

function hasRemainingInfluenceBonus(me: { turn: { actionKeysUsed: string[] }; holdings: any }): boolean {
  const slots = bonusInfluenceSlots(me);
  for (let i = 1; i <= slots; i += 1) {
    const canonical = `influence.bonus.${i}`;
    if (!hasUsedCanonicalAction(me, canonical)) return true;
  }
  return false;
}

function hasAnyActionCapacity(
  me: { turn: { actionsUsed: number; actionKeysUsed: string[] }; holdings: any },
  actionsPerRound: number,
): boolean {
  if (me.turn.actionsUsed < actionsPerRound) return true;
  if (bonusMoneySlots(me) > 0 && !hasUsedMarker(me, 'bonus.money.1')) return true;
  if (bonusMaterialsSlots(me) > 0 && !hasUsedMarker(me, 'bonus.materials.1')) return true;
  if (hasRemainingInfluenceBonus(me)) return true;
  return false;
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
    const events = decide(state, command, { actor, rng, emitPublicLogs: false });
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

function sumStock(stock: Record<string, number>): number {
  let sum = 0;
  for (const v of Object.values(stock)) sum += v;
  return sum;
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

function meanOrZero(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function recordMarketSide(
  agg: MarketAgg,
  side: {
    tableRollTotal: number;
    categoryLabel: string;
    demandLabel: string;
    modifiersByGroup: Record<string, number>;
  },
  groupPrefixByTier: Record<MaterialTier, string>,
): void {
  agg.samples += 1;
  bump(agg.byRoll, String(side.tableRollTotal), 1);
  bump(agg.byCategory, side.categoryLabel, 1);
  bump(agg.byDemand, side.demandLabel, 1);

  for (const tier of ['cheap', 'basic', 'expensive'] as const) {
    const prefix = groupPrefixByTier[tier];
    const values = Object.entries(side.modifiersByGroup)
      .filter(([k]) => k.startsWith(prefix))
      .map(([, v]) => Math.trunc(v));
    agg.modsByTier[tier].push(meanOrZero(values));
  }
}

type EventAgg = {
  sections: number;
  events: number;
  byRoll: Record<string, number>;
  byName: Record<string, number>;
  mods: {
    taxGoldPerRound: number[];
    officeGoldIncomeMultiplier: number[];
    officeGoldIncomeBonusPerTier: number[];
    lendMoneyDcBonus: number[];
    sellMaterialsDcBonus: number[];
    influenceActionDcBonus: number[];
    workshopUpkeepLaborBonusFlat: number[];
    workshopUpkeepGoldBonusFlat: number[];
    workshopUpkeepGoldBonusPerTier: number[];
    rawAutoConvertDivisorFood: number[];
    moneyBonusGoldPerTwoInvestments: number[];
  };
};

function emptyEventAgg(): EventAgg {
  return {
    sections: 0,
    events: 0,
    byRoll: {},
    byName: {},
    mods: {
      taxGoldPerRound: [],
      officeGoldIncomeMultiplier: [],
      officeGoldIncomeBonusPerTier: [],
      lendMoneyDcBonus: [],
      sellMaterialsDcBonus: [],
      influenceActionDcBonus: [],
      workshopUpkeepLaborBonusFlat: [],
      workshopUpkeepGoldBonusFlat: [],
      workshopUpkeepGoldBonusPerTier: [],
      rawAutoConvertDivisorFood: [],
      moneyBonusGoldPerTwoInvestments: [],
    },
  };
}

function computeCampaignEventModifiersV1(events: GlobalEventState[]): {
  taxGoldPerRound: number;
  officeGoldIncomeMultiplier: number;
  officeGoldIncomeBonusPerTier: number;
  lendMoneyDcBonus: number;
  sellMaterialsDcBonus: number;
  influenceActionDcBonus: number;
  workshopUpkeepLaborBonusFlat: number;
  workshopUpkeepGoldBonusFlat: number;
  workshopUpkeepGoldBonusPerTier: number;
  rawAutoConvertDivisorFood: number;
  moneyBonusGoldPerTwoInvestments: number;
} {
  const round = events[0]?.startsAtRound ?? 1;
  const officeMods = officeIncomeMods(events, round);
  const moneyMods = moneyActionMods(events, round);
  const workMods = workshopUpkeepMods(events, round);
  return {
    taxGoldPerRound: taxGoldPerRound(events, round),
    officeGoldIncomeMultiplier: officeMods.goldMultiplier,
    officeGoldIncomeBonusPerTier: officeMods.goldBonusPerTier,
    lendMoneyDcBonus: moneyMods.lendDc,
    sellMaterialsDcBonus: moneyMods.sellDc,
    influenceActionDcBonus: moneyMods.influenceDc,
    workshopUpkeepLaborBonusFlat: workMods.laborFlat,
    workshopUpkeepGoldBonusFlat: workMods.goldFlat,
    workshopUpkeepGoldBonusPerTier: workMods.goldPerTier,
    rawAutoConvertDivisorFood: rawAutoConvertDivisor('raw.grainVeg', events, round),
    moneyBonusGoldPerTwoInvestments: moneyMods.bonusGoldPerTwoInvestments,
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

  const globalEvents: GlobalEventState[] = e.events.map((row) => ({
    startsAtRound: e.startsAtRound,
    endsAtRound: e.endsAtRound,
    tableRollTotal: row.tableRoll.total,
    name: row.name,
    effectsText: row.effectsText,
    meta: row.meta as any,
  }));
  const mods = computeCampaignEventModifiersV1(globalEvents);
  agg.mods.taxGoldPerRound.push(mods.taxGoldPerRound);
  agg.mods.officeGoldIncomeMultiplier.push(mods.officeGoldIncomeMultiplier);
  agg.mods.officeGoldIncomeBonusPerTier.push(mods.officeGoldIncomeBonusPerTier);
  agg.mods.lendMoneyDcBonus.push(mods.lendMoneyDcBonus);
  agg.mods.sellMaterialsDcBonus.push(mods.sellMaterialsDcBonus);
  agg.mods.influenceActionDcBonus.push(mods.influenceActionDcBonus);
  agg.mods.workshopUpkeepLaborBonusFlat.push(mods.workshopUpkeepLaborBonusFlat);
  agg.mods.workshopUpkeepGoldBonusFlat.push(mods.workshopUpkeepGoldBonusFlat);
  agg.mods.workshopUpkeepGoldBonusPerTier.push(mods.workshopUpkeepGoldBonusPerTier);
  agg.mods.rawAutoConvertDivisorFood.push(mods.rawAutoConvertDivisorFood);
  agg.mods.moneyBonusGoldPerTwoInvestments.push(mods.moneyBonusGoldPerTwoInvestments);
}

function recordMarketAndEvents(
  events: GameEvent[],
  marketAgg: { raw: MarketAgg; special: MarketAgg },
  eventAgg: EventAgg,
): void {
  for (const event of events) {
    if (event.type === 'MarketRolled') {
      const inst = event.instances.find((i) => i.id === 'local') ?? event.instances[0];
      if (!inst) continue;
      recordMarketSide(
        marketAgg.raw,
        {
          tableRollTotal: inst.raw.tableRoll.total,
          categoryLabel: inst.raw.categoryLabel,
          demandLabel: inst.raw.demandLabel,
          modifiersByGroup: inst.raw.modifiersByGroup,
        },
        { cheap: 'rawCheap', basic: 'rawBasic', expensive: 'rawExpensive' },
      );
      recordMarketSide(
        marketAgg.special,
        {
          tableRollTotal: inst.special.tableRoll.total,
          categoryLabel: inst.special.categoryLabel,
          demandLabel: inst.special.demandLabel,
          modifiersByGroup: inst.special.modifiersByGroup,
        },
        { cheap: 'specialCheap', basic: 'specialBasic', expensive: 'specialExpensive' },
      );
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
    if (event.type === 'PlayerMoneySold') {
      const profile = profileByPlayerId[String(event.playerId)];
      if (!profile) continue;
      const agg = ensureAgg(aggs, profile.agent.id, rounds);

      let investments = 0;
      let rawInv = 0;
      let specialInv = 0;
      for (const item of event.sold) {
        if (item.kind === 'raw') {
          const inv = Math.floor(item.count / 6);
          rawInv += inv;
          investments += inv;
        } else if (item.kind === 'special') {
          const inv = item.count;
          specialInv += inv;
          investments += inv;
        } else if (item.kind === 'labor') {
          investments += item.count;
        }
      }
      if (investments <= 0) continue;

      agg.sellSamples += 1;
      if (rawInv > 0) agg.sellByResource.raw += 1;
      if (specialInv > 0) agg.sellByResource.special += 1;
      agg.sellGoldPerInvestment.push(event.goldGained / investments);
      agg.sellMarketModifierPerInvestment.push(event.marketDeltaGold / investments);
      continue;
    }

    if (event.type === 'PlayerMaterialsConverted') {
      const profile = profileByPlayerId[String(event.playerId)];
      if (!profile) continue;
      const agg = ensureAgg(aggs, profile.agent.id, rounds);
      agg.conversionSamples += 1;
      agg.conversionGoldSum += event.convertedToGold.goldGained;
      agg.conversionRawStoredSum += sumStock(event.stored.rawStored);
      agg.conversionSpecialStoredSum += sumStock(event.stored.specialStored);
      agg.conversionRawLostSum += sumStock(event.lost.rawLost) + sumStock(event.lost.specialLost);
    }
  }
}

function extractOutcome(events: GameEvent[]): { actionKey: string; tier: SuccessTier } | null {
  for (const event of events) {
    switch (event.type) {
      case 'PlayerMaterialsGained':
        return { actionKey: event.actionKey, tier: event.tier };
      case 'PlayerInfluenceGained':
        return { actionKey: event.actionKey, tier: event.tier };
      case 'PlayerMoneyLent':
        return { actionKey: event.actionKey, tier: event.tier };
      case 'PlayerMoneySold':
        return { actionKey: event.actionKey, tier: event.tier };
      case 'PlayerMoneyBought':
        return { actionKey: event.actionKey, tier: event.tier };
      case 'PlayerDomainAcquired':
        return { actionKey: event.actionKey, tier: event.tierResult };
      case 'PlayerCityPropertyAcquired':
        return { actionKey: event.actionKey, tier: event.tierResult };
      case 'PlayerOfficeAcquired':
        return { actionKey: event.actionKey, tier: event.tierResult };
      case 'PlayerOrganizationAcquired':
        return { actionKey: event.actionKey, tier: event.tierResult };
      case 'PlayerTradeEnterpriseAcquired':
        return { actionKey: event.actionKey, tier: event.tierResult };
      case 'PlayerTenantsAcquired':
        return { actionKey: event.actionKey, tier: event.tierResult };
      case 'PlayerTroopsRecruited':
        return { actionKey: event.actionKey, tier: event.tierResult };
      default:
        break;
    }
  }
  return null;
}

function extractFacility(events: GameEvent[]): string | null {
  for (const event of events) {
    switch (event.type) {
      case 'PlayerStarterDomainUpgraded':
        return 'domain.upgradeStarter';
      case 'PlayerDomainSpecializationSet':
        return `domain.specialization.${event.kind}`;
      case 'PlayerWorkshopBuilt':
        return `workshop.build.${event.tier}`;
      case 'PlayerWorkshopUpgraded':
        return `workshop.upgrade.${event.fromTier}->${event.toTier}`;
      case 'PlayerStorageBuilt':
        return `storage.build.${event.tier}`;
      case 'PlayerStorageUpgraded':
        return `storage.upgrade.${event.fromTier}->${event.toTier}`;
      case 'PlayerFacilityBuilt':
        return `facility.${event.facilityKey}`;
      default:
        break;
    }
  }
  return null;
}

function expectedActionKey(command: GameCommand): string | null {
  switch (command.type) {
    case 'GainMaterials':
      return command.mode === 'domainAdministration' ? 'materials.domain' : 'materials.workshop';
    case 'GainInfluence':
      return 'influence';
    case 'MoneyLend':
      return 'money.lend';
    case 'MoneySell':
      return 'money.sell';
    case 'MoneySellBuy':
      return 'money.sell';
    case 'MoneyBuy':
      return 'money.buy';
    case 'AcquireDomain':
      return 'acquire.domain';
    case 'AcquireCityProperty':
      return 'acquire.cityProperty';
    case 'AcquireOffice':
      return 'acquire.office';
    case 'AcquireOrganization':
      return `acquire.org.${command.kind}`;
    case 'AcquireTradeEnterprise':
      return 'acquire.trade';
    case 'AcquireTenants':
      return 'acquire.tenants';
    case 'RecruitTroops':
      return `troops.${command.troopKind}`;
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
            if (built === 'domain.upgradeStarter' && firstDomainUpgradeRoundByUserId[profile.userId] === 0) {
              firstDomainUpgradeRoundByUserId[profile.userId] = round;
            }
            if (built.startsWith('storage.build.') && firstStorageBuiltRoundByUserId[profile.userId] === 0) {
              firstStorageBuiltRoundByUserId[profile.userId] = round;
            }
          } else if (res.error) {
            const agg = ensureAgg(aggs, profile.agent.id, config.rounds);
            const key = facility.type;
            bump(agg.errors, `facility:${key}`, 1);
          }
        }

        const actionsPerRound = state.rules.actionsPerRound;
        const initialBonusSlots =
          bonusInfluenceSlots(me) + bonusMoneySlots(me) + bonusMaterialsSlots(me);
        const maxActionSlotsThisRound = actionsPerRound + initialBonusSlots;

        for (let actionSlot = 0; actionSlot < maxActionSlotsThisRound; actionSlot += 1) {
          if (!state) break;

          const meNow = getPlayerByUserId(state, profile.userId);
          if (!meNow) break;
          if (!hasAnyActionCapacity(meNow, actionsPerRound)) break;

          const ctxNow = { state, round: state.round, me: meNow, profile };
          const candidates = profile.agent.decideActions(ctxNow);
          const agg = ensureAgg(aggs, profile.agent.id, config.rounds);

          let executedAny = false;
          for (const planned of candidates) {
            if (!state) break;

            const actionKey = expectedActionKey(planned);
            if (actionKey) {
              const used = hasUsedCanonicalAction(meNow, actionKey);
              if (used) {
                const canRepeatInfluence = actionKey === 'influence' && hasRemainingInfluenceBonus(meNow);
                if (!canRepeatInfluence) continue;
              }
            }

            const res = execute(state, patchCampaignId(planned, campaignId), actor, rng);
            state = res.state;

            if (res.error) {
              const key =
                res.error instanceof GameRuleError ? `rule:${res.error.code}` : `err:${planned.type}`;
              bump(agg.errors, key, 1);
              continue;
            }

            executedAny = true;

            const outcome = extractOutcome(res.events);
            if (outcome) recordAction(agg, outcome.actionKey, outcome.tier);
            recordSellAndConversion(res.events, profileByPlayerId, aggs, config.rounds);

            for (const e of res.events) {
              if (e.type === 'PlayerOfficeAcquired' && e.tierResult !== 'fail' && firstOfficeRoundByUserId[profile.userId] === 0) {
                firstOfficeRoundByUserId[profile.userId] = round;
              }
            }

            break;
          }

          if (!executedAny) agg.idleActions += 1;
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
      const officesGoldPerRound = me.holdings.offices.reduce(
        (sum, o) => sum + officesIncomePerRound(o.tier, o.yieldMode, state.rules).gold,
        0,
      );
      agg.finalOfficesGoldPerRound.push(officesGoldPerRound);
      agg.firstOfficeRound.push(firstOfficeRoundByUserId[profile.userId] ?? 0);
      agg.firstDomainUpgradeRound.push(firstDomainUpgradeRoundByUserId[profile.userId] ?? 0);
      agg.firstStorageBuiltRound.push(firstStorageBuiltRoundByUserId[profile.userId] ?? 0);
    }
  }

  const byAgent = Object.fromEntries(
    Object.entries(aggs).map(([agentId, agg]) => {
      const totalActionSlots = agg.samples * config.rounds * 2;
      const idleRate = totalActionSlots > 0 ? agg.idleActions / totalActionSlots : 0;
      return [
        agentId,
        {
          samples: agg.samples,
          wins: agg.wins,
          winRate: agg.samples > 0 ? agg.wins / agg.samples : 0,
          finalGold: summary(agg.finalGold),
          finalOfficesGoldPerRound: { mean: mean(agg.finalOfficesGoldPerRound), p50: median(agg.finalOfficesGoldPerRound) },
          milestones: {
            firstOfficeRound: neverAwareRoundSummary(agg.firstOfficeRound),
            firstDomainUpgradeRound: neverAwareRoundSummary(agg.firstDomainUpgradeRound),
            firstStorageBuiltRound: neverAwareRoundSummary(agg.firstStorageBuiltRound),
          },
          idleActionRate: idleRate,
          meanGoldByRound: agg.roundGoldSum.map((sum, i) => (agg.roundGoldCount[i] ? sum / agg.roundGoldCount[i] : 0)),
          sell: {
            samples: agg.sellSamples,
            byResource: agg.sellByResource,
            goldPerInvestment: summary(agg.sellGoldPerInvestment),
            marketModifierPerInvestment: summary(agg.sellMarketModifierPerInvestment),
          },
          conversion: {
            samples: agg.conversionSamples,
            goldFromConversionMean: agg.conversionSamples ? agg.conversionGoldSum / agg.conversionSamples : 0,
            rawStoredMean: agg.conversionSamples ? agg.conversionRawStoredSum / agg.conversionSamples : 0,
            specialStoredMean: agg.conversionSamples ? agg.conversionSpecialStoredSum / agg.conversionSamples : 0,
            rawLostMean: agg.conversionSamples ? agg.conversionRawLostSum / agg.conversionSamples : 0,
          },
          actions: Object.fromEntries(
            Object.entries(agg.actionCount).map(([key, count]) => [
              key,
              { count, tiers: agg.actionTierCount[key] ?? emptyTierCounts() },
            ]),
          ),
          facilities: agg.facilities,
          errors: agg.errors,
        },
      ];
    }),
  ) as PlaytestReport['outcomes']['byAgent'];

  const checkExamples = [
    { name: 'DC 10, mod +5', dc: 10, modifier: 5 },
    { name: 'DC 14, mod +5', dc: 14, modifier: 5 },
    { name: 'DC 18, mod +5', dc: 18, modifier: 5 },
  ].map((ex) => ({ ...ex, probs: tierProbabilities(ex.dc, ex.modifier) }));

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
          officeGoldIncomeMultiplier: {
            mean: mean(eventAgg.mods.officeGoldIncomeMultiplier),
            p10: percentile(eventAgg.mods.officeGoldIncomeMultiplier, 0.1),
            p50: median(eventAgg.mods.officeGoldIncomeMultiplier),
          },
          officeGoldIncomeBonusPerTier: {
            mean: mean(eventAgg.mods.officeGoldIncomeBonusPerTier),
            p90: percentile(eventAgg.mods.officeGoldIncomeBonusPerTier, 0.9),
            nonZeroRate: nonZeroRate(eventAgg.mods.officeGoldIncomeBonusPerTier),
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
          rawAutoConvertDivisorFood: {
            mean: mean(eventAgg.mods.rawAutoConvertDivisorFood),
            p10: percentile(eventAgg.mods.rawAutoConvertDivisorFood, 0.1),
            p50: median(eventAgg.mods.rawAutoConvertDivisorFood),
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
