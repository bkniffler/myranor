import type { MaterialStock, PostTier } from '../domain/types';

export type FacilityCategory = 'general' | 'special';

export type FacilityKeyParts = {
  category: FacilityCategory;
  tier: PostTier;
  rest: string;
};

export type FacilityCost = {
  gold: number;
  influence: number;
  labor: number;
  raw: MaterialStock;
  special: MaterialStock;
  magicPower: number;
};

export type FacilityBuildTime = {
  rounds: number;
  laborPerRound: number;
  magicPowerPerRound: number;
};

export function parseFacilityKey(key: string): FacilityKeyParts | null {
  const parts = key.split('.');
  if (parts.length < 2) return null;
  const category = parts[0];
  if (category !== 'general' && category !== 'special') return null;
  const tier = parts[1];
  if (tier !== 'small' && tier !== 'medium' && tier !== 'large') return null;
  const rest = parts.slice(2).join('.');
  return { category, tier, rest };
}

export function defaultFacilityGoldCost(
  category: FacilityCategory,
  tier: PostTier
): number {
  if (category === 'general')
    return tier === 'small' ? 8 : tier === 'medium' ? 12 : 30;
  return tier === 'small' ? 10 : tier === 'medium' ? 20 : 40;
}

/**
 * v1: Facility-Kosten (BuildFacility).
 *
 * Hinweis: Viele Facilities sind in v1 noch generisch (Default-Kosten nach Tier).
 * Spezifische Keys werden schrittweise aus `docs/rules/soll/facilities.md` umgesetzt.
 */
export function facilityBuildCostV1(facilityKey: string): FacilityCost | null {
  const parsed = parseFacilityKey(facilityKey);
  if (!parsed) return null;

  const cost: FacilityCost = {
    gold: defaultFacilityGoldCost(parsed.category, parsed.tier),
    influence: 0,
    labor: 0,
    raw: {},
    special: {},
    magicPower: 0,
  };

  // Soll: Administrative Reformen (Amt, ab mittlerem Amt)
  if (facilityKey === 'general.medium.office.administrativeReforms') {
    cost.gold = 20;
    cost.influence = 40;
  }

  // Soll: Insulaebau (Stadt, ab mittlerem Besitz; Langzeitvorhaben)
  if (facilityKey === 'general.medium.city.insulae') {
    cost.gold = 14;
    cost.raw = { 'raw.bricks': 30, 'raw.lumber': 15 };
  }

  // Soll: Gasse der Kunsthandwerker (spezielle Stadt-Einrichtung)
  if (facilityKey === 'special.medium.artisanAlley') {
    cost.gold = 0;
    cost.special = { 'special.specialTools': 2 };
  }

  return cost;
}

export function facilityBuildTimeV1(
  facilityKey: string
): FacilityBuildTime | null {
  // Soll: Insulaebau (4 Baurunden à 2 AK)
  if (facilityKey === 'general.medium.city.insulae') {
    return { rounds: 4, laborPerRound: 2, magicPowerPerRound: 0 };
  }

  return null;
}
