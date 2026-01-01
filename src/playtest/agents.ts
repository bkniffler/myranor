import type { GameCommand, PlayerState, PostTier } from '../core';

import { getMaterialOrThrow } from '../core/rules/materials_v1';

import { createPlannerAgent } from './plannerAgent';
import { DEFAULT_NET_WORTH_WEIGHTS } from './plannerScore';
import type { Agent, RoundContext } from './types';

function postTierRank(tier: PostTier): number {
  return tier === 'small' ? 1 : tier === 'medium' ? 2 : 3;
}

function domainTierRank(
  tier: PlayerState['holdings']['domains'][number]['tier']
): number {
  if (tier === 'starter') return 0;
  return postTierRank(tier);
}

function starterDomainId(me: PlayerState): string | null {
  return me.holdings.domains.find((d) => d.tier === 'starter')?.id ?? null;
}

function largestDomainId(me: PlayerState): string | null {
  const domains = [...me.holdings.domains].sort(
    (a, b) => domainTierRank(b.tier) - domainTierRank(a.tier)
  );
  return domains[0]?.id ?? null;
}

function largestWorkshopId(me: PlayerState): string | null {
  const workshops = [...me.holdings.workshops].sort(
    (a, b) => postTierRank(b.tier) - postTierRank(a.tier)
  );
  return workshops[0]?.id ?? null;
}

function sellInvestmentCap(me: PlayerState): number {
  const capFromTrade = me.holdings.tradeEnterprises.reduce(
    (sum, te) => sum + 2 * postTierRank(te.tier),
    0
  );
  const capFromDomains = me.holdings.domains.reduce(
    (sum, d) => sum + domainTierRank(d.tier),
    0
  );
  return 2 + capFromTrade + capFromDomains;
}

function localMarketInstanceId(): string {
  return 'local';
}

function sellScore(
  ctx: RoundContext,
  materialId: string,
  kind: 'raw' | 'special'
): number {
  const inst =
    ctx.state.market.instances.find((i) => i.id === localMarketInstanceId()) ??
    ctx.state.market.instances[0];
  if (!inst) return 0;

  const material = getMaterialOrThrow(materialId);
  const mods =
    kind === 'raw' ? inst.raw.modifiersByGroup : inst.special.modifiersByGroup;
  const marketMod = Math.trunc(mods[material.marketGroup] ?? 0);
  return marketMod + (material.saleBonusGold ?? 0);
}

function buildMoneySellCommand(
  ctx: RoundContext,
  opts: {
    maxInvestments?: number;
    preferKind?: 'raw' | 'special' | 'any';
    marketInstanceId?: string;
  } = {}
): GameCommand | null {
  const me = ctx.me;
  const cap = Math.max(0, sellInvestmentCap(me));
  const maxInvestments = Math.max(0, Math.trunc(opts.maxInvestments ?? cap));
  const budget = Math.min(cap, maxInvestments);
  if (budget <= 0) return null;

  type Lot = {
    kind: 'raw' | 'special';
    materialId: string;
    investments: number;
    score: number;
  };

  const lots: Lot[] = [];
  for (const [materialId, count] of Object.entries(me.economy.inventory.raw)) {
    const inv = Math.floor((count ?? 0) / 6);
    if (inv <= 0) continue;
    lots.push({
      kind: 'raw',
      materialId,
      investments: inv,
      score: sellScore(ctx, materialId, 'raw'),
    });
  }
  for (const [materialId, count] of Object.entries(
    me.economy.inventory.special
  )) {
    const inv = Math.floor(count ?? 0);
    if (inv <= 0) continue;
    lots.push({
      kind: 'special',
      materialId,
      investments: inv,
      score: sellScore(ctx, materialId, 'special'),
    });
  }

  const preferKind = opts.preferKind ?? 'any';
  const filtered =
    preferKind === 'any' ? lots : lots.filter((l) => l.kind === preferKind);

  const pool = filtered.length ? filtered : lots;
  if (pool.length === 0) return null;

  pool.sort(
    (a, b) => b.score - a.score || a.materialId.localeCompare(b.materialId)
  );

  let remaining = budget;
  const rawCounts: Record<string, number> = {};
  const specialCounts: Record<string, number> = {};

  for (const lot of pool) {
    if (remaining <= 0) break;
    const take = Math.min(lot.investments, remaining);
    remaining -= take;
    if (lot.kind === 'raw')
      rawCounts[lot.materialId] = (rawCounts[lot.materialId] ?? 0) + take * 6;
    else
      specialCounts[lot.materialId] =
        (specialCounts[lot.materialId] ?? 0) + take;
  }

  const items: Array<
    | { kind: 'raw'; materialId: string; count: number }
    | { kind: 'special'; materialId: string; count: number }
  > = [];
  for (const [materialId, count] of Object.entries(rawCounts))
    items.push({ kind: 'raw', materialId, count });
  for (const [materialId, count] of Object.entries(specialCounts))
    items.push({ kind: 'special', materialId, count });

  if (items.length === 0) return null;
  return {
    type: 'MoneySell',
    campaignId: '',
    marketInstanceId: opts.marketInstanceId ?? localMarketInstanceId(),
    items,
  };
}

function buildGainMaterialsCommand(
  me: PlayerState,
  mode: 'domainAdministration' | 'workshopOversight'
): GameCommand | null {
  const targetId =
    mode === 'domainAdministration'
      ? largestDomainId(me)
      : largestWorkshopId(me);
  if (!targetId) return null;

  const labor = Math.max(0, me.turn.laborAvailable);
  if (labor <= 0) return null;

  const investments = Math.min(
    labor,
    mode === 'domainAdministration'
      ? 4 *
          Math.max(
            1,
            domainTierRank(
              me.holdings.domains.find((d) => d.id === targetId)?.tier ??
                'starter'
            )
          )
      : 2 *
          postTierRank(
            me.holdings.workshops.find((w) => w.id === targetId)?.tier ??
              'small'
          )
  );
  if (investments <= 0) return null;

  return {
    type: 'GainMaterials',
    campaignId: '',
    mode,
    investments,
    targetId,
  };
}

function buildGainInfluenceCommand(me: PlayerState): GameCommand | null {
  const max =
    me.holdings.offices.length || me.holdings.organizations.length ? 6 : 4;
  const investments = Math.min(Math.max(0, me.economy.gold), max);
  if (investments <= 0) return null;
  return {
    type: 'GainInfluence',
    campaignId: '',
    kind: 'temporary',
    investments,
  };
}

function buildLendMoneyCommand(me: PlayerState): GameCommand | null {
  const maxTradeTier = Math.max(
    0,
    ...me.holdings.tradeEnterprises.map((t) => postTierRank(t.tier))
  );
  const cap =
    maxTradeTier === 0
      ? 2
      : maxTradeTier === 1
        ? 4
        : maxTradeTier === 2
          ? 6
          : 10;
  const maxAffordable = Math.floor(me.economy.gold / 2);
  const investments = Math.min(cap, maxAffordable);
  if (investments <= 0) return null;
  return { type: 'MoneyLend', campaignId: '', investments };
}

function buildUpgradeStarterDomainCommand(me: PlayerState): GameCommand | null {
  const id = starterDomainId(me);
  if (!id) return null;
  if (me.economy.gold < 10) return null;
  if (me.turn.laborAvailable < 4) return null;
  return { type: 'UpgradeStarterDomain', campaignId: '', domainId: id };
}

function buildSmallStorageCommand(me: PlayerState): GameCommand | null {
  if (me.economy.gold < 8) return null;
  const domain = me.holdings.domains.find((d) => d.tier !== 'starter');
  if (!domain) return null;
  const hasStorage = me.holdings.storages.some(
    (s) => s.location.kind === 'domain' && s.location.id === domain.id
  );
  if (hasStorage) return null;
  return {
    type: 'BuildStorage',
    campaignId: '',
    location: { kind: 'domain', id: domain.id },
    tier: 'small',
  };
}

function buildAcquireOfficeSmallCommand(me: PlayerState): GameCommand | null {
  // Prefer cheaper influence payment if we have influence; otherwise gold-heavy.
  if (me.economy.gold >= 4 && me.turn.influenceAvailable >= 8) {
    return {
      type: 'AcquireOffice',
      campaignId: '',
      tier: 'small',
      payment: 'influenceFirst',
    };
  }
  if (me.economy.gold >= 8 && me.turn.influenceAvailable >= 2) {
    return {
      type: 'AcquireOffice',
      campaignId: '',
      tier: 'small',
      payment: 'goldFirst',
    };
  }
  return null;
}

function buildAcquireTradeEnterpriseSmallCommand(
  me: PlayerState
): GameCommand | null {
  if (me.economy.gold < 20) return null;
  return { type: 'AcquireTradeEnterprise', campaignId: '', tier: 'small' };
}

function buildAcquireCityPropertyMediumCommand(
  me: PlayerState
): GameCommand | null {
  if (me.economy.gold < 25) return null;
  return { type: 'AcquireCityProperty', campaignId: '', tier: 'medium' };
}

function buildAcquireDomainSmallCommand(me: PlayerState): GameCommand | null {
  if (me.economy.gold < 25) return null;
  return { type: 'AcquireDomain', campaignId: '', tier: 'small' };
}

function buildAcquireUnderworldCommand(me: PlayerState): GameCommand | null {
  // Requires city HQ tier >= target tier; engine handles exact checks.
  if (me.economy.gold < 16) return null;
  return { type: 'AcquireOrganization', campaignId: '', kind: 'underworld' };
}

function buildAcquireCollegiumTradeCommand(
  me: PlayerState
): GameCommand | null {
  if (me.economy.gold < 20) return null;
  return {
    type: 'AcquireOrganization',
    campaignId: '',
    kind: 'collegiumTrade',
  };
}

function buildAcquireCollegiumCraftCommand(
  me: PlayerState
): GameCommand | null {
  if (me.economy.gold < 20) return null;
  return {
    type: 'AcquireOrganization',
    campaignId: '',
    kind: 'collegiumCraft',
  };
}

function buildAcquireTenantsForCityCommand(
  me: PlayerState
): GameCommand | null {
  const city = me.holdings.cityProperties.find(
    (c) =>
      c.tenants.levels < (c.tier === 'small' ? 2 : c.tier === 'medium' ? 3 : 4)
  );
  if (!city) return null;
  return {
    type: 'AcquireTenants',
    campaignId: '',
    location: { kind: 'cityProperty', id: city.id },
    levels: 1,
  };
}

export const builderAgent: Agent = {
  id: 'builder',
  name: 'Baumeister',
  decideFacility(ctx) {
    return (
      buildUpgradeStarterDomainCommand(ctx.me) ??
      buildSmallStorageCommand(ctx.me)
    );
  },
  decideActions(ctx) {
    const me = ctx.me;
    return [
      buildAcquireOfficeSmallCommand(me),
      buildMoneySellCommand(ctx, { preferKind: 'raw' }),
      buildGainMaterialsCommand(me, 'domainAdministration'),
      buildLendMoneyCommand(me),
      buildGainInfluenceCommand(me),
    ].filter(Boolean) as GameCommand[];
  },
};

export const merchantAgent: Agent = {
  id: 'merchant',
  name: 'Händler',
  decideFacility(ctx) {
    return (
      buildUpgradeStarterDomainCommand(ctx.me) ??
      buildSmallStorageCommand(ctx.me)
    );
  },
  decideActions(ctx) {
    const me = ctx.me;
    return [
      buildAcquireTradeEnterpriseSmallCommand(me),
      buildAcquireCollegiumTradeCommand(me),
      buildMoneySellCommand(ctx, { preferKind: 'any' }),
      buildLendMoneyCommand(me),
      buildGainMaterialsCommand(me, 'domainAdministration'),
      buildGainInfluenceCommand(me),
    ].filter(Boolean) as GameCommand[];
  },
};

export const courtierAgent: Agent = {
  id: 'courtier',
  name: 'Höfling',
  decideFacility(ctx) {
    return buildUpgradeStarterDomainCommand(ctx.me);
  },
  decideActions(ctx) {
    const me = ctx.me;
    return [
      buildAcquireOfficeSmallCommand(me),
      buildGainInfluenceCommand(me),
      buildLendMoneyCommand(me),
      buildMoneySellCommand(ctx, { preferKind: 'raw' }),
      buildGainMaterialsCommand(me, 'domainAdministration'),
    ].filter(Boolean) as GameCommand[];
  },
};

export const randomAgent: Agent = {
  id: 'random',
  name: 'Zufall',
  decideFacility(ctx) {
    // Deterministic "random": alternate upgrade/storage.
    if (ctx.round % 2 === 1) return buildUpgradeStarterDomainCommand(ctx.me);
    return buildSmallStorageCommand(ctx.me);
  },
  decideActions(ctx) {
    const me = ctx.me;
    const base = [
      buildMoneySellCommand(ctx, { preferKind: 'any' }),
      buildLendMoneyCommand(me),
      buildGainMaterialsCommand(me, 'domainAdministration'),
      buildGainMaterialsCommand(me, 'workshopOversight'),
      buildGainInfluenceCommand(me),
      buildAcquireOfficeSmallCommand(me),
      buildAcquireDomainSmallCommand(me),
      buildAcquireCityPropertyMediumCommand(me),
      buildAcquireTenantsForCityCommand(me),
    ].filter(Boolean) as GameCommand[];

    // Rotate by round to avoid always the same.
    const shift = (ctx.round - 1) % Math.max(1, base.length);
    return [...base.slice(shift), ...base.slice(0, shift)];
  },
};

export const speculatorAgent: Agent = {
  id: 'speculator',
  name: 'Spekulant',
  decideFacility(ctx) {
    return (
      buildSmallStorageCommand(ctx.me) ??
      buildUpgradeStarterDomainCommand(ctx.me)
    );
  },
  decideActions(ctx) {
    const me = ctx.me;
    return [
      // Sell in the best order (market-aware scoring).
      buildMoneySellCommand(ctx, { preferKind: 'any' }),
      buildLendMoneyCommand(me),
      buildGainMaterialsCommand(me, 'domainAdministration'),
      buildGainMaterialsCommand(me, 'workshopOversight'),
      buildGainInfluenceCommand(me),
    ].filter(Boolean) as GameCommand[];
  },
};

export const officeFocusAgent: Agent = {
  id: 'officeFocus',
  name: 'Amtsfokus',
  decideFacility(ctx) {
    return buildUpgradeStarterDomainCommand(ctx.me);
  },
  decideActions(ctx) {
    const me = ctx.me;
    return [
      buildAcquireOfficeSmallCommand(me),
      buildGainInfluenceCommand(me),
      buildLendMoneyCommand(me),
      buildMoneySellCommand(ctx, { preferKind: 'raw' }),
      buildAcquireCityPropertyMediumCommand(me),
      buildAcquireDomainSmallCommand(me),
      buildGainMaterialsCommand(me, 'domainAdministration'),
    ].filter(Boolean) as GameCommand[];
  },
};

export const tradeFocusAgent: Agent = {
  id: 'tradeFocus',
  name: 'Handel & Geld',
  decideFacility(ctx) {
    return (
      buildUpgradeStarterDomainCommand(ctx.me) ??
      buildSmallStorageCommand(ctx.me)
    );
  },
  decideActions(ctx) {
    const me = ctx.me;
    return [
      buildAcquireTradeEnterpriseSmallCommand(me),
      buildAcquireCollegiumTradeCommand(me),
      buildMoneySellCommand(ctx, { preferKind: 'any' }),
      buildLendMoneyCommand(me),
      buildGainMaterialsCommand(me, 'domainAdministration'),
      buildGainInfluenceCommand(me),
    ].filter(Boolean) as GameCommand[];
  },
};

export const cityUnderworldAgent: Agent = {
  id: 'cityUnderworld',
  name: 'Stadt & Unterwelt',
  decideFacility(ctx) {
    return buildUpgradeStarterDomainCommand(ctx.me);
  },
  decideActions(ctx) {
    const me = ctx.me;
    return [
      buildAcquireCityPropertyMediumCommand(me),
      buildAcquireUnderworldCommand(me),
      buildAcquireTenantsForCityCommand(me),
      buildMoneySellCommand(ctx, { preferKind: 'raw' }),
      buildLendMoneyCommand(me),
      buildGainInfluenceCommand(me),
      buildGainMaterialsCommand(me, 'domainAdministration'),
    ].filter(Boolean) as GameCommand[];
  },
};

export const workshopFocusAgent: Agent = {
  id: 'workshopFocus',
  name: 'Werkstattfokus',
  decideFacility(ctx) {
    return (
      buildUpgradeStarterDomainCommand(ctx.me) ??
      buildSmallStorageCommand(ctx.me)
    );
  },
  decideActions(ctx) {
    const me = ctx.me;
    return [
      buildAcquireCollegiumCraftCommand(me),
      buildGainMaterialsCommand(me, 'workshopOversight'),
      buildMoneySellCommand(ctx, { preferKind: 'special' }),
      buildMoneySellCommand(ctx, { preferKind: 'raw' }),
      buildLendMoneyCommand(me),
      buildGainInfluenceCommand(me),
    ].filter(Boolean) as GameCommand[];
  },
};

export const domainFocusAgent: Agent = {
  id: 'domainFocus',
  name: 'Domänenfokus',
  decideFacility(ctx) {
    return (
      buildUpgradeStarterDomainCommand(ctx.me) ??
      buildSmallStorageCommand(ctx.me)
    );
  },
  decideActions(ctx) {
    const me = ctx.me;
    return [
      buildAcquireDomainSmallCommand(me),
      buildGainMaterialsCommand(me, 'domainAdministration'),
      buildMoneySellCommand(ctx, { preferKind: 'raw' }),
      buildLendMoneyCommand(me),
      buildGainInfluenceCommand(me),
    ].filter(Boolean) as GameCommand[];
  },
};

export const plannerOfficeAgent: Agent = createPlannerAgent({
  id: 'plannerOffice',
  name: 'Planner: Amtsfokus',
  weights: { ...DEFAULT_NET_WORTH_WEIGHTS, influence: 0.4, labor: 0.45 },
  depth: 2,
  rollouts: 2,
  maxActionCandidates: 40,
  maxFacilityCandidates: 10,
});

export const plannerTradeAgent: Agent = createPlannerAgent({
  id: 'plannerTrade',
  name: 'Planner: Handel & Geld',
  weights: {
    ...DEFAULT_NET_WORTH_WEIGHTS,
    gold: 1.1,
    pendingGold: 1.0,
    influence: 0.15,
    labor: 0.35,
  },
  depth: 2,
  rollouts: 2,
  maxActionCandidates: 40,
  maxFacilityCandidates: 10,
});

export const plannerCityAgent: Agent = createPlannerAgent({
  id: 'plannerCity',
  name: 'Planner: Stadt & Unterwelt',
  weights: {
    ...DEFAULT_NET_WORTH_WEIGHTS,
    influence: 0.3,
    labor: 0.45,
    storageCapacityGoldEq: 0.06,
  },
  depth: 2,
  rollouts: 2,
  maxActionCandidates: 40,
  maxFacilityCandidates: 10,
});

export const plannerWorkshopAgent: Agent = createPlannerAgent({
  id: 'plannerWorkshop',
  name: 'Planner: Werkstattfokus',
  weights: {
    ...DEFAULT_NET_WORTH_WEIGHTS,
    inventoryGoldEq: 1.15,
    labor: 0.6,
    storageCapacityGoldEq: 0.08,
  },
  depth: 2,
  rollouts: 2,
  maxActionCandidates: 40,
  maxFacilityCandidates: 10,
});

export const plannerDomainAgent: Agent = createPlannerAgent({
  id: 'plannerDomain',
  name: 'Planner: Domänenfokus',
  weights: {
    ...DEFAULT_NET_WORTH_WEIGHTS,
    labor: 0.8,
    storageCapacityGoldEq: 0.12,
    influence: 0.2,
  },
  depth: 2,
  rollouts: 2,
  maxActionCandidates: 40,
  maxFacilityCandidates: 10,
});
