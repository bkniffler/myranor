import type { GameEvent } from '../events/GameEvent';
import type { GameState } from '../models';
import type { GameCommand } from './GameCommand';

// --- SYSTEM_MAINTENANCE ---
export interface SystemMaintenanceCommandPayload {
  gameEvent: GameEvent; // The pre-generated maintenance event
  [key: string]: any;
}
export interface SystemMaintenanceCommand extends GameCommand {
  type: 'SYSTEM_MAINTENANCE';
  payload: SystemMaintenanceCommandPayload;
}
export const SystemMaintenanceCommandHandler = {
  validate: (_command: SystemMaintenanceCommand, _state: GameState): boolean =>
    true,
  execute: (
    command: SystemMaintenanceCommand,
    _state: GameState
  ): GameEvent[] => {
    return [command.payload.gameEvent];
  },
};

// --- SYSTEM_PRODUCTION ---
export interface SystemProductionCommandPayload {
  gameEvent: GameEvent;
  [key: string]: any;
}
export interface SystemProductionCommand extends GameCommand {
  type: 'SYSTEM_PRODUCTION';
  payload: SystemProductionCommandPayload;
}
export const SystemProductionCommandHandler = {
  validate: (_command: SystemProductionCommand, _state: GameState): boolean =>
    true,
  execute: (
    command: SystemProductionCommand,
    _state: GameState
  ): GameEvent[] => {
    return [command.payload.gameEvent];
  },
};

// --- SYSTEM_CONVERSION ---
export interface SystemConversionCommandPayload {
  gameEvent: GameEvent;
  [key: string]: any;
}
export interface SystemConversionCommand extends GameCommand {
  type: 'SYSTEM_CONVERSION';
  payload: SystemConversionCommandPayload;
}
export const SystemConversionCommandHandler = {
  validate: (_command: SystemConversionCommand, _state: GameState): boolean =>
    true,
  execute: (
    command: SystemConversionCommand,
    _state: GameState
  ): GameEvent[] => {
    return [command.payload.gameEvent];
  },
};

// --- SYSTEM_AUTO_CONVERSION_RAW ---
export interface SystemAutoConversionRawCommandPayload {
  gameEvent: GameEvent;
  [key: string]: any;
}
export interface SystemAutoConversionRawCommand extends GameCommand {
  type: 'SYSTEM_AUTO_CONVERSION_RAW';
  payload: SystemAutoConversionRawCommandPayload;
}
export const SystemAutoConversionRawCommandHandler = {
  validate: (
    _command: SystemAutoConversionRawCommand,
    _state: GameState
  ): boolean => true,
  execute: (
    command: SystemAutoConversionRawCommand,
    _state: GameState
  ): GameEvent[] => {
    return [command.payload.gameEvent];
  },
};

// --- SYSTEM_AUTO_CONVERSION_SPECIAL ---
export interface SystemAutoConversionSpecialCommandPayload {
  gameEvent: GameEvent;
  [key: string]: any;
}
export interface SystemAutoConversionSpecialCommand extends GameCommand {
  type: 'SYSTEM_AUTO_CONVERSION_SPECIAL';
  payload: SystemAutoConversionSpecialCommandPayload;
}
export const SystemAutoConversionSpecialCommandHandler = {
  validate: (
    _command: SystemAutoConversionSpecialCommand,
    _state: GameState
  ): boolean => true,
  execute: (
    command: SystemAutoConversionSpecialCommand,
    _state: GameState
  ): GameEvent[] => {
    return [command.payload.gameEvent];
  },
};

// --- SYSTEM_RESET ---
export interface SystemResetCommandPayload {
  gameEvent: GameEvent;
  [key: string]: any;
}
export interface SystemResetCommand extends GameCommand {
  type: 'SYSTEM_RESET';
  payload: SystemResetCommandPayload;
}
export const SystemResetCommandHandler = {
  validate: (_command: SystemResetCommand, _state: GameState): boolean => true,
  execute: (command: SystemResetCommand, _state: GameState): GameEvent[] => {
    return [command.payload.gameEvent];
  },
};
