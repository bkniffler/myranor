import type {
  CampaignRules,
  DomainTier,
  MarketState,
  PlayerChecks,
  PlayerEconomy,
  PlayerHoldings,
  PlayerInfrastructure,
  PlayerTurn,
  StorageTier,
  WorkshopTier,
} from '../domain/types';

export const RULES_VERSION = 'v0' as const;

export const DEFAULT_CAMPAIGN_RULES: CampaignRules = {
  actionsPerRound: 2,
};

export function startingMarketState(round = 1): MarketState {
  const neutral = { cheap: 0, basic: 0, expensive: 0 };
  return {
    round,
    raw: {
      tableRollTotal: 7,
      categoryLabel: 'Alle Materialien',
      demandLabel: 'Normal',
      modifiers: neutral,
    },
    special: {
      tableRollTotal: 7,
      categoryLabel: 'Alle Sondermaterialien',
      demandLabel: 'Normal',
      modifiers: neutral,
    },
  };
}

export function startingPlayerEconomy(): PlayerEconomy {
  return {
    gold: 4,
    rawMaterials: 0,
    specialMaterials: 0,
    pendingGold: 0,
  };
}

export function startingPlayerHoldings(): PlayerHoldings {
  return {
    officesGold: 0,
  };
}

export function startingPlayerChecks(): PlayerChecks {
  // D&D 5e Level 3 baseline: +3 ability (16) +2 proficiency = +5.
  return { influence: 5, money: 5, materials: 5 };
}

export function startingPlayerInfrastructure(): PlayerInfrastructure {
  return {
    domainTier: 'starter',
    workshopTier: 'small',
    storageTier: 'none',
  };
}

export function baseLaborPerRound(domainTier: DomainTier): number {
  switch (domainTier) {
    case 'starter':
    case 'small':
      return 2;
    case 'medium':
      return 4;
    case 'large':
      return 8;
  }
}

export function domainRawMaterialsPerRound(domainTier: DomainTier): number {
  switch (domainTier) {
    case 'starter':
      return 4;
    case 'small':
      return 12;
    case 'medium':
      return 20;
    case 'large':
      return 36;
  }
}

export function domainGoldUpkeep(domainTier: DomainTier): number {
  switch (domainTier) {
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

export function workshopUpkeep(workshopTier: WorkshopTier): { labor: number; gold: number } {
  switch (workshopTier) {
    case 'none':
      return { labor: 0, gold: 0 };
    case 'small':
      return { labor: 1, gold: 0 };
    case 'medium':
      return { labor: 2, gold: 1 };
    case 'large':
      return { labor: 4, gold: 2 };
  }
}

export function workshopCapacity(workshopTier: WorkshopTier): { rmIn: number; smOutMax: number } {
  switch (workshopTier) {
    case 'none':
      return { rmIn: 0, smOutMax: 0 };
    case 'small':
      return { rmIn: 8, smOutMax: 2 };
    case 'medium':
      return { rmIn: 12, smOutMax: 3 };
    case 'large':
      return { rmIn: 20, smOutMax: 5 };
  }
}

export function storageUpkeep(storageTier: StorageTier): { labor: number } {
  switch (storageTier) {
    case 'none':
      return { labor: 0 };
    case 'small':
      return { labor: 1 };
    case 'medium':
      return { labor: 2 };
    case 'large':
      return { labor: 3 };
  }
}

export function storageCapacity(storageTier: StorageTier): { raw: number; special: number } {
  switch (storageTier) {
    case 'none':
      return { raw: 0, special: 0 };
    case 'small':
      return { raw: 20, special: 10 };
    case 'medium':
      return { raw: 40, special: 20 };
    case 'large':
      return { raw: 80, special: 40 };
  }
}

export function cityPropertyGoldPerRound(): number {
  // "Kleiner Städtischer Besitz (Verpachtet)": +2 Gold
  return 2;
}

export function cityPropertyLaborPerRound(): number {
  // "Kleiner Städtischer Besitz (Verpachtet)": +1 AK
  return 1;
}

export function cityPropertyInfluencePerRound(): number {
  // "Kleiner Städtischer Besitz (Verpachtet)": +1 Einfluss
  return 1;
}

export function underlingsLaborPerRound(): number {
  // "2 Permanente Arbeitskraft aus Arbeitsdiensten der Untertanen"
  return 2;
}

export function baseInfluencePerRound(): number {
  return cityPropertyInfluencePerRound();
}

export function baseLaborTotal(infra: PlayerInfrastructure): number {
  return (
    baseLaborPerRound(infra.domainTier) +
    underlingsLaborPerRound() +
    cityPropertyLaborPerRound()
  );
}

export function roundGoldIncome(_infra: PlayerInfrastructure): number {
  return cityPropertyGoldPerRound();
}

export function roundRawMaterialsIncome(infra: PlayerInfrastructure): number {
  return domainRawMaterialsPerRound(infra.domainTier);
}

export function officesGoldIncomePerRound(officesGold: number): number {
  // v0 tweak: kleines Amt soll weniger snowballen (4 Einfluss ODER 2 Gold statt 4 Gold).
  return officesGold * 2;
}

export function workforceRawMaterialsUpkeep(baseLabor: number): number {
  // "Arbeitskräfte kosten 1 RM per 4 AK Unterhalt."
  return Math.ceil(baseLabor / 4);
}

export function startingPlayerTurn(infra: PlayerInfrastructure): PlayerTurn {
  return {
    laborAvailable: baseLaborTotal(infra),
    influenceAvailable: baseInfluencePerRound(),
    actionsUsed: 0,
    actionKeysUsed: [],
    facilityActionUsed: false,
    upkeep: {
      workshopMaintained: true,
      storageMaintained: true,
    },
  };
}
