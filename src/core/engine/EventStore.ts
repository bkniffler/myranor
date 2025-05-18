import type { GameEvent } from '../events/GameEvent';
import type { GameState } from '../models';

export interface EventStore {
  // Add an event to the store
  addEvent(event: GameEvent): void;

  // Get all events
  getAllEvents(): GameEvent[];

  // Get events for a specific player
  getPlayerEvents(playerId: string): GameEvent[];

  // Get events in a time range
  getEventsByTimeRange(startTime: number, endTime: number): GameEvent[];

  // Get events by type
  getEventsByType(type: string): GameEvent[];

  // Generate current state by applying all events
  getCurrentState(): GameState;

  // Get state at a specific point in time
  getStateAtTime(timestamp: number): GameState;

  // Subscribe to new events
  subscribe(handler: (event: GameEvent) => void): () => void;
}

export class InMemoryEventStore implements EventStore {
  private events: GameEvent[] = [];
  private subscribers: ((event: GameEvent) => void)[] = [];
  private initialState: GameState;

  constructor(initialState: GameState) {
    this.initialState = initialState;
  }

  addEvent(event: GameEvent): void {
    this.events.push(event);
    // Notify subscribers
    for (const handler of this.subscribers) {
      handler(event);
    }
  }

  getAllEvents(): GameEvent[] {
    return [...this.events];
  }

  getPlayerEvents(playerId: string): GameEvent[] {
    return this.events.filter((event) => event.playerId === playerId);
  }

  getEventsByTimeRange(startTime: number, endTime: number): GameEvent[] {
    return this.events.filter(
      (event) => event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  getEventsByType(type: string): GameEvent[] {
    return this.events.filter((event) => event.type === type);
  }

  getCurrentState(): GameState {
    return this.generateStateFromEvents(this.events);
  }

  getStateAtTime(timestamp: number): GameState {
    const relevantEvents = this.events.filter(
      (event) => event.timestamp <= timestamp
    );
    return this.generateStateFromEvents(relevantEvents);
  }

  subscribe(handler: (event: GameEvent) => void): () => void {
    this.subscribers.push(handler);

    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter((h) => h !== handler);
    };
  }

  private generateStateFromEvents(events: GameEvent[]): GameState {
    // Start with the initial state
    return events.reduce(
      (state, event) => {
        // Apply each event to transform the state
        return event.apply(state);
      },
      { ...this.initialState }
    );
  }
}
