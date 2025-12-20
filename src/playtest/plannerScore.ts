import type { CampaignState, MaterialStock, PlayerState } from '../core';

import { rawAutoConvertDivisor } from '../core/rules/eventModifiers_v1';
import { storageCapacity } from '../core/rules/v1';

export type NetWorthWeights = {
  gold: number;
  pendingGold: number;
  inventoryGoldEq: number;
  pendingInventoryGoldEq: number;
  labor: number;
  permanentLabor: number;
  influence: number;
  permanentInfluence: number;
  storageCapacityGoldEq: number;
  combatPower: number;
  magicPower: number;
  pendingMagicPower: number;
  assetsGoldEq: number;
};

export const DEFAULT_NET_WORTH_WEIGHTS: NetWorthWeights = {
  gold: 1,
  pendingGold: 0.9,
  inventoryGoldEq: 1,
  pendingInventoryGoldEq: 0.75,
  labor: 0.5,
  permanentLabor: 0,
  influence: 0.25,
  permanentInfluence: 0,
  storageCapacityGoldEq: 0.05,
  combatPower: 0.25,
  magicPower: 0,
  pendingMagicPower: 0,
  assetsGoldEq: 0,
};

export const FULL_NET_WORTH_WEIGHTS: NetWorthWeights = {
  ...DEFAULT_NET_WORTH_WEIGHTS,
  permanentLabor: 0.5,
  permanentInfluence: 0.25,
  magicPower: 1,
  pendingMagicPower: 0.75,
  assetsGoldEq: 1,
};

export type AssetBreakdown = {
  domains: number;
  cityProperties: number;
  offices: number;
  organizations: number;
  tradeEnterprises: number;
  workshops: number;
  storages: number;
  specialists: number;
  troops: number;
  tenants: number;
  followers: number;
  facilities: number;
  domainSpecializations: number;
};

export type NetWorthBreakdown = {
  gold: number;
  pendingGold: number;
  inventoryGoldEq: number;
  pendingInventoryGoldEq: number;
  labor: number;
  permanentLabor: number;
  influence: number;
  permanentInfluence: number;
  storageCapacityGoldEq: number;
  combatPower: number;
  magicPower: number;
  pendingMagicPower: number;
  assetsGoldEq: number;
  assets: AssetBreakdown;
  score: number;
};

function rawStockGoldEq(state: CampaignState, stock: MaterialStock): number {
  let value = 0;
  for (const [materialId, count] of Object.entries(stock)) {
    const c = count ?? 0;
    if (c <= 0) continue;
    const divisor = rawAutoConvertDivisor(materialId, state.globalEvents, state.round);
    value += c / Math.max(1, divisor);
  }
  return value;
}

function specialStockGoldEq(stock: MaterialStock): number {
  let value = 0;
  for (const count of Object.values(stock)) value += 2 * (count ?? 0);
  return value;
}

function inventoryGoldEq(state: CampaignState, me: PlayerState['economy']['inventory']): number {
  return rawStockGoldEq(state, me.raw) + specialStockGoldEq(me.special);
}

function pendingInventoryGoldEq(state: CampaignState, me: PlayerState['economy']['pending']): number {
  return rawStockGoldEq(state, me.raw) + specialStockGoldEq(me.special);
}

function storageCapacityGoldEq(state: CampaignState, player: PlayerState): number {
  const ids = new Set(player.turn.upkeep.maintainedStorageIds);
  let rawCap = 0;
  let specialCap = 0;
  for (const s of player.holdings.storages) {
    if (!ids.has(s.id)) continue;
    const cap = storageCapacity(s.tier, state.rules);
    rawCap += cap.raw;
    specialCap += cap.special;
  }
  // Treat capacity as "potentially preservable value" at auto-conversion rates.
  return rawCap / 4 + specialCap * 2;
}

function combatPower(player: PlayerState): number {
  // Rough proxy for "military options": bodyguards and mercenaries count more than militia/thugs.
  const t = player.holdings.troops;
  return t.bodyguardLevels * 2 + t.mercenaryLevels * 1.5 + t.militiaLevels * 1 + t.thugLevels * 0.75;
}

const INFLUENCE_GOLD_EQ = 0.25;

function domainBaseCost(tier: string): number {
  return tier === 'small' ? 35 : tier === 'medium' ? 80 : tier === 'large' ? 120 : 0;
}

function cityBaseCost(tier: string): number {
  return tier === 'small' ? 15 : tier === 'medium' ? 25 : tier === 'large' ? 50 : 0;
}

function tradeBaseCost(tier: string): number {
  return tier === 'small' ? 20 : tier === 'medium' ? 40 : tier === 'large' ? 80 : 0;
}

function workshopBaseCost(tier: string): number {
  return tier === 'small' ? 8 : tier === 'medium' ? 16 : tier === 'large' ? 40 : 0;
}

function storageBaseCost(tier: string): number {
  return tier === 'small' ? 8 : tier === 'medium' ? 16 : tier === 'large' ? 40 : 0;
}

function officeCostGoldEq(tier: string): number {
  const cost =
    tier === 'small'
      ? [
          { gold: 8, influence: 2 },
          { gold: 4, influence: 8 },
        ]
      : tier === 'medium'
        ? [
            { gold: 18, influence: 8 },
            { gold: 10, influence: 18 },
          ]
        : tier === 'large'
          ? [
              { gold: 70, influence: 20 },
              { gold: 24, influence: 70 },
            ]
          : [];
  if (cost.length === 0) return 0;
  const score = (c: { gold: number; influence: number }) =>
    c.gold + c.influence * INFLUENCE_GOLD_EQ;
  return Math.min(...cost.map(score));
}

function orgCostGoldEq(kind: string, tier: string): number {
  const rank = tier === 'small' ? 1 : tier === 'medium' ? 2 : tier === 'large' ? 3 : 0;
  if (rank === 0) return 0;
  const base =
    kind === 'cult'
      ? { gold: 10, influence: 6 }
      : kind.startsWith('collegium')
        ? { gold: 20, influence: 2 }
        : { gold: 16, influence: 6 };
  return base.gold * rank + base.influence * rank * INFLUENCE_GOLD_EQ;
}

function facilityGoldCost(key: string): number {
  const [category, size] = key.split('.', 2);
  if (category === 'general') {
    return size === 'small' ? 8 : size === 'medium' ? 12 : size === 'large' ? 30 : 0;
  }
  if (category === 'special') {
    return size === 'small' ? 10 : size === 'medium' ? 20 : size === 'large' ? 40 : 0;
  }
  return 0;
}

function tenantCostGoldEq(goldPerLevel: number, influencePerLevel: number, levels: number): number {
  return goldPerLevel * levels + influencePerLevel * levels * INFLUENCE_GOLD_EQ;
}

function troopCostGoldEq(player: PlayerState): number {
  const t = player.holdings.troops;
  const bodyguard = t.bodyguardLevels * (12 + 4 * INFLUENCE_GOLD_EQ + 4);
  const militia = t.militiaLevels * (6 + 2);
  const mercenary = t.mercenaryLevels * 8;
  const thug = t.thugLevels * (4 + 2 * INFLUENCE_GOLD_EQ);
  return bodyguard + militia + mercenary + thug;
}

function domainSpecializationGoldEq(state: CampaignState, player: PlayerState): number {
  let value = 0;
  for (const domain of player.holdings.domains) {
    const spec = domain.specialization;
    if (!spec) continue;
    if (spec.kind === 'agriculture') {
      const rawId = spec.picks?.costRawId ?? 'raw.grainVeg';
      value += 10 + rawStockGoldEq(state, { [rawId]: 2 });
    } else if (spec.kind === 'animalHusbandry') {
      value += 15 + rawStockGoldEq(state, { 'raw.pigsSheep': 4 });
    } else if (spec.kind === 'forestry') {
      value += 6;
    } else if (spec.kind === 'mining') {
      value += 20 + rawStockGoldEq(state, { 'raw.wood': 4 });
    }
  }
  return value;
}

function assetsGoldEq(state: CampaignState, player: PlayerState): { total: number; breakdown: AssetBreakdown } {
  let domains = 0;
  let cityProperties = 0;
  let offices = 0;
  let organizations = 0;
  let tradeEnterprises = 0;
  let workshops = 0;
  let storages = 0;
  let specialists = 0;
  let troops = 0;
  let tenants = 0;
  let followers = 0;
  let facilities = 0;
  let domainSpecializations = 0;

  for (const d of player.holdings.domains) {
    domains += domainBaseCost(d.tier);
    tenants += tenantCostGoldEq(12, 4, d.tenants.levels);
    for (const f of d.facilities) facilities += facilityGoldCost(f.key);
    if (d.specialization) {
      for (const f of d.specialization.facilities) facilities += facilityGoldCost(f.key);
    }
  }

  for (const c of player.holdings.cityProperties) {
    cityProperties += cityBaseCost(c.tier);
    tenants += tenantCostGoldEq(12, 4, c.tenants.levels);
    for (const f of c.facilities) facilities += facilityGoldCost(f.key);
    if (c.specialization) {
      for (const f of c.specialization.facilities) facilities += facilityGoldCost(f.key);
    }
  }

  for (const o of player.holdings.offices) {
    offices += officeCostGoldEq(o.tier);
    for (const f of o.facilities) facilities += facilityGoldCost(f.key);
    if (o.specialization) {
      for (const f of o.specialization.facilities) facilities += facilityGoldCost(f.key);
    }
  }

  for (const org of player.holdings.organizations) {
    organizations += orgCostGoldEq(org.kind, org.tier);
    for (const f of org.facilities) facilities += facilityGoldCost(f.key);

    if (org.kind === 'underworld') {
      followers += tenantCostGoldEq(12, 10, org.followers.levels);
    } else if (org.kind === 'cult') {
      followers += tenantCostGoldEq(8, 8, org.followers.levels);
    } else if (org.kind !== 'spy') {
      followers += tenantCostGoldEq(12, 4, org.followers.levels);
    }
  }

  for (const t of player.holdings.tradeEnterprises) {
    tradeEnterprises += tradeBaseCost(t.tier);
    for (const f of t.facilities) facilities += facilityGoldCost(f.key);
  }

  for (const w of player.holdings.workshops) {
    workshops += workshopBaseCost(w.tier);
    for (const f of w.facilities) facilities += facilityGoldCost(f.key);
  }

  for (const s of player.holdings.storages) {
    storages += storageBaseCost(s.tier);
    for (const f of s.facilities) facilities += facilityGoldCost(f.key);
  }

  for (const spec of player.holdings.specialists) {
    specialists += spec.tier === 'simple' ? 10 : spec.tier === 'experienced' ? 25 : 50;
  }

  for (const f of player.holdings.troops.facilities) facilities += facilityGoldCost(f.key);
  troops += troopCostGoldEq(player);

  domainSpecializations = domainSpecializationGoldEq(state, player);

  const breakdown: AssetBreakdown = {
    domains,
    cityProperties,
    offices,
    organizations,
    tradeEnterprises,
    workshops,
    storages,
    specialists,
    troops,
    tenants,
    followers,
    facilities,
    domainSpecializations,
  };

  const total =
    domains +
    cityProperties +
    offices +
    organizations +
    tradeEnterprises +
    workshops +
    storages +
    specialists +
    troops +
    tenants +
    followers +
    facilities +
    domainSpecializations;

  return { total, breakdown };
}

export function computeNetWorth(
  state: CampaignState,
  player: PlayerState,
  weights: NetWorthWeights = DEFAULT_NET_WORTH_WEIGHTS,
): NetWorthBreakdown {
  const assets = assetsGoldEq(state, player);
  const breakdown: Omit<NetWorthBreakdown, 'score'> = {
    gold: player.economy.gold,
    pendingGold: player.economy.pending.gold,
    inventoryGoldEq: inventoryGoldEq(state, player.economy.inventory),
    pendingInventoryGoldEq: pendingInventoryGoldEq(state, player.economy.pending),
    labor: player.turn.laborAvailable,
    permanentLabor: player.holdings.permanentLabor,
    influence: player.turn.influenceAvailable,
    permanentInfluence: player.holdings.permanentInfluence,
    storageCapacityGoldEq: storageCapacityGoldEq(state, player),
    combatPower: combatPower(player),
    magicPower: player.economy.inventory.magicPower,
    pendingMagicPower: player.economy.pending.magicPower,
    assetsGoldEq: assets.total,
    assets: assets.breakdown,
  };

  const score =
    weights.gold * breakdown.gold +
    weights.pendingGold * breakdown.pendingGold +
    weights.inventoryGoldEq * breakdown.inventoryGoldEq +
    weights.pendingInventoryGoldEq * breakdown.pendingInventoryGoldEq +
    weights.labor * breakdown.labor +
    weights.permanentLabor * breakdown.permanentLabor +
    weights.influence * breakdown.influence +
    weights.permanentInfluence * breakdown.permanentInfluence +
    weights.storageCapacityGoldEq * breakdown.storageCapacityGoldEq +
    weights.combatPower * breakdown.combatPower +
    weights.magicPower * breakdown.magicPower +
    weights.pendingMagicPower * breakdown.pendingMagicPower +
    weights.assetsGoldEq * breakdown.assetsGoldEq;

  return { ...breakdown, score };
}

export function formatNetWorthShort(b: NetWorthBreakdown): string {
  const r = (n: number) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);
  return `score=${r(b.score)} gold=${r(b.gold)} inv≈${r(b.inventoryGoldEq)} inf=${r(b.influence)} labor=${r(b.labor)} pending=${r(b.pendingGold)}`;
}
