import * as readline from 'readline';
import { Domain, GameState } from './types';
import { clearScreen, displayGameInfo } from './gamePhases';
import { 
  ActionType,
  performAction,
  rollD20,
  MaterialType,
  PropertyType
} from './actions';

// Create readline interface for CLI input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Helper function to get user input
function prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

// Helper function to get numeric input with validation
async function promptNumber(question: string, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): Promise<number> {
    while (true) {
        const input = await prompt(question);
        const num = Number(input);

        if (!isNaN(num) && num >= min && num <= max) {
            return num;
        }

        clearScreen();
        console.log(`Bitte gib eine gültige Zahl zwischen ${min} und ${max} ein.`);
    }
}

// Helper function to wait for user to press Enter
async function waitForEnter(): Promise<void> {
    await prompt('Drücke Enter, um fortzufahren...');
}

// Action 1: Gain influence
export async function gainInfluence(gameState: GameState): Promise<void> {
    clearScreen();
    displayGameInfo(gameState);
    console.log('\n=== EINFLUSS GEWINNEN ===');

    // Ask for gold amount
    const goldAmount = await promptNumber('Wie viel Gold möchtest du investieren? (min. 1): ', 1);

    // Execute action and get result
    const result = performAction(gameState, {
        type: ActionType.GAIN_INFLUENCE,
        payload: { goldAmount }
    });

    clearScreen();
    displayGameInfo(gameState);
    console.log(result.message);
    await waitForEnter();
}

// Action 2: Sell materials for gold
export async function sellMaterials(gameState: GameState): Promise<void> {
    clearScreen();
    displayGameInfo(gameState);
    console.log('\n=== MATERIALIEN VERKAUFEN ===');

    // Show material options
    console.log('Welches Material möchtest du verkaufen?');
    console.log(`(1) Nahrung (${gameState.player.resources.rawMaterials.food} verfügbar) - 5 Nahrung = 1 Gold`);
    console.log(`(2) Holz (${gameState.player.resources.rawMaterials.wood} verfügbar) - 4 Holz = 1 Gold`);
    console.log(`(3) Werkzeug (${gameState.player.resources.specialMaterials.tools} verfügbar) - 1 Werkzeug = 2 Gold`);

    // Get material choice
    const materialChoice = await promptNumber('Wähle eine Option (1-3): ', 1, 3);

    let materialType: MaterialType;

    switch (materialChoice) {
        case 1:
            materialType = 'food';
            break;
        case 2:
            materialType = 'wood';
            break;
        case 3:
            materialType = 'tools';
            break;
        default:
            clearScreen();
            displayGameInfo(gameState);
            console.log('Ungültige Auswahl!');
            await waitForEnter();
            return;
    }

    // Check if player has enough resources for a basic check before asking for amount
    const checkResult = performAction(gameState, {
        type: ActionType.SELL_MATERIALS,
        payload: { materialType, amount: 0 }
    });
    if (!checkResult.success) {
        clearScreen();
        displayGameInfo(gameState);
        console.log(checkResult.message);
        await waitForEnter();
        return;
    }

    // Get available amount based on material type
    let availableAmount: number;
    switch (materialType) {
        case 'food':
            availableAmount = gameState.player.resources.rawMaterials.food;
            break;
        case 'wood':
            availableAmount = gameState.player.resources.rawMaterials.wood;
            break;
        case 'tools':
            availableAmount = gameState.player.resources.specialMaterials.tools;
            break;
    }

    // Ask for amount to sell
    const amount = await promptNumber(`Wie viel möchtest du verkaufen? (1-${availableAmount}): `, 1, availableAmount);

    // Execute action and get result
    const result = performAction(gameState, {
        type: ActionType.SELL_MATERIALS,
        payload: { materialType, amount }
    });

    clearScreen();
    displayGameInfo(gameState);
    console.log(result.message);
    await waitForEnter();
}

// Action 3: Gain materials (domain management)
export async function gainMaterials(gameState: GameState): Promise<void> {
    clearScreen();
    displayGameInfo(gameState);
    console.log('\n=== MATERIAL GEWINNEN ===');

    // Find domains
    const domains = gameState.player.properties.filter(p => p.type === 'domain') as Domain[];

    if (domains.length === 0) {
        console.log('Du besitzt keine Domänen, die du verwalten könntest!');
        await waitForEnter();
        return;
    }

    // Show domain options
    console.log('Welche Domäne möchtest du verwalten?');

    domains.forEach((domain, index) => {
        const status = domain.active ? 'aktiv' : 'inaktiv';
        console.log(`(${index + 1}) ${domain.name} (${status})`);
    });

    // Get domain choice
    const domainIndex = await promptNumber(`Wähle eine Domäne (1-${domains.length}): `, 1, domains.length) - 1;

    // Execute action and get result
    const result = performAction(gameState, {
        type: ActionType.GATHER_MATERIALS,
        payload: { domainIndex }
    });

    clearScreen();
    displayGameInfo(gameState);

    // If roll was made, show it
    if (result.roll) {
        console.log(`Würfelwurf (d20): ${result.roll}`);
    }

    console.log(result.message);
    await waitForEnter();
}

// Action 4: Acquire new property
export async function acquireProperty(gameState: GameState): Promise<void> {
    clearScreen();
    displayGameInfo(gameState);
    console.log('\n=== NEUEN POSTEN ERWERBEN ===');

    // Check if player has enough labor power for a basic check
    if (gameState.player.resources.laborPower < 1) {
        console.log('Du hast nicht genug Arbeitskraft für diese Aktion!');
        await waitForEnter();
        return;
    }

    // Show property options
    console.log('Welchen Posten möchtest du erwerben?');
    console.log('(1) Kleine Ländliche Domäne - Kosten: 30 Gold, 5 Werkzeug');
    console.log('(2) Kleine Werkstatt - Kosten: 15 Gold, 8 Holz');
    console.log('(3) Kleines Lager - Kosten: 10 Gold, 5 Holz');
    console.log('(4) Zurück');

    // Get property choice
    const propertyChoice = await promptNumber('Wähle eine Option (1-4): ', 1, 4);

    if (propertyChoice === 4) {
        console.log('Kauf abgebrochen.');
        await waitForEnter();
        return;
    }

    // Map choice to property type
    let propertyType: PropertyType;
    switch (propertyChoice) {
        case 1:
            propertyType = 'domain';
            break;
        case 2:
            propertyType = 'workshop';
            break;
        case 3:
            propertyType = 'storage';
            break;
        default:
            return;
    }

    // Get name for new property
    let propertyTypeName: string;
    switch (propertyType) {
        case 'domain':
            propertyTypeName = 'Domäne';
            break;
        case 'workshop':
            propertyTypeName = 'Werkstatt';
            break;
        case 'storage':
            propertyTypeName = 'Lager';
            break;
    }

    const propertyName = await prompt(`Gib einen Namen für deine neue ${propertyTypeName} ein: `);

    // Execute action and get result
    const result = performAction(gameState, {
        type: ActionType.ACQUIRE_PROPERTY,
        payload: { propertyType, propertyName }
    });

    clearScreen();
    displayGameInfo(gameState);
    console.log(result.message);
    await waitForEnter();
}

// Process player actions
export async function runActionPhase(gameState: GameState): Promise<void> {
    let continueActionPhase = true;

    while (gameState.actionPointsRemaining > 0 && continueActionPhase) {
        clearScreen();
        displayGameInfo(gameState);
        console.log('\n=== AKTIONSPHASE ===');
        console.log(`\nDu hast noch ${gameState.actionPointsRemaining} Aktionspunkt(e) für diese Runde.`);
        console.log(`Arbeitskraft (AK): ${gameState.player.resources.laborPower}`);
        console.log('\nWas möchtest du tun?');
        console.log('(1) Einfluss gewinnen');
        console.log('(2) Materialien verkaufen');
        console.log('(3) Material gewinnen (Domänenverwaltung)');
        console.log('(4) Neuen Posten erwerben / Einrichtung bauen');
        console.log('(5) Runde beenden');

        const actionChoice = await promptNumber('Wähle eine Aktion (1-5): ', 1, 5);

        if (actionChoice === 5) {
            console.log('Runde wird beendet...');
            continueActionPhase = false;
            break;
        }

        switch (actionChoice) {
            case 1:
                await gainInfluence(gameState);
                break;
            case 2:
                await sellMaterials(gameState);
                break;
            case 3:
                await gainMaterials(gameState);
                break;
            case 4:
                await acquireProperty(gameState);
                break;
        }
    }

    if (gameState.actionPointsRemaining === 0) {
        clearScreen();
        displayGameInfo(gameState);
        console.log('\nDu hast keine Aktionspunkte mehr für diese Runde.');
        await waitForEnter();
    }
}

// Close readline interface
export function closeInputInterface(): void {
    rl.close();
} 