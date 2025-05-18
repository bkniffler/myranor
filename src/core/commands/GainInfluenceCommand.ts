import { GameEventType, createGameEvent } from '../events/GameEvent';
import type { GameEvent } from '../events/GameEvent';
import type { GameState } from '../models';
import type { GameCommand } from './GameCommand';

// Command to gain influence by spending gold
export interface GainInfluenceCommand extends GameCommand {
  type: 'GAIN_INFLUENCE';
  payload: {
    goldAmount: number;
  };
}

// Calculate influence gained based on gold spent (for V1, simple 1:2 ratio)
function calculateInfluenceGain(goldAmount: number): number {
  return goldAmount * 2;
}

// Command handler for gaining influence
export const gainInfluenceHandler = {
  validate: (command: GainInfluenceCommand, state: GameState): boolean => {
    const player = state.players[command.playerId];

    // Check if player has enough gold
    if (player.resources.gold < command.payload.goldAmount) {
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

    return true;
  },

  execute: (command: GainInfluenceCommand, _state: GameState): GameEvent[] => {
    const goldSpent = command.payload.goldAmount;
    const influenceGained = calculateInfluenceGain(goldSpent);

    // Create the influence gained event
    const influenceEvent = createGameEvent({
      type: GameEventType.INFLUENCE_GAINED,
      playerId: command.playerId,
      payload: {
        goldSpent,
        influenceGained,
      },
      apply: (state: GameState): GameState => {
        const player = { ...state.players[command.playerId] };

        // Update player resources
        player.resources = {
          ...player.resources,
          gold: player.resources.gold - goldSpent,
          temporaryInfluence:
            player.resources.temporaryInfluence + influenceGained,
        };

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

    return [influenceEvent];
  },
};
