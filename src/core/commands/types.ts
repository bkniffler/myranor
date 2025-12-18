import type {
  CityPropertyMode,
  CityPropertyTier,
  DomainSpecializationKind,
  DomainTier,
  MaterialKind,
  OfficeYieldMode,
  OrganizationKind,
  PlayerChecks,
  PostTier,
  StorageTier,
  SpecialistKind,
  SpecialistTier,
  TradeEnterpriseTier,
  TradeEnterpriseMode,
  WorkshopTier,
} from '../domain/types';

export type CreateCampaignCommand = {
  type: 'CreateCampaign';
  campaignId: string;
  name: string;
};

export type JoinCampaignCommand = {
  type: 'JoinCampaign';
  campaignId: string;
  playerId: string;
  displayName: string;
  checks?: Partial<PlayerChecks>;
};

export type AdvancePhaseCommand = {
  type: 'AdvancePhase';
  campaignId: string;
};

export type GainInfluenceCommand = {
  type: 'GainInfluence';
  campaignId: string;
  kind: 'temporary' | 'permanent';
  investments: number;
};

export type MoneyLendCommand = {
  type: 'MoneyLend';
  campaignId: string;
  investments: number;
};

export type MoneySellCommand = {
  type: 'MoneySell';
  campaignId: string;
  marketInstanceId?: string;
  items: Array<
    | { kind: 'labor'; count: number }
    | { kind: MaterialKind; materialId: string; count: number }
  >;
};

export type MoneyBuyCommand = {
  type: 'MoneyBuy';
  campaignId: string;
  marketInstanceId?: string;
  items: Array<{ kind: MaterialKind; materialId: string; count: number } | { kind: 'labor'; count: number }>;
};

export type GainMaterialsCommand = {
  type: 'GainMaterials';
  campaignId: string;
  mode: 'domainAdministration' | 'workshopOversight';
  investments: number;
  targetId?: string;
};

export type AcquireDomainCommand = {
  type: 'AcquireDomain';
  campaignId: string;
  tier: Exclude<DomainTier, 'starter'>;
};

export type AcquireCityPropertyCommand = {
  type: 'AcquireCityProperty';
  campaignId: string;
  tier: CityPropertyTier;
};

export type SetCityPropertyModeCommand = {
  type: 'SetCityPropertyMode';
  campaignId: string;
  cityPropertyId: string;
  mode: CityPropertyMode;
};

export type AcquireOfficeCommand = {
  type: 'AcquireOffice';
  campaignId: string;
  tier: PostTier;
  payment: 'goldFirst' | 'influenceFirst';
};

export type SetOfficeYieldModeCommand = {
  type: 'SetOfficeYieldMode';
  campaignId: string;
  officeId: string;
  mode: OfficeYieldMode;
};

export type AcquireOrganizationCommand = {
  type: 'AcquireOrganization';
  campaignId: string;
  kind: OrganizationKind;
};

export type AcquireTradeEnterpriseCommand = {
  type: 'AcquireTradeEnterprise';
  campaignId: string;
  tier: TradeEnterpriseTier;
};

export type SetTradeEnterpriseModeCommand = {
  type: 'SetTradeEnterpriseMode';
  campaignId: string;
  tradeEnterpriseId: string;
  mode: TradeEnterpriseMode;
};

export type AcquireTenantsCommand = {
  type: 'AcquireTenants';
  campaignId: string;
  location: { kind: 'domain' | 'cityProperty' | 'organization'; id: string };
  levels: number;
};

export type RecruitTroopsCommand = {
  type: 'RecruitTroops';
  campaignId: string;
  troopKind: 'bodyguard' | 'militia' | 'mercenary' | 'thug';
  levels: number;
};

export type BuildFacilityCommand = {
  type: 'BuildFacility';
  campaignId: string;
  location:
    | { kind: 'domain'; id: string }
    | { kind: 'cityProperty'; id: string }
    | { kind: 'organization'; id: string }
    | { kind: 'office'; id: string }
    | { kind: 'tradeEnterprise'; id: string }
    | { kind: 'troops' };
  facilityKey: string;
};

export type BuildWorkshopCommand = {
  type: 'BuildWorkshop';
  campaignId: string;
  location: { kind: 'domain' | 'cityProperty'; id: string };
  tier: WorkshopTier;
};

export type UpgradeWorkshopCommand = {
  type: 'UpgradeWorkshop';
  campaignId: string;
  workshopId: string;
  toTier: WorkshopTier;
};

export type BuildStorageCommand = {
  type: 'BuildStorage';
  campaignId: string;
  location: { kind: 'domain' | 'cityProperty'; id: string };
  tier: StorageTier;
};

export type UpgradeStorageCommand = {
  type: 'UpgradeStorage';
  campaignId: string;
  storageId: string;
  toTier: StorageTier;
};

export type SetDomainSpecializationCommand = {
  type: 'SetDomainSpecialization';
  campaignId: string;
  domainId: string;
  kind: DomainSpecializationKind;
  picks?: Record<string, string>;
};

export type UpgradeStarterDomainCommand = {
  type: 'UpgradeStarterDomain';
  campaignId: string;
  domainId: string;
};

export type HireSpecialistCommand = {
  type: 'HireSpecialist';
  campaignId: string;
  kind: SpecialistKind;
  tier: SpecialistTier;
};

export type AddPrivateNoteCommand = {
  type: 'AddPrivateNote';
  campaignId: string;
  note: string;
};

export type GameCommand =
  | CreateCampaignCommand
  | JoinCampaignCommand
  | AdvancePhaseCommand
  | GainInfluenceCommand
  | MoneyLendCommand
  | MoneySellCommand
  | MoneyBuyCommand
  | GainMaterialsCommand
  | AcquireDomainCommand
  | AcquireCityPropertyCommand
  | SetCityPropertyModeCommand
  | AcquireOfficeCommand
  | BuildFacilityCommand
  | BuildWorkshopCommand
  | UpgradeWorkshopCommand
  | BuildStorageCommand
  | UpgradeStorageCommand
  | SetDomainSpecializationCommand
  | UpgradeStarterDomainCommand
  | SetOfficeYieldModeCommand
  | AcquireOrganizationCommand
  | AcquireTradeEnterpriseCommand
  | SetTradeEnterpriseModeCommand
  | AcquireTenantsCommand
  | RecruitTroopsCommand
  | HireSpecialistCommand
  | AddPrivateNoteCommand;
