import type { GameState } from '../models';
import type {
  FacilityBuiltPayload,
  GameLostPayload,
  GameStartedPayload,
  GameWonPayload,
  GoldAddedPayload,
  GoldRemovedPayload,
  InfluenceAddedPayload,
  InfluenceGainedPayload,
  InfluenceRemovedPayload,
  LaborAddedPayload,
  LaborRemovedPayload,
  MaintenancePerformedPayload,
  MarketUpdatedPayload,
  MaterialsGatheredPayload,
  MaterialsSoldPayload,
  PhaseChangedPayload,
  PoliticalActionPerformedPayload,
  PropertyAcquiredPayload,
  RawMaterialsAddedPayload,
  RawMaterialsRemovedPayload,
  ResourcesAutoConvertedPayload,
  ResourcesConvertedPayload,
  ResourcesProducedPayload,
  ResourcesResetPayload,
  RoundAdvancedPayload,
  SpecialMaterialsAddedPayload,
  SpecialMaterialsRemovedPayload,
} from './EventPayloads';

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

// Discriminated union type mapping event types to their payloads
export type GameEventPayloadMap = {
  // Game flow events
  [GameEventType.GAME_STARTED]: GameStartedPayload;
  [GameEventType.PHASE_CHANGED]: PhaseChangedPayload;
  [GameEventType.ROUND_ADVANCED]: RoundAdvancedPayload;

  // Player action events
  [GameEventType.INFLUENCE_GAINED]: InfluenceGainedPayload;
  [GameEventType.MATERIALS_SOLD]: MaterialsSoldPayload;
  [GameEventType.MATERIALS_GATHERED]: MaterialsGatheredPayload;
  [GameEventType.PROPERTY_ACQUIRED]: PropertyAcquiredPayload;
  [GameEventType.POLITICAL_ACTION_PERFORMED]: PoliticalActionPerformedPayload;
  [GameEventType.FACILITY_BUILT]: FacilityBuiltPayload;

  // Automatic phase events
  [GameEventType.MAINTENANCE_PERFORMED]: MaintenancePerformedPayload;
  [GameEventType.RESOURCES_PRODUCED]: ResourcesProducedPayload;
  [GameEventType.RESOURCES_RESET]: ResourcesResetPayload;
  [GameEventType.MARKET_UPDATED]: MarketUpdatedPayload;

  // Resource conversion events
  [GameEventType.RESOURCES_CONVERTED]: ResourcesConvertedPayload;
  [GameEventType.RESOURCES_AUTO_CONVERTED]: ResourcesAutoConvertedPayload;

  // Resource events
  [GameEventType.GOLD_ADDED]: GoldAddedPayload;
  [GameEventType.GOLD_REMOVED]: GoldRemovedPayload;
  [GameEventType.LABOR_ADDED]: LaborAddedPayload;
  [GameEventType.LABOR_REMOVED]: LaborRemovedPayload;
  [GameEventType.INFLUENCE_ADDED]: InfluenceAddedPayload;
  [GameEventType.INFLUENCE_REMOVED]: InfluenceRemovedPayload;
  [GameEventType.RAW_MATERIALS_ADDED]: RawMaterialsAddedPayload;
  [GameEventType.RAW_MATERIALS_REMOVED]: RawMaterialsRemovedPayload;
  [GameEventType.SPECIAL_MATERIALS_ADDED]: SpecialMaterialsAddedPayload;
  [GameEventType.SPECIAL_MATERIALS_REMOVED]: SpecialMaterialsRemovedPayload;

  // Game result events
  [GameEventType.GAME_WON]: GameWonPayload;
  [GameEventType.GAME_LOST]: GameLostPayload;
};

// Generic type for an event with a specific type
export interface GameEvent<T extends GameEventType = GameEventType> {
  // Event metadata
  id: string;
  type: T;
  timestamp: number;
  playerId: string;

  // Event payload with proper type based on the event type
  payload: GameEventPayloadMap[T];

  // Function to apply this event to the game state
  apply: (state: GameState) => GameState;
}

// Type for creating an event (without id or timestamp)
export type GameEventData<T extends GameEventType = GameEventType> = Omit<
  GameEvent<T>,
  'id' | 'timestamp'
>;

// Helper to create a new event with proper typing
export function createGameEvent<T extends GameEventType>(
  eventData: GameEventData<T>
): GameEvent<T> {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
    ...eventData,
  };
}
