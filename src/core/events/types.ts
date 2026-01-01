import type { CampaignId, PlayerId, UserId } from '../domain/ids';
import type { Phase } from '../domain/phase';
import type { SuccessTier } from '../domain/success';
import type {
  CampaignRules,
  CityPropertyMode,
  CityPropertyTenure,
  CityPropertyTier,
  DomainSpecializationKind,
  DomainSpecializationPicks,
  DomainTier,
  GlobalEventState,
  MarketInstanceState,
  MaterialKind,
  MaterialStock,
  OfficeTier,
  OfficeYieldMode,
  OrganizationKind,
  OrganizationTier,
  PlayerChecks,
  PlayerEconomy,
  PlayerHoldings,
  PlayerTurn,
  PostTier,
  RulesVersion,
  SpecialistKind,
  SpecialistTier,
  StorageTier,
  TradeEnterpriseMode,
  TradeEnterpriseTier,
  WorkshopTier,
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
  rules: CampaignRules;
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

export type MarketRolledEvent = {
  type: 'MarketRolled';
  visibility: { scope: 'public' };
  round: number;
  instances: Array<{
    id: string;
    label: string;
    ownerPlayerId?: PlayerId;
    raw: {
      tableRoll: DiceRoll;
      categoryLabel: string;
      demandLabel: string;
      modifiersByGroup: Record<string, number>;
      modifierRolls: Array<{ roll: DiceRoll; note: string }>;
      metaRolls: DiceRoll[];
    };
    special: {
      tableRoll: DiceRoll;
      categoryLabel: string;
      demandLabel: string;
      modifiersByGroup: Record<string, number>;
      modifierRolls: Array<{ roll: DiceRoll; note: string }>;
      metaRolls: DiceRoll[];
    };
  }>;
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
    meta?: Record<string, unknown>;
  }>;
};

export type PlayerPendingAppliedEvent = {
  type: 'PlayerPendingApplied';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  goldApplied: number;
  laborApplied: number;
  rawApplied: MaterialStock;
  specialApplied: MaterialStock;
  magicPowerApplied: number;
};

export type PlayerIncomeAppliedEvent = {
  type: 'PlayerIncomeApplied';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  produced: {
    gold: number;
    raw: MaterialStock;
    special: MaterialStock;
    influence: number;
    labor: number;
    magicPower: number;
  };
  upkeepPaid: {
    gold: number;
    influence: number;
    labor: number;
    raw: MaterialStock;
    special: MaterialStock;
    magicPower: number;
  };
  eventTaxesPaid: {
    gold: number;
    oneTimeOfficeTaxGold: number;
  };
  upkeep: PlayerTurn['upkeep'];
};

export type PlayerMaterialsConvertedEvent = {
  type: 'PlayerMaterialsConverted';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  workshop: {
    rawConsumed: MaterialStock;
    rawProduced: MaterialStock;
    specialProduced: MaterialStock;
  };
  facilities: {
    rawConsumed: MaterialStock;
    specialConsumed: MaterialStock;
    rawProduced: MaterialStock;
    specialProduced: MaterialStock;
  };
  stored: {
    rawStored: MaterialStock;
    specialStored: MaterialStock;
  };
  convertedToGold: {
    rawByType: MaterialStock;
    specialByType: MaterialStock;
    laborConverted: number;
    influenceConverted: number;
    goldGained: number;
  };
  lost: {
    rawLost: MaterialStock;
    specialLost: MaterialStock;
  };
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
  usedPoliticalSteps: boolean;
  upkeep: PlayerTurn['upkeep'];
};

export type PlayerInfluenceGainedEvent = {
  type: 'PlayerInfluenceGained';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  kind: 'temporary' | 'permanent';
  investments: number;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tier: SuccessTier;
  goldSpent: number;
  influenceGained: number;
  permanentInfluenceIncreasedBy: number;
  actionCost: number;
  actionKey: string;
};

export type PlayerMoneyLentEvent = {
  type: 'PlayerMoneyLent';
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

export type PlayerMoneySoldEvent = {
  type: 'PlayerMoneySold';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tier: SuccessTier;
  sold: Array<
    | { kind: 'labor'; count: number }
    | { kind: MaterialKind; materialId: string; count: number }
  >;
  marketUsed: { instanceId: string; label: string };
  marketDeltaGold: number;
  cargoIncident?: {
    kind: 'storm' | 'pirates' | 'conflict';
    tradeEnterpriseId: string;
    triggerRoll: DiceRoll;
    defense?: {
      dc: number;
      roll: DiceRoll;
      rollModifier: number;
      rollTotal: number;
      defended: boolean;
    };
    lossGold: number;
  };
  goldGained: number;
  actionCost: number;
  actionKey: string;
};

export type PlayerMoneyBoughtEvent = {
  type: 'PlayerMoneyBought';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tier: SuccessTier;
  bought: Array<
    | { kind: 'labor'; count: number }
    | { kind: MaterialKind; materialId: string; count: number }
  >;
  marketUsed: { instanceId: string; label: string };
  marketDeltaGold: number;
  goldSpent: number;
  actionCost: number;
  actionKey: string;
};

export type PlayerMaterialsGainedEvent = {
  type: 'PlayerMaterialsGained';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  mode: 'domainAdministration' | 'workshopOversight';
  investments: number;
  targetId?: string;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tier: SuccessTier;
  laborSpent: number;
  rawGained: MaterialStock;
  specialGained: MaterialStock;
  actionCost: number;
  actionKey: string;
};

export type PlayerDomainAcquiredEvent = {
  type: 'PlayerDomainAcquired';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  domainId: string;
  tier: Exclude<DomainTier, 'starter'>;
  rawPicks?: string[];
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tierResult: SuccessTier;
  goldSpent: number;
  actionCost: number;
  actionKey: string;
};

export type PlayerCityPropertyAcquiredEvent = {
  type: 'PlayerCityPropertyAcquired';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  cityPropertyId: string;
  tier: CityPropertyTier;
  tenure: CityPropertyTenure;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tierResult: SuccessTier;
  goldSpent: number;
  actionCost: number;
  actionKey: string;
};

export type PlayerCityPropertyModeSetEvent = {
  type: 'PlayerCityPropertyModeSet';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  cityPropertyId: string;
  mode: CityPropertyMode;
};

export type PlayerOfficeAcquiredEvent = {
  type: 'PlayerOfficeAcquired';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  officeId: string;
  tier: OfficeTier;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tierResult: SuccessTier;
  goldSpent: number;
  influenceSpent: number;
  actionCost: number;
  actionKey: string;
};

export type PlayerOfficeYieldModeSetEvent = {
  type: 'PlayerOfficeYieldModeSet';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  officeId: string;
  mode: OfficeYieldMode;
};

export type PlayerOfficeLostEvent = {
  type: 'PlayerOfficeLost';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  officeId: string;
  reason: string;
};

export type PlayerOrganizationAcquiredEvent = {
  type: 'PlayerOrganizationAcquired';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  organizationId: string;
  kind: OrganizationKind;
  fromTier: OrganizationTier;
  toTier: OrganizationTier;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tierResult: SuccessTier;
  goldSpent: number;
  influenceSpent: number;
  actionCost: number;
  actionKey: string;
};

export type PlayerTradeEnterpriseAcquiredEvent = {
  type: 'PlayerTradeEnterpriseAcquired';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  tradeEnterpriseId: string;
  tier: TradeEnterpriseTier;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tierResult: SuccessTier;
  goldSpent: number;
  actionCost: number;
  actionKey: string;
};

export type PlayerTradeEnterpriseModeSetEvent = {
  type: 'PlayerTradeEnterpriseModeSet';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  tradeEnterpriseId: string;
  mode: TradeEnterpriseMode;
};

export type PlayerTenantsAcquiredEvent = {
  type: 'PlayerTenantsAcquired';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  location: { kind: 'domain' | 'cityProperty' | 'organization'; id: string };
  levels: number;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tierResult: SuccessTier;
  goldSpent: number;
  influenceSpent: number;
  actionCost: number;
  actionKey: string;
};

export type PlayerTroopsRecruitedEvent = {
  type: 'PlayerTroopsRecruited';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  troopKind: 'bodyguard' | 'militia' | 'mercenary' | 'thug';
  levels: number;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tierResult: SuccessTier;
  goldSpent: number;
  influenceSpent: number;
  rawSpent: MaterialStock;
  specialSpent: MaterialStock;
  actionCost: number;
  actionKey: string;
};

export type PlayerWorkshopBuiltEvent = {
  type: 'PlayerWorkshopBuilt';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  workshopId: string;
  location: { kind: 'domain' | 'cityProperty'; id: string };
  tier: WorkshopTier;
  inputMaterialId: string;
  outputMaterialId: string;
  goldSpent: number;
  usedFreeFacilityBuild: boolean;
};

export type PlayerWorkshopUpgradedEvent = {
  type: 'PlayerWorkshopUpgraded';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  workshopId: string;
  fromTier: WorkshopTier;
  toTier: WorkshopTier;
  goldSpent: number;
  usedFreeFacilityBuild: boolean;
};

export type PlayerStorageBuiltEvent = {
  type: 'PlayerStorageBuilt';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  storageId: string;
  location: { kind: 'domain' | 'cityProperty'; id: string };
  tier: StorageTier;
  goldSpent: number;
  usedFreeFacilityBuild: boolean;
};

export type PlayerStorageUpgradedEvent = {
  type: 'PlayerStorageUpgraded';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  storageId: string;
  fromTier: StorageTier;
  toTier: StorageTier;
  goldSpent: number;
  usedFreeFacilityBuild: boolean;
};

export type PlayerFacilityBuiltEvent = {
  type: 'PlayerFacilityBuilt';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  location:
    | { kind: 'domain'; id: string }
    | { kind: 'cityProperty'; id: string }
    | { kind: 'organization'; id: string }
    | { kind: 'office'; id: string }
    | { kind: 'tradeEnterprise'; id: string }
    | { kind: 'workshop'; id: string }
    | { kind: 'troops' };
  facilityInstanceId: string;
  facilityKey: string;
  goldSpent: number;
  influenceSpent: number;
  laborSpent: number;
  rawSpent: MaterialStock;
  specialSpent: MaterialStock;
  magicPowerSpent: number;
  usedFreeFacilityBuild: boolean;
};

export type PlayerLongTermProjectStartedEvent = {
  type: 'PlayerLongTermProjectStarted';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  projectId: string;
  kind: 'facility';
  location: PlayerFacilityBuiltEvent['location'];
  facilityKey: string;
  startedAtRound: number;
  totalRounds: number;
  remainingRounds: number;
  laborPerRound: number;
  magicPowerPerRound: number;
  upfrontCosts: {
    goldSpent: number;
    influenceSpent: number;
    laborSpent: number;
    rawSpent: MaterialStock;
    specialSpent: MaterialStock;
    magicPowerSpent: number;
  };
  usedFreeFacilityBuild: boolean;
};

export type PlayerLongTermProjectProgressedEvent = {
  type: 'PlayerLongTermProjectProgressed';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  projectId: string;
  progressedAtRound: number;
  remainingRoundsAfter: number;
  upkeepPaid: { labor: number; magicPower: number };
  reason: string;
};

export type PlayerLongTermProjectCompletedEvent = {
  type: 'PlayerLongTermProjectCompleted';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  projectId: string;
  completedAtRound: number;
  kind: 'facility';
  location: PlayerFacilityBuiltEvent['location'];
  facilityInstanceId: string;
  facilityKey: string;
};

export type PlayerFacilityDamagedEvent = {
  type: 'PlayerFacilityDamaged';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  location:
    | { kind: 'domain'; id: string }
    | { kind: 'cityProperty'; id: string }
    | { kind: 'organization'; id: string }
    | { kind: 'office'; id: string }
    | { kind: 'tradeEnterprise'; id: string }
    | { kind: 'workshop'; id: string }
    | { kind: 'troops' };
  facilityInstanceId: string;
  repairCostGold: number;
  reason: string;
};

export type PlayerWorkshopDamagedEvent = {
  type: 'PlayerWorkshopDamaged';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  workshopId: string;
  repairCostGold: number;
  reason: string;
};

export type PlayerStorageDamagedEvent = {
  type: 'PlayerStorageDamaged';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  storageId: string;
  repairCostGold: number;
  reason: string;
};

export type PlayerTradeEnterpriseDamagedEvent = {
  type: 'PlayerTradeEnterpriseDamaged';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  tradeEnterpriseId: string;
  repairCostGold: number;
  reason: string;
};

export type PlayerTradeEnterpriseLostEvent = {
  type: 'PlayerTradeEnterpriseLost';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  tradeEnterpriseId: string;
  reason: string;
};

export type PlayerFollowersAdjustedEvent = {
  type: 'PlayerFollowersAdjusted';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  changes: Array<{
    location: { kind: 'domain' | 'cityProperty' | 'organization'; id: string };
    levelsDelta?: number;
    loyaltyDelta?: number;
  }>;
  reason: string;
};

export type PlayerPoliticsAdjustedEvent = {
  type: 'PlayerPoliticsAdjusted';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  kwDelta?: number;
  asDelta?: number;
  nDelta?: number;
  reason: string;
};

export type PlayerEventIncidentRecordedEvent = {
  type: 'PlayerEventIncidentRecorded';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  sectionStartsAtRound: number;
  tableRollTotal: number;
  incidentKind: string;
  countDelta: number;
  reason: string;
};

export type PlayerCounterReactionLossChoiceSetEvent = {
  type: 'PlayerCounterReactionLossChoiceSet';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  choice: 'gold' | 'influence';
};

export type PlayerCounterReactionResolvedEvent = {
  type: 'PlayerCounterReactionResolved';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  threshold: 3 | 6 | 9;
  defense: {
    dc: number;
    roll: DiceRoll;
    rollModifier: number;
    rollTotal: number;
    defended: boolean;
  };
  loss: { kind: 'gold' | 'influence'; amount: number };
  politicsDelta: { kwDelta: number; asDelta: number; nDelta: number };
  reason: string;
};

export type PlayerPoliticalStepsResolvedEvent =
  | {
      type: 'PlayerPoliticalStepsResolved';
      visibility: { scope: 'private'; playerId: PlayerId };
      playerId: PlayerId;
      kind: 'convertInformation';
      to: 'gold' | 'influence';
      amount: number;
      infoSpent: number;
      goldGained: number;
      influenceGained: number;
      actionCost: number;
      actionKey: string;
    }
  | {
      type: 'PlayerPoliticalStepsResolved';
      visibility: { scope: 'private'; playerId: PlayerId };
      playerId: PlayerId;
      kind: 'damageDefend' | 'manipulate' | 'loyaltySecure';
      size: PostTier;
      investments: number;
      investmentPayment: string;
      baseCosts: { gold: number; influence: number };
      investmentCosts: { gold: number; influence: number };
      infoSpent: number;
      infoBonus: number;
      infoGained: number;
      dc: number;
      roll: DiceRoll;
      rollModifier: number;
      rollTotal: number;
      tierResult: SuccessTier;
      influencePenalty: number;
      politicsDelta: { kwDelta: number; asDelta: number; nDelta: number };
      defense?: {
        dc: number;
        roll: DiceRoll;
        rollModifier: number;
        rollTotal: number;
        defended: boolean;
      };
      actionCost: number;
      actionKey: string;
    };

export type PlayerDomainSpecializationSetEvent = {
  type: 'PlayerDomainSpecializationSet';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  domainId: string;
  kind: DomainSpecializationKind;
  picks?: DomainSpecializationPicks;
  goldSpent: number;
  rawSpent: MaterialStock;
  usedFreeFacilityBuild: boolean;
};

export type PlayerStarterDomainUpgradedEvent = {
  type: 'PlayerStarterDomainUpgraded';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  domainId: string;
  goldSpent: number;
  laborSpent: number;
  usedFreeFacilityBuild: boolean;
};

export type PlayerSpecialistHiredEvent = {
  type: 'PlayerSpecialistHired';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  specialistId: string;
  kind: SpecialistKind;
  secondaryKind?: SpecialistKind;
  tier: SpecialistTier;
  baseEffectBonus?: number;
  autoPromoteAtRound?: number;
  dc: number;
  roll: DiceRoll;
  rollModifier: number;
  rollTotal: number;
  tierResult: SuccessTier;
  tableRoll: DiceRoll | null;
  costAdjustmentGold: number;
  loyaltyRolled: DiceRoll | null;
  loyaltyFinal: number | null;
  traitRoll: DiceRoll | null;
  influencePerRoundBonus: number;
  traits: Array<{
    id: number;
    name: string;
    positive: string;
    negative: string;
    positiveOnly?: boolean;
    positiveMultiplier?: number;
    negativeMultiplier?: number;
  }>;
  apprentice?: {
    specialistId: string;
    kind: SpecialistKind;
    secondaryKind?: SpecialistKind;
    tier: SpecialistTier;
    loyalty: number;
    traitRoll: DiceRoll;
    traits: Array<{
      id: number;
      name: string;
      positive: string;
      negative: string;
      positiveOnly?: boolean;
      positiveMultiplier?: number;
      negativeMultiplier?: number;
    }>;
  };
  goldSpent: number;
  usedFreeFacilityBuild: boolean;
  actionCost: number;
};

export type PlayerSpecialistPromotedEvent = {
  type: 'PlayerSpecialistPromoted';
  visibility: { scope: 'private'; playerId: PlayerId };
  playerId: PlayerId;
  specialistId: string;
  fromTier: SpecialistTier;
  toTier: SpecialistTier;
  reason: string;
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
  | PlayerPendingAppliedEvent
  | PlayerIncomeAppliedEvent
  | PlayerMaterialsConvertedEvent
  | PlayerTurnResetEvent
  | PlayerInfluenceGainedEvent
  | PlayerMoneyLentEvent
  | PlayerMoneySoldEvent
  | PlayerMoneyBoughtEvent
  | PlayerMaterialsGainedEvent
  | PlayerDomainAcquiredEvent
  | PlayerCityPropertyAcquiredEvent
  | PlayerCityPropertyModeSetEvent
  | PlayerOfficeAcquiredEvent
  | PlayerOfficeYieldModeSetEvent
  | PlayerOfficeLostEvent
  | PlayerOrganizationAcquiredEvent
  | PlayerTradeEnterpriseAcquiredEvent
  | PlayerTradeEnterpriseModeSetEvent
  | PlayerTenantsAcquiredEvent
  | PlayerTroopsRecruitedEvent
  | PlayerWorkshopBuiltEvent
  | PlayerWorkshopUpgradedEvent
  | PlayerStorageBuiltEvent
  | PlayerStorageUpgradedEvent
  | PlayerFacilityBuiltEvent
  | PlayerLongTermProjectStartedEvent
  | PlayerLongTermProjectProgressedEvent
  | PlayerLongTermProjectCompletedEvent
  | PlayerFacilityDamagedEvent
  | PlayerWorkshopDamagedEvent
  | PlayerStorageDamagedEvent
  | PlayerTradeEnterpriseDamagedEvent
  | PlayerTradeEnterpriseLostEvent
  | PlayerFollowersAdjustedEvent
  | PlayerPoliticsAdjustedEvent
  | PlayerEventIncidentRecordedEvent
  | PlayerCounterReactionLossChoiceSetEvent
  | PlayerCounterReactionResolvedEvent
  | PlayerDomainSpecializationSetEvent
  | PlayerStarterDomainUpgradedEvent
  | PlayerSpecialistHiredEvent
  | PlayerSpecialistPromotedEvent
  | PlayerPoliticalStepsResolvedEvent
  | PlayerPrivateNoteAddedEvent
  | PublicLogEntryAddedEvent;

export function campaignMarketFromEvent(
  event: MarketRolledEvent
): MarketStateFromEvent {
  return {
    round: event.round,
    instances: event.instances.map((i) => ({
      id: i.id,
      label: i.label,
      ownerPlayerId: i.ownerPlayerId,
      raw: {
        tableRollTotal: i.raw.tableRoll.total,
        categoryLabel: i.raw.categoryLabel,
        demandLabel: i.raw.demandLabel,
        modifiersByGroup: i.raw.modifiersByGroup,
      },
      special: {
        tableRollTotal: i.special.tableRoll.total,
        categoryLabel: i.special.categoryLabel,
        demandLabel: i.special.demandLabel,
        modifiersByGroup: i.special.modifiersByGroup,
      },
    })),
  };
}

type MarketStateFromEvent = {
  round: number;
  instances: MarketInstanceState[];
};

export function globalEventsFromEvent(
  event: SectionEventsRolledEvent
): GlobalEventState[] {
  return event.events.map((e) => ({
    startsAtRound: event.startsAtRound,
    endsAtRound: event.endsAtRound,
    tableRollTotal: e.tableRoll.total,
    name: e.name,
    effectsText: e.effectsText,
    meta: e.meta,
  }));
}
