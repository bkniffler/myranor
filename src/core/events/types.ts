import type { CampaignId, PlayerId, UserId } from '../domain/ids';
import type { Phase } from '../domain/phase';
import type { SuccessTier } from '../domain/success';
import type {
  MaterialTier,
  PlayerChecks,
  PlayerEconomy,
  PlayerHoldings,
  PlayerInfrastructure,
  PlayerTurn,
  RulesVersion,
} from '../domain/types';
import type { DiceRoll } from '../util/dice';

export type EventVisibility =
  | { scope: 'public' }
  | { scope: 'private'; playerId: PlayerId };

export type CampaignCreatedEvent = {
  type: 'CampaignCreated';
  visibility: { scope: 'public' };
  campaignId: CampaignId;
  name: string;
  gmUserId: UserId;
  rulesVersion: RulesVersion;
  round: number;
  phase: Phase;
};

export type PlayerJoinedEvent = {
  type: 'PlayerJoined';
  visibility: { scope: 'public' };
  playerId: PlayerId;
  userId: UserId;
  displayName: string;
};

export type PlayerInitializedEvent = {
  type: 'PlayerInitialized';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  checks: PlayerChecks;
  infrastructure: PlayerInfrastructure;
  holdings: PlayerHoldings;
  economy: PlayerEconomy;
  turn: PlayerTurn;
};

export type PhaseAdvancedEvent = {
  type: 'PhaseAdvanced';
  visibility: { scope: 'public' };
  from: Phase;
  to: Phase;
  round: number;
};

export type MarketModifierRollEvent = {
  roll: DiceRoll;
  sign: 1 | -1;
  tiers: MaterialTier[];
};

export type MarketRolledEvent = {
  type: 'MarketRolled';
  visibility: { scope: 'public' };
  round: number;
  raw: {
    tableRoll: DiceRoll;
    categoryLabel: string;
    demandLabel: string;
    modifiers: Record<MaterialTier, number>;
    modifierRolls: MarketModifierRollEvent[];
    metaRolls: DiceRoll[];
  };
  special: {
    tableRoll: DiceRoll;
    categoryLabel: string;
    demandLabel: string;
    modifiers: Record<MaterialTier, number>;
    modifierRolls: MarketModifierRollEvent[];
    metaRolls: DiceRoll[];
  };
};

export type SectionEventsRolledEvent = {
  type: 'SectionEventsRolled';
  visibility: { scope: 'public' };
  startsAtRound: number;
  endsAtRound: number;
  events: Array<{
    tableRoll: DiceRoll;
    name: string;
    effectsText: string;
  }>;
};

export type PlayerIncomeAppliedEvent = {
  type: 'PlayerIncomeApplied';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  goldProduced: number;
  officeGoldIncomeMultiplierApplied: number;
  officeGoldIncomeBonusPerOfficeApplied: number;
  rawMaterialsProduced: number;
  specialMaterialsProduced: number;
  upkeepGoldPaid: number;
  eventGoldTaxPaid: number;
  eventOneTimeOfficeTaxPaid: number;
  upkeepLaborPaid: number;
  workforceUpkeepRawMaterialsPaid: number;
  upkeep: {
    workshopMaintained: boolean;
    storageMaintained: boolean;
  };
  goldGained: number;
  rawMaterialsGained: number;
  specialMaterialsGained: number;
};

export type PlayerPendingGoldAppliedEvent = {
  type: 'PlayerPendingGoldApplied';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  amount: number;
  reason: 'loan' | 'other';
};

export type PlayerMaterialsConvertedEvent = {
  type: 'PlayerMaterialsConverted';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  rawMaterialsBefore: number;
  specialMaterialsBefore: number;
  workshop: {
    maintained: boolean;
    rawConsumed: number;
    specialProduced: number;
  };
  storage: {
    maintained: boolean;
    rawStored: number;
    specialStored: number;
  };
  rawConvertedToGold: number;
  rawLost: number;
  specialConvertedToGold: number;
  goldGained: number;
};

export type PlayerTurnResetEvent = {
  type: 'PlayerTurnReset';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
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

export type PlayerGatherMaterialsResolvedEvent = {
  type: 'PlayerGatherMaterialsResolved';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  mode: 'domain' | 'workshop';
  investments: number;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tier: SuccessTier;
  laborSpent: number;
  rawMaterialsGained: number;
  specialMaterialsGained: number;
  actionCost: number;
  actionKey: string;
};

export type PlayerGainInfluenceResolvedEvent = {
  type: 'PlayerGainInfluenceResolved';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  investments: number;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tier: SuccessTier;
  goldSpent: number;
  influenceGained: number;
  actionCost: number;
  actionKey: string;
};

export type PlayerLendMoneyResolvedEvent = {
  type: 'PlayerLendMoneyResolved';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  investments: number;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tier: SuccessTier;
  goldSpent: number;
  goldScheduled: number;
  actionCost: number;
  actionKey: string;
};

export type PlayerSellMaterialsResolvedEvent = {
  type: 'PlayerSellMaterialsResolved';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  resource: 'raw' | 'special';
  investments: number;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tier: SuccessTier;
  rawMaterialsSpent: number;
  specialMaterialsSpent: number;
  marketModifierPerInvestment: number;
  marketModifierTotal: number;
  goldGained: number;
  actionCost: number;
  actionKey: string;
};

export type PlayerFacilityBuiltEvent = {
  type: 'PlayerFacilityBuilt';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  facility: 'upgradeStarterDomainToSmall' | 'buildSmallStorage';
  goldSpent: number;
  laborSpent: number;
};

export type PlayerOfficeAcquiredEvent = {
  type: 'PlayerOfficeAcquired';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tier: SuccessTier;
  goldSpent: number;
  influenceSpent: number;
  officesGoldGained: number;
  actionCost: number;
  actionKey: string;
};

export type PlayerPrivateNoteAddedEvent = {
  type: 'PlayerPrivateNoteAdded';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  note: string;
};

export type PublicLogEntryAddedEvent = {
  type: 'PublicLogEntryAdded';
  visibility: { scope: 'public' };
  message: string;
  playerId?: PlayerId;
};

export type GameEvent =
  | CampaignCreatedEvent
  | PlayerJoinedEvent
  | PlayerInitializedEvent
  | PhaseAdvancedEvent
  | MarketRolledEvent
  | SectionEventsRolledEvent
  | PlayerIncomeAppliedEvent
  | PlayerPendingGoldAppliedEvent
  | PlayerMaterialsConvertedEvent
  | PlayerTurnResetEvent
  | PlayerGatherMaterialsResolvedEvent
  | PlayerGainInfluenceResolvedEvent
  | PlayerLendMoneyResolvedEvent
  | PlayerSellMaterialsResolvedEvent
  | PlayerFacilityBuiltEvent
  | PlayerOfficeAcquiredEvent
  | PlayerPrivateNoteAddedEvent
  | PublicLogEntryAddedEvent;
