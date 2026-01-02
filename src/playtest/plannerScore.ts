import type { CampaignState, MaterialStock, PlayerState } from '../core';

import { rawAutoConvertDivisor } from '../core/rules/eventModifiers_v1';
import {
  cityGoldPerRound,
  cityGoldUpkeep,
  cityInfluencePerRound,
  cityLaborPerRound,
  domainGoldUpkeep,
  domainLaborPerRound,
  domainRawPerRound,
  facilityInfluencePerRound,
  officesIncomePerRound,
  postTierRank,
  storageCapacity,
  workshopCapacity,
  workshopUpkeep,
} from '../core/rules/v1';

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

const ROI_ROUNDS = 10;
const RAW_GOLD_EQ = 0.25;
const SPECIAL_GOLD_EQ = 2;
const INFLUENCE_GOLD_EQ = 0.6;
const LABOR_GOLD_EQ = 2;
const COMBAT_POWER_GOLD_EQ = 8;
const MAGIC_POWER_GOLD_EQ = 0;

export const DEFAULT_NET_WORTH_WEIGHTS: NetWorthWeights = {
  gold: 1,
  pendingGold: 0.9,
  inventoryGoldEq: 1,
  pendingInventoryGoldEq: 0.9,
  labor: LABOR_GOLD_EQ,
  permanentLabor: LABOR_GOLD_EQ * ROI_ROUNDS,
  influence: INFLUENCE_GOLD_EQ,
  permanentInfluence: INFLUENCE_GOLD_EQ * ROI_ROUNDS,
  storageCapacityGoldEq: 1,
  combatPower: COMBAT_POWER_GOLD_EQ,
  magicPower: MAGIC_POWER_GOLD_EQ,
  pendingMagicPower: MAGIC_POWER_GOLD_EQ,
  assetsGoldEq: 1,
};

export const FULL_NET_WORTH_WEIGHTS: NetWorthWeights = {
  ...DEFAULT_NET_WORTH_WEIGHTS,
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
  bonuses: number;
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
    const divisor = rawAutoConvertDivisor(
      materialId,
      state.globalEvents,
      state.round
    );
    value += c / Math.max(1, divisor);
  }
  return value;
}

function specialStockGoldEq(stock: MaterialStock): number {
  let value = 0;
  for (const count of Object.values(stock)) value += 2 * (count ?? 0);
  return value;
}

function inventoryGoldEq(
  state: CampaignState,
  me: PlayerState['economy']['inventory']
): number {
  return rawStockGoldEq(state, me.raw) + specialStockGoldEq(me.special);
}

function pendingInventoryGoldEq(
  state: CampaignState,
  me: PlayerState['economy']['pending']
): number {
  return rawStockGoldEq(state, me.raw) + specialStockGoldEq(me.special);
}

function storageCapacityGoldEq(
  state: CampaignState,
  player: PlayerState
): number {
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
  return rawCap * RAW_GOLD_EQ + specialCap * SPECIAL_GOLD_EQ;
}

function combatPower(player: PlayerState): number {
  // Rough proxy for "military options": bodyguards and mercenaries count more than militia/thugs.
  const t = player.holdings.troops;
  return (
    t.bodyguardLevels * 2 +
    t.mercenaryLevels * 1.5 +
    t.militiaLevels * 1 +
    t.thugLevels * 0.75
  );
}

const DC_BONUS_GOLD_EQ_PER_ACTION = 0.5;
const BONUS_ACTION_GOLD_EQ = {
  money: 4,
  influence: 2,
  materials: 2,
};

function domainBaseCost(tier: string): number {
  return tier === 'small'
    ? 35
    : tier === 'medium'
      ? 80
      : tier === 'large'
        ? 120
        : 0;
}

function cityBaseCost(tier: string): number {
  return tier === 'small'
    ? 15
    : tier === 'medium'
      ? 25
      : tier === 'large'
        ? 50
        : 0;
}

function tradeBaseCost(tier: string): number {
  return tier === 'small'
    ? 20
    : tier === 'medium'
      ? 40
      : tier === 'large'
        ? 80
        : 0;
}

function workshopBaseCost(tier: string): number {
  return tier === 'small'
    ? 8
    : tier === 'medium'
      ? 16
      : tier === 'large'
        ? 40
        : 0;
}

function storageBaseCost(tier: string): number {
  return tier === 'small'
    ? 8
    : tier === 'medium'
      ? 16
      : tier === 'large'
        ? 40
        : 0;
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
  const rank =
    tier === 'small' ? 1 : tier === 'medium' ? 2 : tier === 'large' ? 3 : 0;
  if (rank === 0) return 0;
  const base =
    kind === 'cult'
      ? { gold: 10, influence: 6 }
      : kind.startsWith('collegium')
        ? { gold: 20, influence: 2 }
        : { gold: 16, influence: 6 };
  return base.gold * rank + base.influence * rank * INFLUENCE_GOLD_EQ;
}

function officeIncomeGoldEq(
  state: CampaignState,
  office: PlayerState['holdings']['offices'][number]
): number {
  const inc = officesIncomePerRound(office.tier, office.yieldMode, state.rules);
  return inc.gold + inc.influence * INFLUENCE_GOLD_EQ;
}

function cityIncomeGoldEq(
  city: PlayerState['holdings']['cityProperties'][number]
): number {
  const gold = cityGoldPerRound(city.tier, city.mode);
  const influence =
    cityInfluencePerRound(city.tier, city.mode) * INFLUENCE_GOLD_EQ;
  const labor = cityLaborPerRound(city.tier, city.mode) * LABOR_GOLD_EQ;
  const upkeep = cityGoldUpkeep(city.tier, city.mode);
  return gold + influence + labor - upkeep;
}

function domainIncomeGoldEq(
  domain: PlayerState['holdings']['domains'][number]
): number {
  const raw = domainRawPerRound(domain.tier) * RAW_GOLD_EQ;
  const labor = domainLaborPerRound(domain.tier) * LABOR_GOLD_EQ;
  const upkeep = domainGoldUpkeep(domain.tier);
  return raw + labor - upkeep;
}

function orgIncomeGoldEq(
  holdings: PlayerState['holdings'],
  org: PlayerState['holdings']['organizations'][number]
): number {
  if (org.followers.inUnrest) return 0;
  const tier = postTierRank(org.tier);
  if (org.kind === 'spy') {
    const permanent = tier === 2 ? 1 : tier === 3 ? 2 : 0;
    return (6 * tier + permanent) * INFLUENCE_GOLD_EQ;
  }
  if (org.kind === 'cult') {
    const permanent = tier === 2 ? 2 : tier === 3 ? 4 : 0;
    return (5 * tier + permanent) * INFLUENCE_GOLD_EQ;
  }
  if (org.kind === 'underworld') {
    const cityRank = Math.max(
      0,
      ...holdings.cityProperties.map((c) => postTierRank(c.tier))
    );
    const per = tier === 1 ? 1 : tier === 2 ? 2 : 3;
    const goldPer = tier === 1 ? 4 : tier === 2 ? 5 : 6;
    const influence = per * tier * cityRank;
    const gold = goldPer * tier * cityRank;
    return gold + influence * INFLUENCE_GOLD_EQ;
  }
  return 0;
}

function tradeIncomeGoldEq(
  te: PlayerState['holdings']['tradeEnterprises'][number]
): number {
  if (te.damage) return 0;
  const gold = te.tier === 'small' ? 4 : te.tier === 'medium' ? 10 : 24;
  const tradeSpecialIn = te.tier === 'small' ? 1 : te.tier === 'medium' ? 2 : 4;
  const produceSpecialOut =
    te.tier === 'small' ? 3 : te.tier === 'medium' ? 6 : 12;
  const upkeepGold = te.tier === 'small' ? 2 : te.tier === 'medium' ? 4 : 6;
  const upkeepLabor = te.tier === 'small' ? 0 : te.tier === 'medium' ? 1 : 2;
  const upkeep = upkeepGold + upkeepLabor * LABOR_GOLD_EQ;
  if (te.mode === 'produce')
    return produceSpecialOut * SPECIAL_GOLD_EQ - upkeep;
  // "Trade": consumes Sondermaterial (opportunity cost) for gold (plus market/event deltas not modeled here).
  return gold - tradeSpecialIn * SPECIAL_GOLD_EQ - upkeep;
}

function workshopIncomeGoldEq(
  workshop: PlayerState['holdings']['workshops'][number]
): number {
  const cap = workshopCapacity(workshop.tier);
  const upkeep = workshopUpkeep(workshop.tier);
  const output = cap.specialOutMax * SPECIAL_GOLD_EQ;
  const input = cap.rawIn * RAW_GOLD_EQ;
  return output - input - (upkeep.gold + upkeep.labor * LABOR_GOLD_EQ);
}

function facilityGoldCost(key: string): number {
  const [category, size] = key.split('.', 2);
  if (category === 'general') {
    return size === 'small'
      ? 8
      : size === 'medium'
        ? 12
        : size === 'large'
          ? 30
          : 0;
  }
  if (category === 'special') {
    return size === 'small'
      ? 10
      : size === 'medium'
        ? 20
        : size === 'large'
          ? 40
          : 0;
  }
  return 0;
}

function tenantCostGoldEq(
  goldPerLevel: number,
  influencePerLevel: number,
  levels: number
): number {
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

function dcBonusGoldEqPerRound(player: PlayerState): number {
  let bonus = 0;

  const hasTradeSmall = player.holdings.tradeEnterprises.some(
    (t) => t.tier === 'small'
  );
  const hasTradeMedium = player.holdings.tradeEnterprises.some(
    (t) => t.tier === 'medium'
  );
  const hasTradeLarge = player.holdings.tradeEnterprises.some(
    (t) => t.tier === 'large'
  );
  if (hasTradeSmall) bonus += DC_BONUS_GOLD_EQ_PER_ACTION;
  if (hasTradeMedium) bonus += DC_BONUS_GOLD_EQ_PER_ACTION;
  if (hasTradeLarge) bonus += DC_BONUS_GOLD_EQ_PER_ACTION;

  const collegiumTrade = player.holdings.organizations.find(
    (o) => o.kind === 'collegiumTrade'
  );
  if (collegiumTrade)
    bonus +=
      DC_BONUS_GOLD_EQ_PER_ACTION * 2 * postTierRank(collegiumTrade.tier);

  const hasOfficeSmall = player.holdings.offices.some(
    (o) => o.tier === 'small'
  );
  const hasOfficeMedium = player.holdings.offices.some(
    (o) => o.tier === 'medium'
  );
  const hasOfficeLarge = player.holdings.offices.some(
    (o) => o.tier === 'large'
  );
  const hasCitySmall = player.holdings.cityProperties.some(
    (c) => c.tier === 'small' && c.mode === 'leased'
  );
  const hasCityMedium = player.holdings.cityProperties.some(
    (c) => c.tier === 'medium' && c.mode === 'leased'
  );
  const hasCityLarge = player.holdings.cityProperties.some(
    (c) => c.tier === 'large' && c.mode === 'leased'
  );
  if (hasOfficeSmall || hasCitySmall) bonus += DC_BONUS_GOLD_EQ_PER_ACTION;
  if (hasOfficeMedium || hasCityMedium) bonus += DC_BONUS_GOLD_EQ_PER_ACTION;
  if (hasOfficeLarge || hasCityLarge) bonus += DC_BONUS_GOLD_EQ_PER_ACTION;

  const cult = player.holdings.organizations.find((o) => o.kind === 'cult');
  if (cult) bonus += DC_BONUS_GOLD_EQ_PER_ACTION * postTierRank(cult.tier);

  const hasDomainSmall = player.holdings.domains.some(
    (d) => d.tier === 'small'
  );
  const hasDomainMedium = player.holdings.domains.some(
    (d) => d.tier === 'medium'
  );
  const hasDomainLarge = player.holdings.domains.some(
    (d) => d.tier === 'large'
  );
  if (hasDomainSmall) bonus += DC_BONUS_GOLD_EQ_PER_ACTION;
  if (hasDomainMedium) bonus += DC_BONUS_GOLD_EQ_PER_ACTION;
  if (hasDomainLarge) bonus += DC_BONUS_GOLD_EQ_PER_ACTION;

  const collegiumCraft = player.holdings.organizations.find(
    (o) => o.kind === 'collegiumCraft'
  );
  if (collegiumCraft)
    bonus +=
      DC_BONUS_GOLD_EQ_PER_ACTION * 2 * postTierRank(collegiumCraft.tier);

  return bonus;
}

function bonusActionsGoldEqPerRound(player: PlayerState): number {
  const largeOffices = player.holdings.offices.filter(
    (o) => o.tier === 'large'
  ).length;
  const hasLargeCult = player.holdings.organizations.some(
    (o) => o.kind === 'cult' && o.tier === 'large' && !o.followers.inUnrest
  );
  const bonusInfluence = largeOffices + (hasLargeCult ? 1 : 0);

  const bonusMoney = player.holdings.organizations.some(
    (o) =>
      o.kind === 'collegiumTrade' && o.tier === 'large' && !o.followers.inUnrest
  )
    ? 1
    : 0;

  const bonusMaterials = player.holdings.organizations.some(
    (o) =>
      o.kind === 'collegiumCraft' && o.tier === 'large' && !o.followers.inUnrest
  )
    ? 1
    : 0;

  return (
    bonusInfluence * BONUS_ACTION_GOLD_EQ.influence +
    bonusMoney * BONUS_ACTION_GOLD_EQ.money +
    bonusMaterials * BONUS_ACTION_GOLD_EQ.materials
  );
}

function domainSpecializationGoldEq(
  state: CampaignState,
  player: PlayerState
): number {
  let value = 0;
  for (const domain of player.holdings.domains) {
    const spec = domain.specialization;
    if (!spec) continue;
    if (spec.kind === 'agriculture') {
      const rawId = spec.picks?.costRawId ?? 'raw.grain';
      value += 10 + rawStockGoldEq(state, { [rawId]: 2 });
    } else if (spec.kind === 'animalHusbandry') {
      value += 15 + rawStockGoldEq(state, { 'raw.pigsSheepVarken': 4 });
    } else if (spec.kind === 'forestry') {
      value += 6;
    } else if (spec.kind === 'mining') {
      value += 20 + rawStockGoldEq(state, { 'raw.wood': 4 });
    }
  }
  return value;
}

function assetsGoldEq(
  state: CampaignState,
  player: PlayerState
): { total: number; breakdown: AssetBreakdown } {
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
  let bonuses = 0;

  for (const d of player.holdings.domains) {
    domains += domainBaseCost(d.tier) + domainIncomeGoldEq(d) * ROI_ROUNDS;
    tenants += tenantCostGoldEq(12, 4, d.tenants.levels);
    for (const f of d.facilities) facilities += facilityGoldCost(f.key);
    if (d.specialization) {
      for (const f of d.specialization.facilities)
        facilities += facilityGoldCost(f.key);
    }
  }

  for (const c of player.holdings.cityProperties) {
    cityProperties += cityBaseCost(c.tier) + cityIncomeGoldEq(c) * ROI_ROUNDS;
    tenants += tenantCostGoldEq(12, 4, c.tenants.levels);
    for (const f of c.facilities) facilities += facilityGoldCost(f.key);
    if (c.specialization) {
      for (const f of c.specialization.facilities)
        facilities += facilityGoldCost(f.key);
    }
  }

  for (const o of player.holdings.offices) {
    let facilityInfluence = 0;
    for (const f of o.facilities)
      facilityInfluence += facilityInfluencePerRound(f.key, 'office');
    if (o.specialization) {
      for (const f of o.specialization.facilities)
        facilityInfluence += facilityInfluencePerRound(f.key, 'office');
    }
    const facilityIncome = facilityInfluence * INFLUENCE_GOLD_EQ;
    offices +=
      officeCostGoldEq(o.tier) +
      (officeIncomeGoldEq(state, o) + facilityIncome) * ROI_ROUNDS;
    for (const f of o.facilities) facilities += facilityGoldCost(f.key);
    if (o.specialization) {
      for (const f of o.specialization.facilities)
        facilities += facilityGoldCost(f.key);
    }
  }

  for (const org of player.holdings.organizations) {
    let facilityInfluence = 0;
    for (const f of org.facilities)
      facilityInfluence += facilityInfluencePerRound(f.key, 'organization');
    const facilityIncome = facilityInfluence * INFLUENCE_GOLD_EQ;
    organizations +=
      orgCostGoldEq(org.kind, org.tier) +
      (orgIncomeGoldEq(player.holdings, org) + facilityIncome) * ROI_ROUNDS;
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
    let facilityInfluence = 0;
    if (!t.damage) {
      for (const f of t.facilities)
        facilityInfluence += facilityInfluencePerRound(
          f.key,
          'tradeEnterprise'
        );
    }
    const facilityIncome = t.damage ? 0 : facilityInfluence * INFLUENCE_GOLD_EQ;
    const baseCost = tradeBaseCost(t.tier);
    const adjustedCost = t.damage
      ? Math.max(0, baseCost - t.damage.repairCostGold)
      : baseCost;
    tradeEnterprises +=
      adjustedCost + (tradeIncomeGoldEq(t) + facilityIncome) * ROI_ROUNDS;
    for (const f of t.facilities) facilities += facilityGoldCost(f.key);
  }

  for (const w of player.holdings.workshops) {
    let facilityInfluence = 0;
    for (const f of w.facilities)
      facilityInfluence += facilityInfluencePerRound(f.key, 'workshop');
    const facilityIncome = facilityInfluence * INFLUENCE_GOLD_EQ;
    workshops +=
      workshopBaseCost(w.tier) +
      (workshopIncomeGoldEq(w) + facilityIncome) * ROI_ROUNDS;
    for (const f of w.facilities) facilities += facilityGoldCost(f.key);
  }

  for (const s of player.holdings.storages) {
    storages += storageBaseCost(s.tier);
    for (const f of s.facilities) facilities += facilityGoldCost(f.key);
  }

  for (const spec of player.holdings.specialists) {
    specialists +=
      spec.tier === 'simple' ? 10 : spec.tier === 'experienced' ? 25 : 50;
  }

  for (const f of player.holdings.troops.facilities)
    facilities += facilityGoldCost(f.key);
  troops += troopCostGoldEq(player);

  domainSpecializations = domainSpecializationGoldEq(state, player);
  bonuses =
    (dcBonusGoldEqPerRound(player) + bonusActionsGoldEqPerRound(player)) *
    ROI_ROUNDS;

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
    bonuses,
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
    domainSpecializations +
    bonuses;

  return { total, breakdown };
}

export function computeNetWorth(
  state: CampaignState,
  player: PlayerState,
  weights: NetWorthWeights = DEFAULT_NET_WORTH_WEIGHTS
): NetWorthBreakdown {
  const assets = assetsGoldEq(state, player);
  const breakdown: Omit<NetWorthBreakdown, 'score'> = {
    gold: player.economy.gold,
    pendingGold: player.economy.pending.gold,
    inventoryGoldEq: inventoryGoldEq(state, player.economy.inventory),
    pendingInventoryGoldEq: pendingInventoryGoldEq(
      state,
      player.economy.pending
    ),
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
