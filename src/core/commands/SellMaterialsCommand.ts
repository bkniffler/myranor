import { GameEventType, createGameEvent } from '../events/GameEvent';
import type { GameCommand } from './GameCommand';
import type { GameEvent } from '../events/GameEvent';
import type { GameState } from '../models';

// Command to sell materials for gold
export interface SellMaterialsCommand extends GameCommand {
  type: 'SELL_MATERIALS';
  payload: {
    // Which materials to sell and how much
    rawMaterials?: Record<string, number>;
    specialMaterials?: Record<string, number>;
  };
}

// Fixed prices for V1 (simple implementation)
const MATERIAL_PRICES = {
  // Raw materials (basic)
  wood: 1,
  bricks: 1,
  wool: 1,
  grain: 1,
  fruit: 1,
  vegetables: 1,

  // Raw materials (medium)
  stone: 2,
  iron: 2,
  honey: 2,

  // Raw materials (expensive)
  marble: 3,
  gems: 4,

  // Special materials (basic)
  tools: 2,
  cloth: 2,

  // Special materials (medium)
  furniture: 3,
  weapons: 3,

  // Special materials (expensive)
  books: 5,
  perfume: 5
};

// Command handler for selling materials
export const sellMaterialsHandler = {
  validate: (command: SellMaterialsCommand, state: GameState): boolean => {
    const player = state.players[command.playerId];

    // Check if we're in the action phase
    if (state.phase !== 'action') {
      return false;
    }

    // Check if there are action points remaining
    if (state.actionPointsRemaining <= 0) {
      return false;
    }

    // Check if player has the materials to sell
    if (command.payload.rawMaterials) {
      for (const [material, amount] of Object.entries(command.payload.rawMaterials)) {
        const playerAmount = player.resources.rawMaterials[material as keyof typeof player.resources.rawMaterials] || 0;
        if (playerAmount < amount) {
          return false;
        }
      }
    }

    if (command.payload.specialMaterials) {
      for (const [material, amount] of Object.entries(command.payload.specialMaterials)) {
        const playerAmount = player.resources.specialMaterials[material as keyof typeof player.resources.specialMaterials] || 0;
        if (playerAmount < amount) {
          return false;
        }
      }
    }

    return true;
  },

  execute: (command: SellMaterialsCommand, state: GameState): GameEvent[] => {
    let totalGold = 0;

    // Calculate gold from raw materials
    if (command.payload.rawMaterials) {
      for (const [material, amount] of Object.entries(command.payload.rawMaterials)) {
        const price = MATERIAL_PRICES[material as keyof typeof MATERIAL_PRICES] || 1;
        totalGold += price * amount;
      }
    }

    // Calculate gold from special materials
    if (command.payload.specialMaterials) {
      for (const [material, amount] of Object.entries(command.payload.specialMaterials)) {
        const price = MATERIAL_PRICES[material as keyof typeof MATERIAL_PRICES] || 2;
        totalGold += price * amount;
      }
    }

    // Create the materials sold event
    const sellEvent = createGameEvent({
      type: GameEventType.MATERIALS_SOLD,
      playerId: command.playerId,
      payload: {
        rawMaterials: command.payload.rawMaterials || {},
        specialMaterials: command.payload.specialMaterials || {},
        goldGained: totalGold
      },
      apply: (state: GameState): GameState => {
        const player = { ...state.players[command.playerId] };

        // Update player gold
        player.resources = {
          ...player.resources,
          gold: player.resources.gold + totalGold
        };

        // Update raw materials
        if (command.payload.rawMaterials) {
          const updatedRawMaterials = { ...player.resources.rawMaterials };

          for (const [material, amount] of Object.entries(command.payload.rawMaterials)) {
            const materialKey = material as keyof typeof updatedRawMaterials;
            updatedRawMaterials[materialKey] = (updatedRawMaterials[materialKey] || 0) - amount;
          }

          player.resources.rawMaterials = updatedRawMaterials;
        }

        // Update special materials
        if (command.payload.specialMaterials) {
          const updatedSpecialMaterials = { ...player.resources.specialMaterials };

          for (const [material, amount] of Object.entries(command.payload.specialMaterials)) {
            const materialKey = material as keyof typeof updatedSpecialMaterials;
            updatedSpecialMaterials[materialKey] = (updatedSpecialMaterials[materialKey] || 0) - amount;
          }

          player.resources.specialMaterials = updatedSpecialMaterials;
        }

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

    return [sellEvent];
  }
};
