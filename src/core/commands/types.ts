import type { PlayerChecks } from '../domain/types';

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

export type GatherMaterialsCommand = {
  type: 'GatherMaterials';
  campaignId: string;
  mode: 'domain' | 'workshop';
  investments: number;
};

export type GainInfluenceCommand = {
  type: 'GainInfluence';
  campaignId: string;
  investments: number;
};

export type LendMoneyCommand = {
  type: 'LendMoney';
  campaignId: string;
  investments: number;
};

export type SellMaterialsCommand = {
  type: 'SellMaterials';
  campaignId: string;
  resource: 'raw' | 'special';
  investments: number;
};

export type AcquireOfficeCommand = {
  type: 'AcquireOffice';
  campaignId: string;
  payment: 'gold' | 'influence';
};

export type BuildFacilityCommand = {
  type: 'BuildFacility';
  campaignId: string;
  facility: 'upgradeStarterDomainToSmall' | 'buildSmallStorage';
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
  | GatherMaterialsCommand
  | GainInfluenceCommand
  | LendMoneyCommand
  | SellMaterialsCommand
  | AcquireOfficeCommand
  | BuildFacilityCommand
  | AddPrivateNoteCommand;
