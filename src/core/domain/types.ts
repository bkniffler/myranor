import type { CampaignId, PlayerId, UserId } from './ids';
import type { Phase } from './phase';

export type RulesVersion = 'v1';

export type PostTier = 'small' | 'medium' | 'large';
export type DomainTier = 'starter' | PostTier;
export type WorkshopTier = PostTier;
export type StorageTier = PostTier;
export type CityPropertyTier = PostTier;
export type OrganizationKind =
  | 'underworld'
  | 'spy'
  | 'cult'
  | 'collegiumTrade'
  | 'collegiumCraft';
export type OfficeTier = PostTier;
export type TradeEnterpriseTier = PostTier;

export type MaterialKind = 'raw' | 'special';
export type MaterialTier = 'cheap' | 'basic' | 'expensive';

export type RawMarketGroup =
  | 'rawCheapBuilding'
  | 'rawCheapFood'
  | 'rawCheapConsumable'
  | 'rawCheapOther'
  | 'rawBasicBuilding'
  | 'rawBasicFood'
  | 'rawBasicConsumable'
  | 'rawBasicOther'
  | 'rawExpensiveBuilding'
  | 'rawExpensiveOther';

export type SpecialMarketGroup =
  | 'specialCheapCraft'
  | 'specialCheapConsumable'
  | 'specialCheapFood'
  | 'specialCheapOther'
  | 'specialBasicBuilding'
  | 'specialBasicCraft'
  | 'specialBasicOther'
  | 'specialExpensiveBuilding'
  | 'specialExpensiveCraft'
  | 'specialExpensiveLuxury'
  | 'specialExpensiveOther';

export type MarketSideState = {
  tableRollTotal: number;
  categoryLabel: string;
  demandLabel: string;
  modifiersByGroup: Record<string, number>;
};

export type MarketInstanceState = {
  id: string;
  label: string;
  ownerPlayerId?: PlayerId;
  raw: MarketSideState;
  special: MarketSideState;
};

export type MarketState = {
  round: number;
  instances: MarketInstanceState[];
};

export type GlobalEventState = {
  startsAtRound: number;
  endsAtRound: number;
  tableRollTotal: number;
  name: string;
  effectsText: string;
  meta?: Record<string, unknown>;
};

export type PlayerChecks = {
  influence: number;
  money: number;
  materials: number;
};

export type FollowersState = {
  levels: number;
  loyalty: number;
  inUnrest: boolean;
};

export type FacilityDamageState = {
  damagedAtRound: number;
  repairCostGold: number;
  reason?: string;
};

export type FacilityInstance = {
  id: string;
  key: string;
  builtAtRound: number;
  damage?: FacilityDamageState;
};

export type WorkshopState = {
  id: string;
  tier: WorkshopTier;
  location: { kind: 'domain' | 'cityProperty'; id: string };
  inputMaterialId: string;
  outputMaterialId: string;
  damage?: FacilityDamageState;
  facilities: FacilityInstance[];
};

export type StorageState = {
  id: string;
  tier: StorageTier;
  location: { kind: 'domain' | 'cityProperty'; id: string };
  damage?: FacilityDamageState;
  facilities: FacilityInstance[];
};

export type DomainSpecializationKind =
  | 'agriculture'
  | 'animalHusbandry'
  | 'forestry'
  | 'mining';

export type DomainSpecializationPicks = {
  costRawId?: string;
  rawPicks?: string[];
};

export type DomainSpecializationState = {
  kind: DomainSpecializationKind;
  picks?: DomainSpecializationPicks;
  facilities: FacilityInstance[];
};

export type DomainState = {
  id: string;
  tier: DomainTier;
  facilities: FacilityInstance[];
  rawPicks: string[];
  specialization?: DomainSpecializationState;
  tenants: FollowersState;
};

export type CityPropertyMode = 'leased' | 'production';
export type CityPropertyTenure = 'owned' | 'pacht';

export type CitySpecializationKind =
  | 'foodProduction'
  | 'craftGoods'
  | 'metalworking'
  | 'fineCrafts'
  | 'construction'
  | 'crimeDistrict';

export type CitySpecializationState = {
  kind: CitySpecializationKind;
  focus?: string;
  facilities: FacilityInstance[];
};

export type CityPropertyState = {
  id: string;
  tier: CityPropertyTier;
  tenure: CityPropertyTenure;
  mode: CityPropertyMode;
  facilities: FacilityInstance[];
  specialization?: CitySpecializationState;
  tenants: FollowersState;
};

export type OrganizationTier = PostTier;

export type OrganizationState = {
  id: string;
  kind: OrganizationKind;
  tier: OrganizationTier;
  facilities: FacilityInstance[];
  followers: FollowersState;
};

export type OfficeSpecializationKind =
  | 'churchOversight'
  | 'cityAdministration'
  | 'courtOffice'
  | 'provinceAdministration'
  | 'militaryOffice';

export type OfficeYieldMode = 'influence' | 'gold' | 'split';

export type OfficeState = {
  id: string;
  tier: OfficeTier;
  yieldMode: OfficeYieldMode;
  specialization?: {
    kind: OfficeSpecializationKind;
    focus?: string;
    facilities: FacilityInstance[];
  };
  facilities: FacilityInstance[];
};

export type TradeEnterpriseMode = 'produce' | 'trade';

export type TradeEnterpriseState = {
  id: string;
  tier: TradeEnterpriseTier;
  mode: TradeEnterpriseMode;
  damage?: FacilityDamageState;
  facilities: FacilityInstance[];
};

export type TroopsState = {
  bodyguardLevels: number;
  militiaLevels: number;
  mercenaryLevels: number;
  thugLevels: number;
  loyalty: number;
  facilities: FacilityInstance[];
};

export type LongTermProjectState = {
  id: string;
  kind: 'facility';
  facilityKey: string;
  location:
    | { kind: 'domain'; id: string }
    | { kind: 'cityProperty'; id: string }
    | { kind: 'organization'; id: string }
    | { kind: 'office'; id: string }
    | { kind: 'tradeEnterprise'; id: string }
    | { kind: 'workshop'; id: string }
    | { kind: 'troops' };
  startedAtRound: number;
  totalRounds: number;
  remainingRounds: number;
  laborPerRound: number;
  magicPowerPerRound: number;
};

export type SpecialistKind =
  | 'tactician'
  | 'wizard'
  | 'administrator'
  | 'strategist'
  | 'cleric'
  | 'financier'
  | 'politician'
  | 'builder'
  | 'workshop'
  | 'enforcer'
  | 'artisan';

export type SpecialistTier = 'simple' | 'experienced' | 'master';

export type SpecialistTrait = {
  id: number;
  name: string;
  positive: string;
  negative: string;
  // Recruitment-table modifiers (v1): allow per-specialist "trait instances" to carry meta.
  // Positive/negative effects are interpreted in rules code.
  positiveOnly?: boolean;
  positiveMultiplier?: number;
  negativeMultiplier?: number;
};

export type SpecialistState = {
  id: string;
  kind: SpecialistKind;
  secondaryKind?: SpecialistKind;
  tier: SpecialistTier;
  loyalty: number;
  influencePerRoundBonus?: number;
  baseEffectBonus?: number;
  autoPromoteAtRound?: number;
  traits: SpecialistTrait[];
  assignedTo?: { kind: string; id: string };
};

export type MaterialStock = Record<string, number>;

export type PlayerEconomy = {
  gold: number;
  information: number;
  pending: {
    gold: number;
    labor: number;
    raw: MaterialStock;
    special: MaterialStock;
    magicPower: number;
  };
  inventory: {
    raw: MaterialStock;
    special: MaterialStock;
    magicPower: number;
  };
};

export type PlayerPolitics = {
  // Konsequenzenwert
  kw: number;
  // Ansehen
  as: number;
  // Neider
  n: number;
};

export type PlayerHoldings = {
  permanentInfluence: number;
  permanentLabor: number;
  domains: DomainState[];
  cityProperties: CityPropertyState[];
  workshops: WorkshopState[];
  storages: StorageState[];
  organizations: OrganizationState[];
  offices: OfficeState[];
  tradeEnterprises: TradeEnterpriseState[];
  troops: TroopsState;
  longTermProjects: LongTermProjectState[];
  specialists: SpecialistState[];
};

export type PlayerTurn = {
  laborAvailable: number;
  influenceAvailable: number;
  counterReactionLossChoice?: 'gold' | 'influence';
  actionsUsed: number;
  actionKeysUsed: string[];
  facilityActionUsed: boolean;
  usedPoliticalSteps: boolean;
  upkeep: {
    maintainedWorkshopIds: string[];
    maintainedStorageIds: string[];
    maintainedOfficeIds: string[];
    maintainedOrganizationIds: string[];
    maintainedTradeEnterpriseIds: string[];
    maintainedTroops: boolean;
  };
};

export type PlayerEventIncidents = {
  sectionStartsAtRound: number;
  countsByKey: Record<string, number>;
};

export type PlayerState = {
  id: PlayerId;
  userId: UserId;
  displayName: string;
  checks: PlayerChecks;
  holdings: PlayerHoldings;
  politics: PlayerPolitics;
  economy: PlayerEconomy;
  turn: PlayerTurn;
  eventIncidents?: PlayerEventIncidents;
  privateNotes: string[];
};

export type CampaignRules = {
  actionsPerRound: number;
  freeFacilityBuildsPerRound: number;
  storageCapacityMultiplier: number;
  officeGoldPerRound: number;
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
