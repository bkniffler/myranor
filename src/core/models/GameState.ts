import type { Facility } from './Facility';
import type { Property } from './Property';
import type { MarketPrices } from './Resources';
import type { PlayerResources } from './Resources';

// Phase of the game
export enum GamePhase {
  MAINTENANCE = 'maintenance',
  ACTION = 'action',
  PRODUCTION = 'production',
  RESOURCE_CONVERSION = 'resourceConversion',
  RESOURCE_RESET = 'resourceReset',
}

// Game action type enumeration
export enum GameActionType {
  GAIN_INFLUENCE = 'gainInfluence',
  GAIN_MONEY = 'gainMoney',
  GAIN_MATERIALS = 'gainMaterials',
  ACQUIRE_PROPERTY = 'acquireProperty',
  POLITICAL_ACTION = 'politicalAction',
  BUILD_FACILITY = 'buildFacility',
}

// Player state
export interface Player {
  id: string;
  name: string;
  resources: PlayerResources;
  propertyIds: string[];
}

// Main game state
export interface GameState {
  // Game metadata
  gameId: string;
  round: number;
  phase: GamePhase;

  // Player state
  players: Record<string, Player>;
  currentPlayerId: string;

  // Action points
  actionPointsRemaining: number;
  bonusActionPointsRemaining: Record<GameActionType, number>;
  facilityBuildActionAvailable: boolean;

  // Game entities
  properties: Record<string, Property>;
  facilities: Record<string, Facility>;

  // Market state
  market: MarketPrices;

  // Game settings and configuration
  settings: {
    winConditionRounds: number;
    loseConditionGold: number;
    startingActionPoints: number;
  };
}
