import type { CampaignId, PlayerId, UserId } from './ids';
import type { Phase } from './phase';

export type RulesVersion = 'v0';

export type DomainTier = 'starter' | 'small' | 'medium' | 'large';
export type WorkshopTier = 'none' | 'small' | 'medium' | 'large';
export type StorageTier = 'none' | 'small' | 'medium' | 'large';

export type MaterialTier = 'cheap' | 'basic' | 'expensive';

export type MarketSide = {
  tableRollTotal: number;
  categoryLabel: string;
  demandLabel: string;
  modifiers: Record<MaterialTier, number>;
};

export type MarketState = {
  round: number;
  raw: MarketSide;
  special: MarketSide;
};

export type GlobalEventState = {
  startsAtRound: number;
  endsAtRound: number;
  tableRollTotal: number;
  name: string;
  effectsText: string;
};

export type PlayerChecks = {
  influence: number;
  money: number;
  materials: number;
};

export type PlayerInfrastructure = {
  domainTier: DomainTier;
  workshopTier: WorkshopTier;
  storageTier: StorageTier;
};

export type PlayerHoldings = {
  officesGold: number;
};

export type PlayerEconomy = {
  gold: number;
  rawMaterials: number;
  specialMaterials: number;
  pendingGold: number;
};

export type PlayerTurn = {
  laborAvailable: number;
  influenceAvailable: number;
  actionsUsed: number;
  actionKeysUsed: string[];
  facilityActionUsed: boolean;
  upkeep: {
    workshopMaintained: boolean;
    storageMaintained: boolean;
  };
};

export type PlayerState = {
  id: PlayerId;
  userId: UserId;
  displayName: string;
  checks: PlayerChecks;
  infrastructure: PlayerInfrastructure;
  holdings: PlayerHoldings;
  economy: PlayerEconomy;
  turn: PlayerTurn;
  privateNotes: string[];
};

export type CampaignRules = {
  actionsPerRound: number;
};

export type CampaignState = {
  id: CampaignId;
  name: string;
  rulesVersion: RulesVersion;
  rules: CampaignRules;
  round: number;
  phase: Phase;
  gmUserId: UserId;
  market: MarketState;
  globalEvents: GlobalEventState[];
  players: Record<PlayerId, PlayerState>;
  playerIdByUserId: Record<UserId, PlayerId>;
};
