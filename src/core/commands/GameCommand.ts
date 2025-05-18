import type { GameEvent } from '../events/GameEvent';
import type { GameState } from '../models';

export interface GameCommand {
  // Unique identifier for the command type
  type: string;

  // Player who issued the command
  playerId: string;

  // Payload data specific to this command
  payload: any;

  // Validate if this command can be executed given the current state
  validate: (state: GameState) => boolean;

  // Execute the command and return the events it produces
  execute: (state: GameState) => GameEvent[];
}

export type CommandHandler<T extends GameCommand> = {
  validate: (command: T, state: GameState) => boolean;
  execute: (command: T, state: GameState) => GameEvent[];
};
