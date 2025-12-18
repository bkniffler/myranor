import type {
  CampaignState,
  GameCommand,
  PlayerChecks,
  PlayerId,
  PlayerState,
  SuccessTier,
} from '../core';

export type AgentId =
  | 'builder'
  | 'merchant'
  | 'courtier'
  | 'random'
  | 'speculator'
  | 'officeFocus'
  | 'tradeFocus'
  | 'cityUnderworld'
  | 'workshopFocus'
  | 'domainFocus'
  | 'plannerOffice'
  | 'plannerTrade'
  | 'plannerCity'
  | 'plannerWorkshop'
  | 'plannerDomain';

export type Agent = {
  id: AgentId;
  name: string;
  decideFacility: (ctx: RoundContext) => GameCommand | null;
  decideActions: (ctx: RoundContext) => GameCommand[];
};

export type PlayerProfile = {
  userId: string;
  playerId: string;
  displayName: string;
  checks: PlayerChecks;
  agent: Agent;
  llmPreamble?: string;
};

export type RoundContext = {
  state: CampaignState;
  round: number;
  me: PlayerState;
  profile: PlayerProfile;
};

export type ActionOutcome = {
  round: number;
  playerId: PlayerId;
  actionKey: string;
  tier: SuccessTier;
};

export type PlaytestConfig = {
  runs: number;
  rounds: number;
  seed: number;
};
