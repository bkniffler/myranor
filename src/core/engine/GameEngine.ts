import type { GameCommand } from '../commands/GameCommand';
import {
  type GameEvent,
  GameEventType,
  createGameEvent,
} from '../events/GameEvent';
import { GamePhase, type GameState } from '../models';
import { type EventStore, InMemoryEventStore } from './EventStore';
import { PhaseManager } from './PhaseManager';

export class GameEngine {
  private eventStore: EventStore;
  private phaseManager: PhaseManager;

  constructor(initialState: GameState) {
    this.eventStore = new InMemoryEventStore(initialState);
    this.phaseManager = new PhaseManager(this);
  }

  // Execute a game command
  executeCommand(command: GameCommand): boolean {
    const currentState = this.getCurrentState();

    // Validate command
    if (!command.validate(currentState)) {
      return false;
    }

    // Generate events from the command
    const events = command.execute(currentState);

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
  startGame(playerId: string, playerName = 'Player 1'): void {
    const _state = this.getCurrentState();
    const event = createGameEvent({
      type: GameEventType.GAME_STARTED,
      playerId,
      payload: { playerId, playerName },
      apply: (state: GameState): GameState => {
        // Update the player name in state
        const player = state.players[playerId];

        return {
          ...state,
          phase: GamePhase.MAINTENANCE,
          players: {
            ...state.players,
            [playerId]: {
              ...player,
              name: playerName,
            },
          },
        };
      },
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
  private changePhase(newPhase: GamePhase, playerId: string): void {
    const state = this.getCurrentState();
    const previousPhase = state.phase;

    const event = createGameEvent({
      type: GameEventType.PHASE_CHANGED,
      playerId,
      payload: {
        newPhase,
        previousPhase,
      },
      apply: (state: GameState): GameState => ({
        ...state,
        phase: newPhase,
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
