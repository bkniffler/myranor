import { initializeGameState } from './initialization';
import {
    displayGameInfo,
    runMaintenancePhase,
    runProductionPhase,
    runResourceConversionPhase,
    checkGameEnd,
    resetActionPoints,
    clearScreen
} from './gamePhases';
import { runActionPhase, closeInputInterface } from './playerActions';
import { GameState } from './types';

// Welcome message
function showWelcome() {
    clearScreen();
    console.log('=== WILLKOMMEN ZU MYRANOR: STRATEGIESPIEL V1 ===');
    console.log('\nIn diesem Spiel verwaltest du deine Ressourcen, baust dein Reich auf und triffst strategische Entscheidungen.');
    console.log('Du gewinnst, wenn du 30 Runden überstehst. Du verlierst, wenn dein Gold unter -20 fällt.\n');
    console.log('Drücke Enter, um zu beginnen...');
}

// Main game loop
async function startGame() {
    // Show welcome screen
    showWelcome();
    await new Promise<void>((resolve) => {
        process.stdin.once('data', () => {
            resolve();
        });
    });

    // Initialize game state
    const gameState: GameState = initializeGameState();
    let gameOver = false;

    // Main game loop
    while (!gameOver) {
        // Phase 0: Display game information
        displayGameInfo(gameState);

        // Phase 1: Maintenance phase
        runMaintenancePhase(gameState);

        // Phase 2: Action phase (player interaction)
        await runActionPhase(gameState);

        // Phase 3: Production phase
        clearScreen();
        displayGameInfo(gameState);
        runProductionPhase(gameState);

        // Phase 4: Resource conversion phase
        runResourceConversionPhase(gameState);

        // Phase 5: Game end check
        const gameEndResult = checkGameEnd(gameState);
        if (gameEndResult.gameOver) {
            clearScreen();
            console.log(`\n=== SPIELENDE ===\n${gameEndResult.message}`);
            gameOver = true;
        } else {
            // Prepare for next round
            gameState.round += 1;
            resetActionPoints(gameState);

            console.log('\nDrücke Enter, um die nächste Runde zu beginnen...');
            await new Promise<void>((resolve) => {
                process.stdin.once('data', () => {
                    resolve();
                });
            });
        }
    }

    // Close readline interface when game ends
    closeInputInterface();
    console.log('\nDanke fürs Spielen!');
}

// Start the game
startGame().catch((error) => {
    console.error('Ein Fehler ist aufgetreten:', error);
    process.exit(1);
});
