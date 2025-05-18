import type { GameState } from '../models';

export enum GameEventType {
  // Game flow events
  GAME_STARTED = 'gameStarted',
  PHASE_CHANGED = 'phaseChanged',
  ROUND_ADVANCED = 'roundAdvanced',

  // Player action events
  INFLUENCE_GAINED = 'influenceGained',
  MATERIALS_SOLD = 'materialsSold',
  MATERIALS_GATHERED = 'materialsGathered',
  PROPERTY_ACQUIRED = 'propertyAcquired',
  POLITICAL_ACTION_PERFORMED = 'politicalActionPerformed',
  FACILITY_BUILT = 'facilityBuilt',

  // Automatic phase events
  MAINTENANCE_PERFORMED = 'maintenancePerformed',
  RESOURCES_PRODUCED = 'resourcesProduced',
  MATERIALS_CONVERTED = 'materialsConverted',
  RESOURCES_RESET = 'resourcesReset',
  MARKET_UPDATED = 'marketUpdated',

  // New conversion events
  RESOURCES_CONVERTED = 'resourcesConverted',
  RESOURCES_AUTO_CONVERTED = 'resourcesAutoConverted',

  // Resource events
  GOLD_ADDED = 'goldAdded',
  GOLD_REMOVED = 'goldRemoved',
  LABOR_ADDED = 'laborAdded',
  LABOR_REMOVED = 'laborRemoved',
  INFLUENCE_ADDED = 'influenceAdded',
  INFLUENCE_REMOVED = 'influenceRemoved',
  RAW_MATERIALS_ADDED = 'rawMaterialsAdded',
  RAW_MATERIALS_REMOVED = 'rawMaterialsRemoved',
  SPECIAL_MATERIALS_ADDED = 'specialMaterialsAdded',
  SPECIAL_MATERIALS_REMOVED = 'specialMaterialsRemoved',

  // Game result events
  GAME_WON = 'gameWon',
  GAME_LOST = 'gameLost',
}

export interface GameEvent {
  // Event metadata
  id: string;
  type: GameEventType;
  timestamp: number;
  playerId: string;

  // Event payload
  payload: Record<string, unknown>;

  // Function to apply this event to the game state
  apply: (state: GameState) => GameState;
}

export type GameEventData = Omit<GameEvent, 'id' | 'timestamp'>;

// Helper to create a new event
export function createGameEvent(eventData: GameEventData): GameEvent {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
    ...eventData,
  };
}
