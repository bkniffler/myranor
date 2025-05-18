import * as readline from 'readline';
import { Domain, GameState, StorageFacility, Workshop } from './types';
import { clearScreen, displayGameInfo } from './gamePhases';

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

// Helper function for d20 roll
function rollD20(): number {
    return Math.floor(Math.random() * 20) + 1;
}

// Action 1: Gain influence
export async function gainInfluence(gameState: GameState): Promise<void> {
    clearScreen();
    displayGameInfo(gameState);
    console.log('\n=== EINFLUSS GEWINNEN ===');

    // Check if player has enough labor power
    if (gameState.player.resources.laborPower < 1) {
        console.log('Du hast nicht genug Arbeitskraft für diese Aktion!');
        await waitForEnter();
        return;
    }

    // Ask for gold amount
    const goldAmount = await promptNumber('Wie viel Gold möchtest du investieren? (min. 1): ', 1);

    // Check if player has enough gold
    if (goldAmount > gameState.player.resources.gold) {
        console.log('Du hast nicht genug Gold für diese Investition!');
        await waitForEnter();
        return;
    }

    // Calculate influence gain (round down)
    const influenceGain = Math.floor(goldAmount / 2);

    // Apply changes
    gameState.player.resources.gold -= goldAmount;
    gameState.player.resources.laborPower -= 1;
    gameState.player.resources.temporaryInfluence += influenceGain;
    gameState.actionPointsRemaining -= 1;

    clearScreen();
    displayGameInfo(gameState);
    console.log(`Du hast ${goldAmount} Gold investiert und ${influenceGain} temporären Einfluss gewonnen.`);
    await waitForEnter();
}

// Helper function to wait for user to press Enter
async function waitForEnter(): Promise<void> {
    await prompt('Drücke Enter, um fortzufahren...');
}

// Action 2: Sell materials for gold
export async function sellMaterials(gameState: GameState): Promise<void> {
    clearScreen();
    displayGameInfo(gameState);
    console.log('\n=== MATERIALIEN VERKAUFEN ===');

    // Check if player has enough labor power
    if (gameState.player.resources.laborPower < 1) {
        console.log('Du hast nicht genug Arbeitskraft für diese Aktion!');
        await waitForEnter();
        return;
    }

    // Show material options
    console.log('Welches Material möchtest du verkaufen?');
    console.log(`(1) Nahrung (${gameState.player.resources.rawMaterials.food} verfügbar) - 5 Nahrung = 1 Gold`);
    console.log(`(2) Holz (${gameState.player.resources.rawMaterials.wood} verfügbar) - 4 Holz = 1 Gold`);
    console.log(`(3) Werkzeug (${gameState.player.resources.specialMaterials.tools} verfügbar) - 1 Werkzeug = 2 Gold`);

    // Get material choice
    const materialChoice = await promptNumber('Wähle eine Option (1-3): ', 1, 3);

    let materialType: string;
    let conversionRate: number;
    let availableAmount: number;

    switch (materialChoice) {
        case 1:
            materialType = 'Nahrung';
            conversionRate = 0.2; // 1 Nahrung = 0.2 Gold
            availableAmount = gameState.player.resources.rawMaterials.food;
            break;
        case 2:
            materialType = 'Holz';
            conversionRate = 0.25; // 1 Holz = 0.25 Gold
            availableAmount = gameState.player.resources.rawMaterials.wood;
            break;
        case 3:
            materialType = 'Werkzeug';
            conversionRate = 2; // 1 Werkzeug = 2 Gold
            availableAmount = gameState.player.resources.specialMaterials.tools;
            break;
        default:
            console.log('Ungültige Auswahl!');
            await waitForEnter();
            return;
    }

    // Check if player has any of the chosen material
    if (availableAmount <= 0) {
        console.log(`Du hast kein ${materialType} zum Verkaufen!`);
        await waitForEnter();
        return;
    }

    // Ask for amount to sell
    const sellAmount = await promptNumber(`Wie viel ${materialType} möchtest du verkaufen? (1-${availableAmount}): `, 1, availableAmount);

    // Calculate gold to receive
    const goldGain = Math.floor(sellAmount * conversionRate);

    // Apply changes
    gameState.player.resources.gold += goldGain;
    gameState.player.resources.laborPower -= 1;
    gameState.actionPointsRemaining -= 1;

    // Update specific resource
    switch (materialChoice) {
        case 1:
            gameState.player.resources.rawMaterials.food -= sellAmount;
            break;
        case 2:
            gameState.player.resources.rawMaterials.wood -= sellAmount;
            break;
        case 3:
            gameState.player.resources.specialMaterials.tools -= sellAmount;
            break;
    }

    clearScreen();
    displayGameInfo(gameState);
    console.log(`Du hast ${sellAmount} ${materialType} für ${goldGain} Gold verkauft.`);
    await waitForEnter();
}

// Action 3: Gain materials (domain management)
export async function gainMaterials(gameState: GameState): Promise<void> {
    clearScreen();
    displayGameInfo(gameState);
    console.log('\n=== MATERIAL GEWINNEN ===');

    // Check if player has enough labor power
    if (gameState.player.resources.laborPower < 1) {
        console.log('Du hast nicht genug Arbeitskraft für diese Aktion!');
        await waitForEnter();
        return;
    }

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
    const selectedDomain = domains[domainIndex];

    // Check if domain is active
    if (!selectedDomain.active) {
        console.log(`${selectedDomain.name} ist inaktiv und kann keine zusätzlichen Materialien produzieren!`);
        await waitForEnter();
        return;
    }

    // Roll d20 for success check
    const roll = rollD20();
    const difficulty = 12;

    console.log(`Würfelwurf (d20): ${roll}`);

    if (roll >= difficulty) {
        // Success - add extra food
        const extraFood = 5;

        // Check food storage capacity
        const foodStorage = selectedDomain.facilities.find(f => f.type === 'foodStorage') as StorageFacility | undefined;
        const foodCapacity = foodStorage?.maxCapacity.food || 0;
        const currentFood = gameState.player.resources.rawMaterials.food;

        // Calculate how much food can be stored
        const foodToAdd = Math.min(extraFood, foodCapacity - currentFood);

        if (foodToAdd > 0) {
            gameState.player.resources.rawMaterials.food += foodToAdd;
            console.log(`Erfolg! ${selectedDomain.name} produziert zusätzlich ${foodToAdd} Nahrung.`);

            if (foodToAdd < extraFood) {
                console.log(`Hinweis: ${extraFood - foodToAdd} Nahrung ging verloren, da dein Speicher voll ist!`);
            }
        } else {
            console.log('Erfolg! Aber dein Nahrungsspeicher ist bereits voll!');
        }
    } else {
        // Failure
        console.log(`Fehlschlag! ${selectedDomain.name} produziert keine zusätzlichen Materialien.`);
    }

    // Apply action cost
    gameState.player.resources.laborPower -= 1;
    gameState.actionPointsRemaining -= 1;

    await waitForEnter();
}

// Action 4: Acquire new property
export async function acquireProperty(gameState: GameState): Promise<void> {
    clearScreen();
    displayGameInfo(gameState);
    console.log('\n=== NEUEN POSTEN ERWERBEN ===');

    // Check if player has enough labor power
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

    // Check for property limits
    const domains = gameState.player.properties.filter(p => p.type === 'domain');
    const workshops = gameState.player.properties.filter(p => p.type === 'workshop');
    const storages = gameState.player.properties.filter(p =>
        p.type === 'generalStorage' || p.type === 'foodStorage'
    );

    // Check limits based on selected property
    switch (propertyChoice) {
        case 1: // Domain
            if (domains.length >= 3) {
                console.log('Du kannst nicht mehr als 3 Domänen besitzen!');
                await waitForEnter();
                return;
            }
            break;
        case 2: // Workshop
            if (workshops.length >= 2) {
                console.log('Du kannst nicht mehr als 2 Werkstätten besitzen!');
                await waitForEnter();
                return;
            }
            break;
        case 3: // Storage
            if (storages.length >= 2) {
                console.log('Du kannst nicht mehr als 2 Lager besitzen!');
                await waitForEnter();
                return;
            }
            break;
    }

    // Check for resources and create property based on choice
    switch (propertyChoice) {
        case 1: // Domain
            // Check resources
            if (gameState.player.resources.gold < 30 || gameState.player.resources.specialMaterials.tools < 5) {
                console.log('Du hast nicht genug Ressourcen für eine neue Domäne!');
                await waitForEnter();
                return;
            }

            // Get name for new domain
            const domainName = await prompt('Gib einen Namen für deine neue Domäne ein: ');

            // Create new domain with standard facilities
            const foodStorage: StorageFacility = {
                type: 'foodStorage',
                name: 'Speicher 1',
                maxCapacity: {
                    food: 50,
                },
            };

            const housing = {
                type: 'housing' as const,
                name: 'Baracke 1',
                laborBonus: 2,
            };

            const newDomain: Domain = {
                type: 'domain',
                name: domainName,
                maintenanceCost: {
                    gold: 2,
                },
                active: true,
                baseProduction: {
                    food: 5,
                    wood: 2,
                },
                facilities: [foodStorage, housing],
            };

            // Add domain and update resources
            gameState.player.properties.push(newDomain);
            gameState.player.resources.gold -= 30;
            gameState.player.resources.specialMaterials.tools -= 5;
            gameState.player.resources.baseLaborPower += 2; // Add labor bonus from new housing

            console.log(`Domäne "${domainName}" erfolgreich erworben!`);
            break;

        case 2: // Workshop
            // Check resources
            if (gameState.player.resources.gold < 15 || gameState.player.resources.rawMaterials.wood < 8) {
                console.log('Du hast nicht genug Ressourcen für eine neue Werkstatt!');
                await waitForEnter();
                return;
            }

            // Get name for new workshop
            const workshopName = await prompt('Gib einen Namen für deine neue Werkstatt ein: ');

            // Create new workshop
            const newWorkshop: Workshop = {
                type: 'workshop',
                name: workshopName,
                maintenanceCost: {
                    gold: 1,
                    laborPower: 1,
                },
                active: true,
                productionRate: {
                    toolsPerWood: 1 / 5,
                    maxProduction: 1,
                },
            };

            // Add workshop and update resources
            gameState.player.properties.push(newWorkshop);
            gameState.player.resources.gold -= 15;
            gameState.player.resources.rawMaterials.wood -= 8;

            console.log(`Werkstatt "${workshopName}" erfolgreich erworben!`);
            break;

        case 3: // Storage
            // Check resources
            if (gameState.player.resources.gold < 10 || gameState.player.resources.rawMaterials.wood < 5) {
                console.log('Du hast nicht genug Ressourcen für ein neues Lager!');
                await waitForEnter();
                return;
            }

            // Get name for new storage
            const storageName = await prompt('Gib einen Namen für dein neues Lager ein: ');

            // Create new storage
            const newStorage: StorageFacility = {
                type: 'generalStorage',
                name: storageName,
                maxCapacity: {
                    wood: 30,
                    tools: 10,
                },
            };

            // Add storage and update resources
            gameState.player.properties.push(newStorage);
            gameState.player.resources.gold -= 10;
            gameState.player.resources.rawMaterials.wood -= 5;

            console.log(`Lager "${storageName}" erfolgreich erworben!`);
            break;
    }

    // Apply action cost
    gameState.player.resources.laborPower -= 1;
    gameState.actionPointsRemaining -= 1;

    clearScreen();
    displayGameInfo(gameState);
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