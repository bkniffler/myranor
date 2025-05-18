import { GameEventType, createGameEvent } from '../events/GameEvent';
import type { GameCommand } from './GameCommand';
import type { GameEvent } from '../events/GameEvent';
import type { GameState } from '../models';
import { MarketPriceCategory } from '../models';

// Command to sell materials for gold
export interface SellMaterialsCommand extends GameCommand {
  type: 'SELL_MATERIALS';
  payload: {
    // Which materials to sell and how much
    rawMaterials?: Record<string, number>;
    specialMaterials?: Record<string, number>;
  };
}

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
        const playerAmount = player.resources.rawMaterials[material] || 0;
        if (playerAmount < amount) {
          return false;
        }
      }
    }

    if (command.payload.specialMaterials) {
      for (const [material, amount] of Object.entries(command.payload.specialMaterials)) {
        const playerAmount = player.resources.specialMaterials[material] || 0;
        if (playerAmount < amount) {
          return false;
        }
      }
    }

    return true;
  },

  execute: (command: SellMaterialsCommand, state: GameState): GameEvent[] => {
    let totalGold = 0;
    const marketPrices = state.market;

    // Calculate gold from raw materials
    if (command.payload.rawMaterials) {
      for (const [material, amount] of Object.entries(command.payload.rawMaterials)) {
        const materialMarketData = marketPrices.rawMaterials[material];

        if (materialMarketData) {
          // Get base price from market data
          let price = materialMarketData.basePrice;

          // Apply demand modifier
          if (materialMarketData.currentDemand === MarketPriceCategory.HIGH_DEMAND) {
            price *= 1.5; // 50% bonus for high demand
          } else if (materialMarketData.currentDemand === MarketPriceCategory.COVETED) {
            price *= 2; // 100% bonus for coveted items
          } else if (materialMarketData.currentDemand === MarketPriceCategory.NOT_IN_DEMAND) {
            price *= 0.5; // 50% penalty for not in demand
          }

          // Apply any additional price modifier
          if (materialMarketData.priceModifier) {
            price *= (1 + materialMarketData.priceModifier);
          }

          totalGold += Math.floor(price * amount);
        } else {
          // Fallback if material isn't in market (shouldn't happen)
          totalGold += amount; // Default to 1 gold per material
        }
      }
    }

    // Calculate gold from special materials
    if (command.payload.specialMaterials) {
      for (const [material, amount] of Object.entries(command.payload.specialMaterials)) {
        const materialMarketData = marketPrices.specialMaterials[material];

        if (materialMarketData) {
          // Get base price from market data
          let price = materialMarketData.basePrice;

          // Apply demand modifier
          if (materialMarketData.currentDemand === MarketPriceCategory.HIGH_DEMAND) {
            price *= 1.5; // 50% bonus for high demand
          } else if (materialMarketData.currentDemand === MarketPriceCategory.COVETED) {
            price *= 2; // 100% bonus for coveted items
          } else if (materialMarketData.currentDemand === MarketPriceCategory.NOT_IN_DEMAND) {
            price *= 0.5; // 50% penalty for not in demand
          }

          // Apply any additional price modifier
          if (materialMarketData.priceModifier) {
            price *= (1 + materialMarketData.priceModifier);
          }

          totalGold += Math.floor(price * amount);
        } else {
          // Fallback if material isn't in market (shouldn't happen)
          totalGold += amount * 2; // Default to 2 gold per special material
        }
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
            updatedRawMaterials[material] = (updatedRawMaterials[material] || 0) - amount;

            // Remove the key if amount is 0
            if (updatedRawMaterials[material] <= 0) {
              delete updatedRawMaterials[material];
            }
          }

          player.resources.rawMaterials = updatedRawMaterials;
        }

        // Update special materials
        if (command.payload.specialMaterials) {
          const updatedSpecialMaterials = { ...player.resources.specialMaterials };

          for (const [material, amount] of Object.entries(command.payload.specialMaterials)) {
            updatedSpecialMaterials[material] = (updatedSpecialMaterials[material] || 0) - amount;

            // Remove the key if amount is 0
            if (updatedSpecialMaterials[material] <= 0) {
              delete updatedSpecialMaterials[material];
            }
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
