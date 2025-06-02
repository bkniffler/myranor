import {
  type GameEvent,
  GameEventType,
  createGameEvent,
} from '../events/GameEvent';
import type { GameState, Player } from '../models/GameState';
import { PropertySize, PropertyType } from '../models/Property';
import type { GameCommand } from './GameCommand';

export interface LendMoneyCommandPayload {
  investments: number; // Number of investment units (each costs 2 gold)
  [key: string]: any; // Allow other properties to match Record<string, unknown>
}

export interface LendMoneyCommand extends GameCommand {
  type: 'LEND_MONEY';
  payload: LendMoneyCommandPayload;
}

// Helper to determine trading post level for investment caps
function getTradingPostLevel(
  player: Player,
  state: GameState
): PropertySize | null {
  for (const propertyId of player.propertyIds) {
    const property = state.properties[propertyId];
    if (property?.active && property.type === PropertyType.TRADING_COMPANY) {
      return property.size; // Assuming TRADING_COMPANY is the correct type for Handelsunternehmung
    }
  }
  return null;
}

function getInvestmentCap(tradingPostLevel: PropertySize | null): number {
  if (tradingPostLevel === PropertySize.LARGE) return 10;
  if (tradingPostLevel === PropertySize.MEDIUM) return 6;
  if (tradingPostLevel === PropertySize.SMALL) return 4;
  return 2; // No trading post or unknown size
}

// const DC = 14; // Base DC for LendMoney - Unused for now

export const LendMoneyCommandHandler = {
  validate: (command: LendMoneyCommand, state: GameState): boolean => {
    const player = state.players[command.playerId];
    if (!player) return false;

    const costPerInvestment = 2;
    const totalCost = command.payload.investments * costPerInvestment;
    if (player.resources.gold < totalCost) return false; // Not enough gold

    const tradingPostLevel = getTradingPostLevel(player, state);
    const cap = getInvestmentCap(tradingPostLevel);
    if (command.payload.investments <= 0 || command.payload.investments > cap) {
      return false; // Invalid number of investments or exceeds cap
    }

    // TODO: Add DC modifier check for medium/large undertakings based on investments
    // e.g., if command.payload.investments >= 8 (large) or >= 4 (medium)

    return true;
  },

  execute: (command: LendMoneyCommand, _state: GameState): GameEvent[] => {
    // const player = state.players[command.playerId]; // Unused
    const { investments } = command.payload;
    const costPerInvestment = 2;
    const baseReturnPerInvestment = 5;

    // Simulate dice roll and success
    // For now, let's assume "Normal" success for simplicity
    // In a full implementation, this would involve a d20 roll + attributes vs DC
    // TODO: Implement actual dice roll & success scale
    type SuccessCategory = 'Very Good' | 'Good' | 'Normal' | 'Bad' | 'Fail';

    // Helper to simulate getting a success category - ensures TS treats successLevel as the full union type
    function getSimulatedSuccessLevel(): SuccessCategory {
      return 'Normal'; // Placeholder for actual dice roll logic
    }
    const successLevel: SuccessCategory = getSimulatedSuccessLevel();

    let goldChange = 0;
    let eventType: GameEventType;

    switch (successLevel) {
      case 'Very Good': // +10 Gold/investment (next round)
        goldChange = investments * 10 - investments * costPerInvestment;
        eventType = GameEventType.GOLD_ADDED;
        break;
      case 'Good': // +8 Gold/investment (next round)
        goldChange = investments * 8 - investments * costPerInvestment;
        eventType = GameEventType.GOLD_ADDED;
        break;
      case 'Normal': // +5 Gold/investment (next round)
        goldChange =
          investments * baseReturnPerInvestment -
          investments * costPerInvestment;
        eventType = GameEventType.GOLD_ADDED;
        break;
      case 'Bad': // Lose 1 Gold/investment, get 1 Gold back. Net loss of 1 per investment.
        goldChange = investments * 1 - investments * costPerInvestment; // Net change is negative
        // If goldChange is negative, it means a loss.
        // The payload amount is Math.abs(goldChange).
        // If goldChange is positive, it's GOLD_ADDED, if negative, GOLD_REMOVED.
        eventType =
          goldChange >= 0
            ? GameEventType.GOLD_ADDED
            : GameEventType.GOLD_REMOVED;
        // Removed duplicated ternary operator lines that were here
        break;
      case 'Fail': // Investment lost
        goldChange = -(investments * costPerInvestment);
        eventType = GameEventType.GOLD_REMOVED;
        break;
      default:
        // Should not happen with typed successLevel
        return [];
    }

    // The rule says "in der nächsten Runde" (in the next round).
    // This implies the event should be scheduled or its effect delayed.
    // For V1, we can apply it immediately or create a specific "delayed gain" event.
    // Let's apply immediately for now and note this for future refinement.

    const lendMoneyEvent = createGameEvent({
      type: eventType,
      playerId: command.playerId,
      payload: {
        amount: Math.abs(goldChange), // Amount is positive for gain, payload indicates loss via type
        source: 'LendMoney',
        investmentsMade: investments,
        cost: investments * costPerInvestment,
        profit: goldChange > 0 ? goldChange : 0,
        loss: goldChange < 0 ? Math.abs(goldChange) : 0,
        successLevel,
      },
      apply: (currentState: GameState): GameState => {
        const newPlayerState = { ...currentState.players[command.playerId] };
        newPlayerState.resources = {
          ...newPlayerState.resources,
          gold: newPlayerState.resources.gold + goldChange,
        };
        return {
          ...currentState,
          players: {
            ...currentState.players,
            [command.playerId]: newPlayerState,
          },
        };
      },
    });

    return [lendMoneyEvent];
  },
};
