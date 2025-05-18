import { GameEventType, createGameEvent } from '../events/GameEvent';
import type { GameCommand } from './GameCommand';
import type { GameEvent } from '../events/GameEvent';
import type { GameState, Property } from '../models';
import { generateUniqueId } from '../utils/idGenerator';
import { PropertyTypes } from '../config';

// Supported property types for V1
type V1PropertyType = 'SMALL_RURAL_DOMAIN' | 'MEDIUM_RURAL_DOMAIN' | 'SMALL_CITY_PROPERTY' |
                      'SMALL_WORKSHOP' | 'SMALL_STORAGE' | 'SMALL_OFFICE';

// Command to acquire a new property
export interface AcquirePropertyCommand extends GameCommand {
  type: 'ACQUIRE_PROPERTY';
  payload: {
    // Property config key to acquire
    propertyConfigKey: V1PropertyType;
  };
}

// Cost to acquire different properties (for V1 - simple fixed costs)
const PROPERTY_COSTS: Record<V1PropertyType, { gold: number }> = {
  SMALL_RURAL_DOMAIN: { gold: 20 },
  MEDIUM_RURAL_DOMAIN: { gold: 40 },
  SMALL_CITY_PROPERTY: { gold: 15 },
  SMALL_WORKSHOP: { gold: 10 },
  SMALL_STORAGE: { gold: 8 },
  SMALL_OFFICE: { gold: 25 },
};

// Command handler for acquiring properties
export const acquirePropertyHandler = {
  validate: (command: AcquirePropertyCommand, state: GameState): boolean => {
    const player = state.players[command.playerId];
    const propertyConfig = PropertyTypes[command.payload.propertyConfigKey];

    // Check if property config exists
    if (!propertyConfig) {
      return false;
    }

    // Check if we're in the action phase
    if (state.phase !== 'action') {
      return false;
    }

    // Check if there are action points remaining
    if (state.actionPointsRemaining <= 0) {
      return false;
    }

    // Check if player has enough gold
    const cost = PROPERTY_COSTS[command.payload.propertyConfigKey];
    if (!cost || player.resources.gold < cost.gold) {
      return false;
    }

    return true;
  },

  execute: (command: AcquirePropertyCommand, state: GameState): GameEvent[] => {
    // Get property config
    const propertyConfig = PropertyTypes[command.payload.propertyConfigKey];
    const cost = PROPERTY_COSTS[command.payload.propertyConfigKey];

    // Create a new property instance
    const newProperty: Property = {
      id: generateUniqueId(),
      name: propertyConfig.name,
      type: propertyConfig.type,
      size: propertyConfig.size,
      specialization: propertyConfig.specialization,
      active: propertyConfig.defaultActive || false,
      maintenanceCost: propertyConfig.maintenanceCost,
      baseProduction: propertyConfig.baseProduction,
      dcModifiers: propertyConfig.dcModifiers,
      facilityIds: [],
      facilitySlots: propertyConfig.facilitySlots,
      specialData: propertyConfig.specialData,
    };

    // Create the property acquired event
    const acquireEvent = createGameEvent({
      type: GameEventType.PROPERTY_ACQUIRED,
      playerId: command.playerId,
      payload: {
        property: newProperty,
        cost
      },
      apply: (state: GameState): GameState => {
        const player = { ...state.players[command.playerId] };

        // Update player gold
        player.resources = {
          ...player.resources,
          gold: player.resources.gold - cost.gold
        };

        // Add property to player's properties
        player.propertyIds = [...player.propertyIds, newProperty.id];

        // Consume an action point
        return {
          ...state,
          players: {
            ...state.players,
            [command.playerId]: player
          },
          properties: {
            ...state.properties,
            [newProperty.id]: newProperty
          },
          actionPointsRemaining: state.actionPointsRemaining - 1
        };
      }
    });

    return [acquireEvent];
  }
};
