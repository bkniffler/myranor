import { FacilityTypes } from '../config';
import { GameEventType, createGameEvent } from '../events/GameEvent';
import type { GameEvent } from '../events/GameEvent';
import type { Facility, GameState } from '../models';
import { generateUniqueId } from '../utils/idGenerator';
import type { GameCommand } from './GameCommand';

// Supported facility types for V1
export type V1FacilityType =
  // Added export
  | 'BASIC_HOUSING'
  | 'FOOD_STORAGE'
  | 'LAND_EXPANSION'
  | 'BASIC_DEFENSE'
  | 'OCTAD_SHRINE'
  | 'MARKETPLACE';

// Command to build a facility on a property
export interface BuildFacilityCommandPayload {
  facilityConfigKey: V1FacilityType; // Facility config key to build
  propertyId: string; // Property ID to build on
  [key: string]: any; // For GameCommand compatibility
}

export interface BuildFacilityCommand extends GameCommand {
  type: 'BUILD_FACILITY';
  payload: BuildFacilityCommandPayload;
}

// For V1, use a simple d20 roll for building success
function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

// Command handler for building facilities
export const buildFacilityHandler = {
  validate: (command: BuildFacilityCommand, state: GameState): boolean => {
    const player = state.players[command.playerId];
    const facilityConfig = FacilityTypes[command.payload.facilityConfigKey];

    // Check if facility config exists
    if (!facilityConfig) {
      return false;
    }

    // Check if we're in the action phase
    if (state.phase !== 'action') {
      return false;
    }

    // For V1, check if facility build action is available
    if (!state.facilityBuildActionAvailable) {
      return false;
    }

    // Check if the property exists and belongs to the player
    const property = state.properties[command.payload.propertyId];
    if (!property || !player.propertyIds.includes(command.payload.propertyId)) {
      return false;
    }

    // Check if the property is active
    if (!property.active) {
      return false;
    }

    // Check if this facility can be built on this property type
    if (
      facilityConfig.buildRequirements.propertyTypes &&
      !facilityConfig.buildRequirements.propertyTypes.includes(property.type)
    ) {
      return false;
    }

    // Check if there are slots available based on category
    let slotsAvailable = 0;
    if (facilityConfig.category === 'general') {
      slotsAvailable = property.facilitySlots.general;
    } else if (facilityConfig.category === 'specialized') {
      slotsAvailable = property.facilitySlots.specialized;
    } else if (facilityConfig.category === 'workshop') {
      slotsAvailable = property.facilitySlots.workshop || 0;
    } else if (facilityConfig.category === 'warehouse') {
      slotsAvailable = property.facilitySlots.warehouse || 0;
    }

    // Count existing facilities of this category
    const existingFacilitiesCount = property.facilityIds
      .map((id) => state.facilities[id])
      .filter((f) => f?.category === facilityConfig.category).length;

    if (existingFacilitiesCount >= slotsAvailable) {
      return false;
    }

    // Check if player has enough resources
    const resources = facilityConfig.buildRequirements.resources;
    if (resources) {
      if (resources.gold && player.resources.gold < resources.gold) {
        return false;
      }

      if (
        resources.laborPower &&
        player.resources.laborPower < resources.laborPower
      ) {
        return false;
      }

      if (resources.rawMaterials) {
        for (const [material, amount] of Object.entries(
          resources.rawMaterials
        )) {
          const playerAmount =
            player.resources.rawMaterials[
              material as keyof typeof player.resources.rawMaterials
            ] || 0;
          if (playerAmount < amount) {
            return false;
          }
        }
      }

      if (resources.specialMaterials) {
        for (const [material, amount] of Object.entries(
          resources.specialMaterials
        )) {
          const playerAmount =
            player.resources.specialMaterials[
              material as keyof typeof player.resources.specialMaterials
            ] || 0;
          if (playerAmount < amount) {
            return false;
          }
        }
      }
    }

    return true;
  },

  execute: (command: BuildFacilityCommand, state: GameState): GameEvent[] => {
    // Get facility config
    const facilityConfig = FacilityTypes[command.payload.facilityConfigKey];
    const _property = state.properties[command.payload.propertyId];

    // Roll for success (simplified for V1, success is guaranteed)
    const roll = rollD20();
    const success = true; // In V1, always succeed

    // Create a new facility instance
    const newFacility: Facility = {
      id: generateUniqueId(),
      name: facilityConfig.name,
      type: facilityConfig.type,
      description: facilityConfig.description,
      category: facilityConfig.category,
      buildRequirements: facilityConfig.buildRequirements,
      maintenanceCost: facilityConfig.maintenanceCost,
      effects: facilityConfig.effects,
    };

    // Determine resource costs
    const resourceCosts = facilityConfig.buildRequirements.resources || {
      gold: 0,
    };

    // Create the facility built event
    const buildEvent = createGameEvent({
      type: GameEventType.FACILITY_BUILT,
      playerId: command.playerId,
      payload: {
        facility: newFacility,
        propertyId: command.payload.propertyId,
        roll,
        success,
        resourceCosts,
      },
      apply: (state: GameState): GameState => {
        const player = { ...state.players[command.playerId] };
        const property = { ...state.properties[command.payload.propertyId] };

        // Update player resources
        player.resources = {
          ...player.resources,
          gold: player.resources.gold - (resourceCosts.gold || 0),
          laborPower:
            player.resources.laborPower - (resourceCosts.laborPower || 0),
        };

        // Update raw materials
        if (resourceCosts.rawMaterials) {
          const updatedRawMaterials = { ...player.resources.rawMaterials };

          for (const [material, amount] of Object.entries(
            resourceCosts.rawMaterials
          )) {
            const materialKey = material as keyof typeof updatedRawMaterials;
            updatedRawMaterials[materialKey] =
              (updatedRawMaterials[materialKey] || 0) - amount;
          }

          player.resources.rawMaterials = updatedRawMaterials;
        }

        // Update special materials
        if (resourceCosts.specialMaterials) {
          const updatedSpecialMaterials = {
            ...player.resources.specialMaterials,
          };

          for (const [material, amount] of Object.entries(
            resourceCosts.specialMaterials
          )) {
            const materialKey =
              material as keyof typeof updatedSpecialMaterials;
            updatedSpecialMaterials[materialKey] =
              (updatedSpecialMaterials[materialKey] || 0) - amount;
          }

          player.resources.specialMaterials = updatedSpecialMaterials;
        }

        // Add facility to property
        property.facilityIds = [...property.facilityIds, newFacility.id];

        // Mark the facility build action as used for this turn
        return {
          ...state,
          players: {
            ...state.players,
            [command.playerId]: player,
          },
          properties: {
            ...state.properties,
            [property.id]: property,
          },
          facilities: {
            ...state.facilities,
            [newFacility.id]: newFacility,
          },
          facilityBuildActionAvailable: false,
        };
      },
    });

    return [buildEvent];
  },
};
