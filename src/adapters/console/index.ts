import { GameEngine } from '../../core';
import { createInitialGameState } from '../../core/models';
import { ConsoleUI } from './ConsoleUI';

// Start the console application
export function startConsoleApp(): void {
  // Create a new player ID
  const playerId = `player_${Date.now()}`;

  // Create initial game state
  const initialState = createInitialGameState(playerId, 'Player');

  // Create game engine
  const engine = new GameEngine(initialState);

  // Create console UI
  const ui = new ConsoleUI(engine);

  // Start the UI
  ui.start();

  // Handle clean shutdown
  process.on('SIGINT', () => {
    console.log('\nSpiel wird beendet...');
    ui.close();
    process.exit(0);
  });
}
