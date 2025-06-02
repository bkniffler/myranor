import { GameEventType, createGameEvent } from '../events/GameEvent';
import type { GameEvent } from '../events/GameEvent';
import type { GameState } from '../models';
import { PropertyType } from '../models';
import type { Property } from '../models/Property';
import type { GameCommand } from './GameCommand';

// Command to gather materials by spending labor
export interface GatherMaterialsCommandPayload {
  laborAmount: number; // Amount of labor to spend
  propertyId?: string; // Optional: specific property ID to gather from
  [key: string]: any; // For GameCommand compatibility
}

export interface GatherMaterialsCommand extends GameCommand {
  type: 'GATHER_MATERIALS';
  payload: GatherMaterialsCommandPayload;
}

// For V1, use a simple d20 roll
function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

// Define the difficulty class (DC) for gathering resources
const GATHER_DC = 10;

// Simple function to get base materials based on property and labor
// Now looking at the property's base production values from JSON
function getBaseMaterials(
  property: Property | undefined,
  laborSpent: number,
  successLevel: number
): Record<string, number> {
  // For V1, we just use a simple multiplier based on labor and success
  const multiplier = successLevel >= 5 ? 1.5 : 1.0;

  // Output materials dictionary
  const materials: Record<string, number> = {};

  // If the property has defined raw material production, base gathering on that
  if (property?.baseProduction?.rawMaterials) {
    const baseProduction = property.baseProduction.rawMaterials;
    const baseLabor = property.baseProduction.laborPower || 1;

    // Scale the materials based on labor spent and standard production
    const laborRatio = laborSpent / baseLabor;

    // Add each type of material the property can produce
    for (const [materialId, amount] of Object.entries(baseProduction)) {
      // Calculate how much we get based on labor spent, with success bonus
      const gatheredAmount = Math.floor(
        (amount as number) * laborRatio * multiplier * 0.5
      );
      if (gatheredAmount > 0) {
        materials[materialId] = gatheredAmount;
      }
    }

    return materials;
  }

  // Fallback for properties without specific material production
  const baseAmount = Math.floor(laborSpent * multiplier);

  // Different properties produce different resources based on type
  switch (property?.type) {
    case PropertyType.DOMAIN:
      return {
        grain: Math.floor(baseAmount * 1.5),
        wood: baseAmount,
      };
    case PropertyType.CITY_PROPERTY:
      return {
        bricks: baseAmount,
      };
    // For V1, other property types are not implemented for gathering
    default:
      return {
        grain: baseAmount,
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
      const hasActiveProperty = player.propertyIds.some((id) => {
        const property = state.properties[id];
        return property?.active;
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
    let propertyToUse: Property | undefined;

    if (command.payload.propertyId) {
      propertyToUse = state.properties[command.payload.propertyId];
    } else {
      // Use the first active domain for simplicity in V1
      propertyToUse = player.propertyIds
        .map((id) => state.properties[id])
        .find((p) => p?.active && p.type === PropertyType.DOMAIN);

      // If no domain, use any active property
      if (!propertyToUse) {
        propertyToUse = player.propertyIds
          .map((id) => state.properties[id])
          .find((p) => p?.active);
      }
    }

    // Roll for success
    const roll = rollD20();

    // Calculate DC modifications based on property
    let modifiedDC = GATHER_DC;
    if (propertyToUse?.dcModifiers?.gainMaterials) {
      const sizeModifiers = propertyToUse.dcModifiers.gainMaterials;
      modifiedDC +=
        (sizeModifiers.small || 0) +
        (sizeModifiers.medium || 0) +
        (sizeModifiers.large || 0);
    }

    // Determine success
    const success = roll >= modifiedDC;

    // Calculate how much we succeeded by (for better results)
    const successLevel = roll - modifiedDC;

    // Get materials based on property and success
    let materialsGathered: Record<string, number> = {};

    if (success) {
      materialsGathered = getBaseMaterials(
        propertyToUse,
        laborSpent,
        successLevel
      );
    } else {
      // On failure, still get some materials but less
      const reducedLabor = Math.max(1, Math.floor(laborSpent / 2));
      materialsGathered = getBaseMaterials(propertyToUse, reducedLabor, 0);
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
        materialsGathered,
      },
      apply: (state: GameState): GameState => {
        const player = { ...state.players[command.playerId] };

        // Update player labor
        player.resources = {
          ...player.resources,
          laborPower: player.resources.laborPower - laborSpent,
        };

        // Add gathered materials
        const updatedRawMaterials = { ...player.resources.rawMaterials };

        for (const [material, amount] of Object.entries(materialsGathered)) {
          updatedRawMaterials[material] =
            (updatedRawMaterials[material] || 0) + amount;
        }

        player.resources.rawMaterials = updatedRawMaterials;

        // Consume an action point
        return {
          ...state,
          players: {
            ...state.players,
            [command.playerId]: player,
          },
          actionPointsRemaining: state.actionPointsRemaining - 1,
        };
      },
    });

    return [gatherEvent];
  },
};
