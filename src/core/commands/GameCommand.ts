import type { GameEvent } from '../events/GameEvent';
import type { GameState } from '../models';

// Base interface for all game commands
export interface GameCommand {
  // Command type
  type: string;

  // Player who issued the command
  playerId: string;

  // Command data
  payload: Record<string, unknown>;

  // validate and execute are now handled by dedicated CommandHandler objects
  // and are no longer part of the command data object itself.
}

export type CommandHandler<T extends GameCommand> = {
  validate: (command: T, state: GameState) => boolean;
  execute: (command: T, state: GameState) => GameEvent[];
};
