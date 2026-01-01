import type {
  CampaignRules,
  CityPropertyMode,
  CityPropertyTenure,
  CityPropertyTier,
  DomainTier,
  MarketInstanceState,
  MarketState,
  OfficeYieldMode,
  PlayerChecks,
  PlayerEconomy,
  PlayerHoldings,
  PlayerTurn,
  PostTier,
  RulesVersion,
  StorageTier,
  TroopsState,
  WorkshopTier,
} from '../domain/types';

export const RULES_VERSION: RulesVersion = 'v1';

export const DEFAULT_CAMPAIGN_RULES: CampaignRules = {
  actionsPerRound: 2,
  freeFacilityBuildsPerRound: 1,
  // Soll: Lagerkapazitäten sind fix (siehe storageCapacity); Multiplikator ist eine optionale Hausregel.
  storageCapacityMultiplier: 1,
  // Soll: kleines Amt gibt wahlweise 4 Einfluss ODER 3 Gold (siehe officesIncomePerRound).
  officeGoldPerRound: 3,
};

export const DEFAULT_STARTER_DOMAIN_RAW_PICKS = [
  'raw.grain',
] as const;

export const DEFAULT_DOMAIN_RAW_PICKS_BY_TIER = {
  starter: ['raw.grain'],
  small: ['raw.grain', 'raw.vegetables', 'raw.buildStone'],
  medium: [
    'raw.grain',
    'raw.vegetables',
    'raw.wood',
    'raw.buildStone',
    'raw.ironOre',
  ],
  large: [
    'raw.grain',
    'raw.vegetables',
    'raw.wood',
    'raw.fruit',
    'raw.buildStone',
    'raw.ironOre',
    'raw.leather',
  ],
} as const;

export function startingMarketState(round = 1): MarketState {
  const neutral: Record<string, number> = {};
  const local: MarketInstanceState = {
    id: 'local',
    label: 'Lokaler Markt',
    raw: {
      tableRollTotal: 7,
      categoryLabel: 'Alle Materialien',
      demandLabel: 'Normal',
      modifiersByGroup: neutral,
    },
    special: {
      tableRollTotal: 7,
      categoryLabel: 'Alle Sondermaterialien',
      demandLabel: 'Normal',
      modifiersByGroup: neutral,
    },
  };
  return { round, instances: [local] };
}

export function startingPlayerChecks(): PlayerChecks {
  // Soll: Start-Attributsmodifikator +3, skaliert voraussichtlich alle 6 Runden um +1.
  return { influence: 3, money: 3, materials: 3 };
}

export function startingPlayerEconomy(): PlayerEconomy {
  return {
    gold: 4,
    information: 0,
    pending: { gold: 0, labor: 0, raw: {}, special: {}, magicPower: 0 },
    inventory: { raw: {}, special: {}, magicPower: 0 },
  };
}

function defaultFollowers(): {
  levels: number;
  loyalty: number;
  inUnrest: boolean;
} {
  return { levels: 0, loyalty: 3, inUnrest: false };
}

export function startingPlayerHoldings(): PlayerHoldings {
  const starterDomainId = 'domain-starter';
  const starterCityId = 'city-starter';

  const troops: TroopsState = {
    bodyguardLevels: 0,
    militiaLevels: 0,
    mercenaryLevels: 0,
    thugLevels: 0,
    loyalty: 2,
    facilities: [],
  };

  return {
    permanentInfluence: 0,
    permanentLabor: 2,
    domains: [
      {
        id: starterDomainId,
        tier: 'starter',
        facilities: [],
        rawPicks: [...DEFAULT_STARTER_DOMAIN_RAW_PICKS],
        tenants: defaultFollowers(),
      },
    ],
    cityProperties: [
      {
        id: starterCityId,
        tier: 'small',
        tenure: 'owned' satisfies CityPropertyTenure,
        mode: 'leased' satisfies CityPropertyMode,
        facilities: [],
        tenants: defaultFollowers(),
      },
    ],
    workshops: [
      {
        id: 'workshop-starter',
        tier: 'small',
        location: { kind: 'domain', id: starterDomainId },
        inputMaterialId: 'raw.grain',
        outputMaterialId: 'special.pulpellen',
        facilities: [],
      },
    ],
    storages: [
      {
        id: 'storage-starter',
        tier: 'small',
        location: { kind: 'domain', id: starterDomainId },
        facilities: [],
      },
    ],
    organizations: [],
    offices: [
      {
        id: 'office-starter',
        tier: 'small',
        yieldMode: 'influence',
        specialization: { kind: 'cityAdministration', facilities: [] },
        facilities: [],
      },
    ],
    tradeEnterprises: [],
    troops,
    personalFacilities: [],
    longTermProjects: [],
    specialists: [],
  };
}

export function startingPlayerTurn(
  holdings: PlayerHoldings,
  _rules: CampaignRules
): PlayerTurn {
  const laborAvailable = baseLaborTotal(holdings);
  const influenceAvailable = baseInfluencePerRound(holdings);
  return {
    laborAvailable,
    influenceAvailable,
    actionsUsed: 0,
    actionKeysUsed: [],
    facilityActionUsed: false,
    usedPoliticalSteps: false,
    upkeep: {
      maintainedWorkshopIds: [],
      maintainedStorageIds: [],
      maintainedOfficeIds: [],
      maintainedOrganizationIds: [],
      maintainedTradeEnterpriseIds: [],
      maintainedTroops: false,
    },
  };
}

export function domainLaborPerRound(tier: DomainTier): number {
  switch (tier) {
    case 'starter':
    case 'small':
      return 2;
    case 'medium':
      return 4;
    case 'large':
      return 8;
  }
}

export function domainRawPerRound(tier: DomainTier): number {
  switch (tier) {
    case 'starter':
      return 8;
    case 'small':
      return 12;
    case 'medium':
      return 24;
    case 'large':
      return 36;
  }
}

export function domainGoldUpkeep(tier: DomainTier): number {
  switch (tier) {
    case 'starter':
      return 0;
    case 'small':
      return 2;
    case 'medium':
      return 4;
    case 'large':
      return 8;
  }
}

export function cityLaborPerRound(
  tier: CityPropertyTier,
  mode: CityPropertyMode
): number {
  if (mode === 'production') {
    switch (tier) {
      case 'small':
        return 2;
      case 'medium':
        return 3;
      case 'large':
        return 6;
    }
  }
  // leased
  switch (tier) {
    case 'small':
      return 1;
    case 'medium':
      return 2;
    case 'large':
      return 4;
  }
}

export function cityInfluencePerRound(
  tier: CityPropertyTier,
  mode: CityPropertyMode
): number {
  if (mode === 'production') return 0;
  switch (tier) {
    case 'small':
      return 1;
    case 'medium':
      return 2;
    case 'large':
      return 4;
  }
}

export function cityGoldPerRound(
  tier: CityPropertyTier,
  mode: CityPropertyMode
): number {
  if (mode === 'production') return 0;
  switch (tier) {
    case 'small':
      return 2;
    case 'medium':
      return 5;
    case 'large':
      return 12;
  }
}

export function cityGoldUpkeep(
  tier: CityPropertyTier,
  mode: CityPropertyMode
): number {
  if (mode === 'leased') return 0;
  switch (tier) {
    case 'small':
      return 2;
    case 'medium':
      return 4;
    case 'large':
      return 8;
  }
}

export function workshopUpkeep(tier: WorkshopTier): {
  labor: number;
  gold: number;
} {
  switch (tier) {
    case 'small':
      return { labor: 1, gold: 0 };
    case 'medium':
      return { labor: 2, gold: 1 };
    case 'large':
      return { labor: 4, gold: 3 };
  }
}

export function workshopCapacity(tier: WorkshopTier): {
  rawIn: number;
  specialOutMax: number;
} {
  switch (tier) {
    case 'small':
      return { rawIn: 8, specialOutMax: 2 };
    case 'medium':
      return { rawIn: 12, specialOutMax: 3 };
    case 'large':
      return { rawIn: 24, specialOutMax: 6 };
  }
}

export function workshopFacilitySlotsMax(tier: WorkshopTier): number {
  switch (tier) {
    case 'small':
      return 1;
    case 'medium':
      return 2;
    case 'large':
      return 3;
  }
}

export function storageUpkeep(tier: StorageTier): { labor: number } {
  switch (tier) {
    case 'small':
      return { labor: 1 };
    case 'medium':
      return { labor: 2 };
    case 'large':
      return { labor: 3 };
  }
}

export function storageCapacity(
  tier: StorageTier,
  rules: CampaignRules
): { raw: number; special: number } {
  const m = rules.storageCapacityMultiplier;
  switch (tier) {
    case 'small':
      return { raw: 15 * m, special: 5 * m };
    case 'medium':
      return { raw: 25 * m, special: 10 * m };
    case 'large':
      return { raw: 40 * m, special: 15 * m };
  }
}

export function facilityInfluencePerRound(
  facilityKey: string,
  locationKind:
    | 'office'
    | 'tradeEnterprise'
    | 'workshop'
    | 'organization'
    | 'personal'
): number {
  if (
    locationKind !== 'office' &&
    locationKind !== 'tradeEnterprise' &&
    locationKind !== 'workshop' &&
    locationKind !== 'organization' &&
    locationKind !== 'personal'
  )
    return 0;
  const [category, size] = facilityKey.split('.', 2);
  const tier =
    size === 'small' ? 1 : size === 'medium' ? 2 : size === 'large' ? 3 : 0;
  if (!tier) return 0;
  const base = tier;
  if (category === 'special') return base + 1;
  if (category === 'general') return base;
  return 0;
}

export function officesIncomePerRound(
  tier: PostTier,
  mode: OfficeYieldMode,
  rules: CampaignRules
): { influence: number; gold: number } {
  const base =
    tier === 'small'
      ? { influence: 4, gold: rules.officeGoldPerRound }
      : tier === 'medium'
        ? { influence: 8, gold: 10 }
        : { influence: 16, gold: 20 };
  if (mode === 'influence') return { influence: base.influence, gold: 0 };
  if (mode === 'gold') return { influence: 0, gold: base.gold };
  // split 50/50 (Administrative Reformen)
  return {
    influence: Math.floor(base.influence / 2),
    gold: Math.floor(base.gold / 2),
  };
}

export function baseInfluencePerRound(holdings: PlayerHoldings): number {
  const city = holdings.cityProperties.reduce(
    (sum, c) =>
      c.tenants.inUnrest ? sum : sum + cityInfluencePerRound(c.tier, c.mode),
    0
  );
  const org = holdings.organizations.reduce((sum, o) => {
    if (o.followers.inUnrest) return sum;
    if (o.kind === 'spy') {
      const tier = postTierRank(o.tier);
      // +6 Einfluss pro Stufe/Runde
      // Ab Stufe 2/3 zusätzlich permanenter Einfluss (als "jede Runde verfügbar", nicht kumulativ).
      const permanent = tier === 2 ? 1 : tier === 3 ? 2 : 0;
      return sum + 6 * tier + permanent;
    }
    if (o.kind === 'cult') {
      const tier = postTierRank(o.tier);
      // +5 Einfluss pro Stufe/Runde
      // Ab Stufe 2/3 zusätzlich permanenter Einfluss (als "jede Runde verfügbar", nicht kumulativ).
      const permanent = tier === 2 ? 2 : tier === 3 ? 4 : 0;
      return sum + 5 * tier + permanent;
    }
    if (o.kind === 'underworld') {
      // Unterwelt: +1/+2/+3 Einfluss pro Circelstufe und Stadtbesitz-Stufe (ab Stufe 2/3 erhöht).
      const cityRank = Math.max(
        0,
        ...holdings.cityProperties.map((c) => postTierRank(c.tier))
      );
      const tier = postTierRank(o.tier);
      const per = tier === 1 ? 1 : tier === 2 ? 2 : 3;
      return sum + per * tier * cityRank;
    }
    return sum;
  }, 0);
  const offices = holdings.offices.reduce(
    (sum, office) =>
      sum +
      officesIncomePerRound(
        office.tier,
        office.yieldMode,
        DEFAULT_CAMPAIGN_RULES
      ).influence,
    0
  );
  const officeFacilities = holdings.offices.reduce((sum, office) => {
    let total = 0;
    for (const f of office.facilities)
      total += facilityInfluencePerRound(f.key, 'office');
    const specFacilities = office.specialization?.facilities ?? [];
    for (const f of specFacilities)
      total += facilityInfluencePerRound(f.key, 'office');
    return sum + total;
  }, 0);
  const tradeFacilities = holdings.tradeEnterprises.reduce((sum, t) => {
    if (t.damage) return sum;
    let total = 0;
    for (const f of t.facilities)
      total += facilityInfluencePerRound(f.key, 'tradeEnterprise');
    return sum + total;
  }, 0);
  const orgFacilities = holdings.organizations.reduce((sum, o) => {
    if (o.followers.inUnrest) return sum;
    let total = 0;
    for (const f of o.facilities)
      total += facilityInfluencePerRound(f.key, 'organization');
    return sum + total;
  }, 0);
  const workshopFacilities = holdings.workshops.reduce((sum, w) => {
    let total = 0;
    for (const f of w.facilities)
      total += facilityInfluencePerRound(f.key, 'workshop');
    return sum + total;
  }, 0);
  const personalFacilities = holdings.personalFacilities.reduce((sum, f) => {
    return sum + facilityInfluencePerRound(f.key, 'personal');
  }, 0);
  const specialistBonus = holdings.specialists.reduce((sum, s) => {
    if (Math.trunc(s.loyalty) <= 0) return sum;
    return sum + (s.influencePerRoundBonus ?? 0);
  }, 0);

  // Fachkräfte-Charaktertabelle (v1): einzelne Traits geben direkten Einfluss pro Runde.
  const specialistTraitInfluenceBonus = holdings.specialists.reduce(
    (sum, s) => {
      if (Math.trunc(s.loyalty) <= 0) return sum;
      let delta = 0;
      for (const t of s.traits) {
        const posMult = Math.max(1, Math.trunc(t.positiveMultiplier ?? 1));
        switch (t.id) {
          case 4: // Charmant: +1 Einfluss
            delta += 1 * posMult;
            break;
          case 10: // Diplomat: +2 Einfluss pro Runde
            delta += 2 * posMult;
            break;
          case 15: // Autoritär: +2 Einfluss
            delta += 2 * posMult;
            break;
          case 19: // Emotional: +1 Einfluss
            delta += 1 * posMult;
            break;
          default:
            break;
        }
      }
      return sum + delta;
    },
    0
  );
  return Math.max(
    0,
    city +
      org +
      offices +
      holdings.permanentInfluence +
      specialistBonus +
      specialistTraitInfluenceBonus +
      officeFacilities +
      tradeFacilities +
      orgFacilities +
      workshopFacilities +
      personalFacilities
  );
}

export function baseLaborTotal(holdings: PlayerHoldings): number {
  const domains = holdings.domains.reduce(
    (sum, d) => (d.tenants.inUnrest ? sum : sum + domainLaborPerRound(d.tier)),
    0
  );
  const city = holdings.cityProperties.reduce(
    (sum, c) =>
      c.tenants.inUnrest ? sum : sum + cityLaborPerRound(c.tier, c.mode),
    0
  );
  const org = holdings.organizations.reduce((sum, o) => {
    if (o.followers.inUnrest) return sum;
    if (o.kind === 'cult') return sum + 1 * postTierRank(o.tier);
    if (o.kind === 'collegiumCraft' || o.kind === 'collegiumTrade')
      return sum + 3 * postTierRank(o.tier);
    return sum;
  }, 0);
  const tenants =
    holdings.domains.reduce(
      (sum, d) => (d.tenants.inUnrest ? sum : sum + d.tenants.levels),
      0
    ) +
    holdings.cityProperties.reduce(
      (sum, c) => (c.tenants.inUnrest ? sum : sum + c.tenants.levels),
      0
    ) +
    holdings.organizations.reduce(
      (sum, o) => (o.followers.inUnrest ? sum : sum + o.followers.levels),
      0
    );
  return Math.max(0, domains + city + holdings.permanentLabor + org + tenants);
}

export function postTierRank(tier: PostTier): number {
  switch (tier) {
    case 'small':
      return 1;
    case 'medium':
      return 2;
    case 'large':
      return 3;
  }
}
