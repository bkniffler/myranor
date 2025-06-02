import {
  type AcquirePropertyCommand,
  type BuildFacilityCommand,
  type GainInfluenceCommand,
  type GatherMaterialsCommand,
  type LendMoneyCommand,
  LendMoneyCommandHandler, // Corrected (was already correct in intent)
  type SellMaterialsCommand,
  type SystemAutoConversionRawCommand,
  SystemAutoConversionRawCommandHandler,
  type SystemAutoConversionSpecialCommand,
  SystemAutoConversionSpecialCommandHandler,
  type SystemConversionCommand,
  SystemConversionCommandHandler,
  // System Commands
  type SystemMaintenanceCommand,
  SystemMaintenanceCommandHandler,
  type SystemProductionCommand,
  SystemProductionCommandHandler,
  type SystemResetCommand,
  SystemResetCommandHandler,
  acquirePropertyHandler, // Corrected
  buildFacilityHandler, // Corrected
  gainInfluenceHandler, // Corrected
  gatherMaterialsHandler, // Corrected
  sellMaterialsHandler, // Corrected
} from '../commands';
import {
  type GameEvent,
  GameEventType,
  createGameEvent,
} from '../events/GameEvent';
import { GamePhase, type GameState } from '../models';
import { type EventStore, InMemoryEventStore } from './EventStore';
import { PhaseManager } from './PhaseManager';

// Union type of all specific command objects
export type AppCommand =
  | GainInfluenceCommand
  | SellMaterialsCommand
  | GatherMaterialsCommand
  | AcquirePropertyCommand
  | BuildFacilityCommand
  | LendMoneyCommand
  // System Command Types
  | SystemMaintenanceCommand
  | SystemProductionCommand
  | SystemConversionCommand
  | SystemAutoConversionRawCommand
  | SystemAutoConversionSpecialCommand
  | SystemResetCommand;
// Add other command types here

export class GameEngine {
  private eventStore: EventStore;
  private phaseManager: PhaseManager;

  constructor(initialState: GameState) {
    this.eventStore = new InMemoryEventStore(initialState);
    this.phaseManager = new PhaseManager(this);
  }

  // Execute a game command
  executeCommand(command: AppCommand): boolean {
    const currentState = this.getCurrentState();
    let isValid = false;
    let events: GameEvent[] = [];

    switch (command.type) {
      case 'GAIN_INFLUENCE':
        isValid = gainInfluenceHandler.validate(
          // Corrected
          command as GainInfluenceCommand,
          currentState
        );
        if (isValid) {
          events = gainInfluenceHandler.execute(
            // Corrected
            command as GainInfluenceCommand,
            currentState
          );
        }
        break;
      case 'SELL_MATERIALS':
        isValid = sellMaterialsHandler.validate(
          // Corrected
          command as SellMaterialsCommand,
          currentState
        );
        if (isValid) {
          events = sellMaterialsHandler.execute(
            // Corrected
            command as SellMaterialsCommand,
            currentState
          );
        }
        break;
      case 'GATHER_MATERIALS':
        isValid = gatherMaterialsHandler.validate(
          // Corrected
          command as GatherMaterialsCommand,
          currentState
        );
        if (isValid) {
          events = gatherMaterialsHandler.execute(
            // Corrected
            command as GatherMaterialsCommand,
            currentState
          );
        }
        break;
      case 'ACQUIRE_PROPERTY':
        isValid = acquirePropertyHandler.validate(
          // Corrected (was AcquirePropertyCommandHandler)
          command as AcquirePropertyCommand,
          currentState
        );
        if (isValid) {
          events = acquirePropertyHandler.execute(
            // Corrected (was AcquirePropertyCommandHandler)
            command as AcquirePropertyCommand,
            currentState
          );
        }
        break;
      case 'BUILD_FACILITY':
        isValid = buildFacilityHandler.validate(
          // Corrected
          command as BuildFacilityCommand,
          currentState
        );
        if (isValid) {
          events = buildFacilityHandler.execute(
            // Corrected
            command as BuildFacilityCommand,
            currentState
          );
        }
        break;
      case 'LEND_MONEY':
        isValid = LendMoneyCommandHandler.validate(
          command as LendMoneyCommand,
          currentState
        );
        if (isValid) {
          events = LendMoneyCommandHandler.execute(
            command as LendMoneyCommand,
            currentState
          );
        }
        break;
      // System Command Cases
      case 'SYSTEM_MAINTENANCE':
        isValid = SystemMaintenanceCommandHandler.validate(
          command as SystemMaintenanceCommand,
          currentState
        );
        if (isValid) {
          events = SystemMaintenanceCommandHandler.execute(
            command as SystemMaintenanceCommand,
            currentState
          );
        }
        break;
      case 'SYSTEM_PRODUCTION':
        isValid = SystemProductionCommandHandler.validate(
          command as SystemProductionCommand,
          currentState
        );
        if (isValid) {
          events = SystemProductionCommandHandler.execute(
            command as SystemProductionCommand,
            currentState
          );
        }
        break;
      case 'SYSTEM_CONVERSION':
        isValid = SystemConversionCommandHandler.validate(
          command as SystemConversionCommand,
          currentState
        );
        if (isValid) {
          events = SystemConversionCommandHandler.execute(
            command as SystemConversionCommand,
            currentState
          );
        }
        break;
      case 'SYSTEM_AUTO_CONVERSION_RAW':
        isValid = SystemAutoConversionRawCommandHandler.validate(
          command as SystemAutoConversionRawCommand,
          currentState
        );
        if (isValid) {
          events = SystemAutoConversionRawCommandHandler.execute(
            command as SystemAutoConversionRawCommand,
            currentState
          );
        }
        break;
      case 'SYSTEM_AUTO_CONVERSION_SPECIAL':
        isValid = SystemAutoConversionSpecialCommandHandler.validate(
          command as SystemAutoConversionSpecialCommand,
          currentState
        );
        if (isValid) {
          events = SystemAutoConversionSpecialCommandHandler.execute(
            command as SystemAutoConversionSpecialCommand,
            currentState
          );
        }
        break;
      case 'SYSTEM_RESET':
        isValid = SystemResetCommandHandler.validate(
          command as SystemResetCommand,
          currentState
        );
        if (isValid) {
          events = SystemResetCommandHandler.execute(
            command as SystemResetCommand,
            currentState
          );
        }
        break;
      default: // Optionally handle unknown command types
      // Ensure all command types in AppCommand union are handled, or add a check:
      {
        // Block scope for _exhaustiveCheck
        const _exhaustiveCheck: never = command;
        console.warn(
          `Unknown command type: ${(_exhaustiveCheck as AppCommand).type}`
        );
        return false;
      }
    }

    if (!isValid) {
      return false;
    }

    // Add events to the store
    for (const event of events) {
      this.eventStore.addEvent(event);
    }

    // Command executed successfully
    return true;
  }

  // Get the current game state
  getCurrentState(): GameState {
    return this.eventStore.getCurrentState();
  }

  // Get all events
  getAllEvents(): GameEvent[] {
    return this.eventStore.getAllEvents();
  }

  // Subscribe to game events
  subscribe(handler: (event: GameEvent) => void): () => void {
    return this.eventStore.subscribe(handler);
  }

  // Start a new game
  startGame(playerId: string): void {
    const _state = this.getCurrentState();
    const event = createGameEvent({
      type: GameEventType.GAME_STARTED,
      playerId,
      payload: { playerId },
      apply: (state: GameState): GameState => ({
        ...state,
        phase: GamePhase.MAINTENANCE,
      }),
    });

    this.eventStore.addEvent(event);

    // Process maintenance phase automatically
    this.phaseManager.processMaintenancePhase();
  }

  // Advance to the next phase
  advancePhase(): void {
    const state = this.getCurrentState();
    const currentPlayerId = state.currentPlayerId;

    switch (state.phase) {
      case GamePhase.MAINTENANCE:
        // Maintenance to Action
        this.changePhase(GamePhase.ACTION, currentPlayerId);
        break;

      case GamePhase.ACTION:
        // Action to Production
        this.changePhase(GamePhase.PRODUCTION, currentPlayerId);
        this.phaseManager.processProductionPhase();
        break;

      case GamePhase.PRODUCTION:
        // Production to Resource Conversion
        this.changePhase(GamePhase.RESOURCE_CONVERSION, currentPlayerId);
        this.phaseManager.processResourceConversionPhase();
        break;

      case GamePhase.RESOURCE_CONVERSION:
        // Resource Conversion to Resource Reset
        this.changePhase(GamePhase.RESOURCE_RESET, currentPlayerId);
        this.phaseManager.processResourceResetPhase();
        break;

      case GamePhase.RESOURCE_RESET:
        // Resource Reset to Maintenance (next round)
        this.advanceRound(currentPlayerId);
        this.changePhase(GamePhase.MAINTENANCE, currentPlayerId);
        this.phaseManager.processMaintenancePhase();
        break;
    }
  }

  // Change to a specific phase
  private changePhase(phase: GamePhase, playerId: string): void {
    const event = createGameEvent({
      type: GameEventType.PHASE_CHANGED,
      playerId,
      payload: { phase },
      apply: (state: GameState): GameState => ({
        ...state,
        phase,
      }),
    });

    this.eventStore.addEvent(event);
  }

  // Advance to the next round
  private advanceRound(playerId: string): void {
    const state = this.getCurrentState();

    const event = createGameEvent({
      type: GameEventType.ROUND_ADVANCED,
      playerId,
      payload: { round: state.round + 1 },
      apply: (state: GameState): GameState => ({
        ...state,
        round: state.round + 1,
        actionPointsRemaining: state.settings.startingActionPoints,
        facilityBuildActionAvailable: true,
      }),
    });

    this.eventStore.addEvent(event);
  }
}
