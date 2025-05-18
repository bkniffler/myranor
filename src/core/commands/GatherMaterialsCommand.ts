import { GameEventType, createGameEvent } from '../events/GameEvent';
import type { GameCommand } from './GameCommand';
import type { GameEvent } from '../events/GameEvent';
import type { GameState } from '../models';
import { PropertyType } from '../models';

// Command to gather materials by spending labor
export interface GatherMaterialsCommand extends GameCommand {
  type: 'GATHER_MATERIALS';
  payload: {
    // Amount of labor to spend
    laborAmount: number;
    // Optional: specific property ID to gather from
    propertyId?: string;
  };
}

// For V1, use a simple d20 roll
function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

// Define the difficulty class (DC) for gathering resources
const GATHER_DC = 10;

// Simple function to get base materials based on property type and labor
function getBaseMaterials(propertyType: PropertyType, laborSpent: number, successLevel: number): Record<string, number> {
  // For V1, we just use a simple multiplier based on labor
  const multiplier = successLevel >= 5 ? 1.5 : 1.0;
  const baseAmount = Math.floor(laborSpent * multiplier);

  // Different properties produce different resources
  switch (propertyType) {
    case PropertyType.DOMAIN:
      return {
        grain: Math.floor(baseAmount * 1.5),
        wood: baseAmount
      };
    case PropertyType.CITY_PROPERTY:
      return {
        bricks: baseAmount
      };
    // For V1, other property types are not implemented for gathering
    default:
      return {
        grain: baseAmount
      };
  }
}

// Command handler for gathering materials
export const gatherMaterialsHandler = {
  validate: (command: GatherMaterialsCommand, state: GameState): boolean => {
    const player = state.players[command.playerId];

    // Check if we're in the action phase
    if (state.phase !== 'action') {
      return false;
    }

    // Check if there are action points remaining
    if (state.actionPointsRemaining <= 0) {
      return false;
    }

    // Check if player has enough labor
    if (player.resources.laborPower < command.payload.laborAmount) {
      return false;
    }

    // If property ID is specified, check if player owns it
    if (command.payload.propertyId) {
      if (!player.propertyIds.includes(command.payload.propertyId)) {
        return false;
      }

      // Check if property is active
      const property = state.properties[command.payload.propertyId];
      if (!property || !property.active) {
        return false;
      }
    } else {
      // In V1, player must have at least one active property to gather materials
      const hasActiveProperty = player.propertyIds.some(id => {
        const property = state.properties[id];
        return property && property.active;
      });

      if (!hasActiveProperty) {
        return false;
      }
    }

    return true;
  },

  execute: (command: GatherMaterialsCommand, state: GameState): GameEvent[] => {
    const player = state.players[command.playerId];
    const laborSpent = command.payload.laborAmount;

    // Determine which property to use
    let propertyToUse;

    if (command.payload.propertyId) {
      propertyToUse = state.properties[command.payload.propertyId];
    } else {
      // Use the first active domain for simplicity in V1
      propertyToUse = player.propertyIds
        .map(id => state.properties[id])
        .find(p => p && p.active && p.type === PropertyType.DOMAIN);

      // If no domain, use any active property
      if (!propertyToUse) {
        propertyToUse = player.propertyIds
          .map(id => state.properties[id])
          .find(p => p && p.active);
      }
    }

    // Roll for success
    const roll = rollD20();

    // Calculate DC modifications based on property
    let modifiedDC = GATHER_DC;
    if (propertyToUse && propertyToUse.dcModifiers?.gainMaterials) {
      const sizeModifiers = propertyToUse.dcModifiers.gainMaterials;
      modifiedDC += (sizeModifiers.small || 0) + (sizeModifiers.medium || 0) + (sizeModifiers.large || 0);
    }

    // Determine success
    const success = roll >= modifiedDC;

    // Calculate how much we succeeded by (for better results)
    const successLevel = roll - modifiedDC;

    // Get materials based on property type and success
    let materialsGathered: Record<string, number> = {};

    if (success) {
      materialsGathered = getBaseMaterials(
        propertyToUse?.type || PropertyType.DOMAIN,
        laborSpent,
        successLevel
      );
    } else {
      // On failure, still get some materials but less
      const reducedLabor = Math.max(1, Math.floor(laborSpent / 2));
      materialsGathered = getBaseMaterials(
        propertyToUse?.type || PropertyType.DOMAIN,
        reducedLabor,
        0
      );
    }

    // Create the gather materials event
    const gatherEvent = createGameEvent({
      type: GameEventType.MATERIALS_GATHERED,
      playerId: command.playerId,
      payload: {
        laborSpent,
        propertyId: propertyToUse?.id,
        roll,
        dc: modifiedDC,
        success,
        materialsGathered
      },
      apply: (state: GameState): GameState => {
        const player = { ...state.players[command.playerId] };

        // Update player labor
        player.resources = {
          ...player.resources,
          laborPower: player.resources.laborPower - laborSpent
        };

        // Add gathered materials
        const updatedRawMaterials = { ...player.resources.rawMaterials };

        for (const [material, amount] of Object.entries(materialsGathered)) {
          const materialKey = material as keyof typeof updatedRawMaterials;
          updatedRawMaterials[materialKey] = (updatedRawMaterials[materialKey] || 0) + amount;
        }

        player.resources.rawMaterials = updatedRawMaterials;

        // Consume an action point
        return {
          ...state,
          players: {
            ...state.players,
            [command.playerId]: player
          },
          actionPointsRemaining: state.actionPointsRemaining - 1
        };
      }
    });

    return [gatherEvent];
  }
};
