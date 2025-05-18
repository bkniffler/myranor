import { createFromJsonData } from '../../core/engine/GameEngineFactory';
import { ConsoleUI } from './ConsoleUI';

// Start the console application
export function startConsoleApp(): void {
  try {
    // Create game engine using JSON data
    const engine = createFromJsonData();

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
  } catch (error) {
    console.error('Error starting game:', error);
    process.exit(1);
  }
}
