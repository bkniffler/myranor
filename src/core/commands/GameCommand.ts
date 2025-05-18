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

  // Validate if this command can be executed given the current state
  validate: (state: GameState) => boolean;

  // Execute the command and return the events it produces
  execute: (state: GameState) => GameEvent[];
}

export type CommandHandler<T extends GameCommand> = {
  validate: (command: T, state: GameState) => boolean;
  execute: (command: T, state: GameState) => GameEvent[];
};
