import type { Facility } from './Facility';
import type { Property } from './Property';
import { PropertySize, PropertyType, SpecializationType } from './Property';
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

// Create initial game state
export function createInitialGameState(
  playerId: string,
  playerName: string
): GameState {
  // Create a small rural domain for the player
  const startingDomainId = generateUniqueId();

  // Create the domain from the config
  const smallDomain: Property = {
    id: startingDomainId,
    name: 'Kleine Ländliche Domäne',
    type: PropertyType.DOMAIN,
    size: PropertySize.SMALL,
    specialization: SpecializationType.NONE,
    active: true,
    maintenanceCost: {
      gold: 2,
    },
    baseProduction: {
      laborPower: 2,
      rawMaterials: {
        grain: 8,
        wood: 4,
      },
    },
    dcModifiers: {
      gainMaterials: {
        small: -1,
      },
    },
    facilityIds: [],
    facilitySlots: {
      general: 2,
      specialized: 0,
      workshop: 1,
      warehouse: 1,
    },
  };

  return {
    gameId: generateUniqueId(),
    round: 1,
    phase: GamePhase.MAINTENANCE,

    players: {
      [playerId]: {
        id: playerId,
        name: playerName,
        resources: {
          gold: 10,
          laborPower: 4,
          baseLaborPower: 4,
          temporaryInfluence: 0,
          permanentInfluence: 0,
          combatPower: 0,
          rawMaterials: {
            grain: 4,
          },
          specialMaterials: {
            tools: 1,
          },
        },
        propertyIds: [startingDomainId],
      },
    },
    currentPlayerId: playerId,

    actionPointsRemaining: 2,
    bonusActionPointsRemaining: {
      [GameActionType.GAIN_INFLUENCE]: 0,
      [GameActionType.GAIN_MONEY]: 0,
      [GameActionType.GAIN_MATERIALS]: 0,
      [GameActionType.ACQUIRE_PROPERTY]: 0,
      [GameActionType.POLITICAL_ACTION]: 0,
      [GameActionType.BUILD_FACILITY]: 0,
    },
    facilityBuildActionAvailable: true,

    properties: {
      [startingDomainId]: smallDomain
    },
    facilities: {},

    market: {
      rawMaterials: {} as any,
      specialMaterials: {} as any,
    },

    settings: {
      winConditionRounds: 30,
      loseConditionGold: -20,
      startingActionPoints: 2,
    },
  };
}

// Generate a unique ID (simple implementation for now)
function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
