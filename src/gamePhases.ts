import { Domain, GameState, HousingFacility, StorageFacility, Workshop } from './types';

// Function to clear the screen
export function clearScreen(): void {
    console.clear();
}

// Phase 0: Round start and info display
export function displayGameInfo(gameState: GameState): void {
    clearScreen();
    console.log(`\n=== RUNDE ${gameState.round} ===`);

    // Resources section - combined in one line where possible
    console.log('\n--- RESSOURCEN ---');
    console.log(`Gold: ${gameState.player.resources.gold} | AK: ${gameState.player.resources.laborPower} | tE: ${gameState.player.resources.temporaryInfluence}`);

    // Calculate storage capacities
    let foodCapacity = 0;
    let woodCapacity = 0;
    let toolsCapacity = 0;

    for (const property of gameState.player.properties) {
        if ('maxCapacity' in property) {
            const storage = property as StorageFacility;
            if (storage.maxCapacity.food) foodCapacity += storage.maxCapacity.food;
            if (storage.maxCapacity.wood) woodCapacity += storage.maxCapacity.wood;
            if (storage.maxCapacity.tools) toolsCapacity += storage.maxCapacity.tools;
        }
    }

    // Materials section - combined with capacity info
    console.log('\n--- MATERIALIEN ---');
    console.log(`Nahrung: ${gameState.player.resources.rawMaterials.food}/${foodCapacity} | Holz: ${gameState.player.resources.rawMaterials.wood}/${woodCapacity} | Werkzeug: ${gameState.player.resources.specialMaterials.tools}/${toolsCapacity}`);

    // Properties in a more compact format
    console.log('\n--- BESITZTÜMER ---');
    const domains = gameState.player.properties.filter(p => p.type === 'domain');
    const workshops = gameState.player.properties.filter(p => p.type === 'workshop');
    const storages = gameState.player.properties.filter(p => p.type === 'foodStorage' || p.type === 'generalStorage');

    console.log(`Domänen (${domains.length}/3):`);
    domains.forEach(domain => {
        const d = domain as Domain;
        console.log(`  ${d.name}: ${d.active ? 'aktiv' : 'inaktiv'} - Prod: ${d.baseProduction.food} Nahrung, ${d.baseProduction.wood} Holz`);
    });

    console.log(`Werkstätten (${workshops.length}/2):`);
    workshops.forEach(workshop => {
        const w = workshop as Workshop;
        console.log(`  ${w.name}: ${w.active ? 'aktiv' : 'inaktiv'}`);
    });

    console.log(`Lager (${storages.length}/2):`);
    storages.forEach(storage => {
        const s = storage as StorageFacility;
        const capacities: string[] = [];
        if (s.maxCapacity.food) capacities.push(`${s.maxCapacity.food} Nahrung`);
        if (s.maxCapacity.wood) capacities.push(`${s.maxCapacity.wood} Holz`);
        if (s.maxCapacity.tools) capacities.push(`${s.maxCapacity.tools} Werkzeug`);
        console.log(`  ${s.name}: ${capacities.join(', ')}`);
    });
}

// Phase 1: Maintenance phase
export function runMaintenancePhase(gameState: GameState): void {
    console.log('\n=== UNTERHALTSPHASE ===');

    // Reset labor power to base value
    gameState.player.resources.laborPower = gameState.player.resources.baseLaborPower;
    console.log(`AK zurückgesetzt auf ${gameState.player.resources.laborPower}`);

    // Reset temporary influence
    gameState.player.resources.temporaryInfluence = 0;
    console.log('Temporärer Einfluss zurückgesetzt auf 0');

    // Process maintenance for each property
    for (const property of gameState.player.properties) {
        if ('maintenanceCost' in property) {
            // For domains and workshops that require maintenance
            const maintenanceProperty = property as Domain | Workshop;
            console.log(`\nUnterhalt für ${property.name} (${property.type}):`);

            // Check if player has enough gold
            if (maintenanceProperty.maintenanceCost.gold > 0) {
                console.log(`- ${maintenanceProperty.maintenanceCost.gold} Gold`);
            }

            // Check if property needs labor power (workshops)
            if ('laborPower' in maintenanceProperty.maintenanceCost && maintenanceProperty.maintenanceCost.laborPower > 0) {
                console.log(`- ${maintenanceProperty.maintenanceCost.laborPower} AK`);
            }

            // Try to pay maintenance
            let canPayMaintenance = true;

            // Check for gold
            if (maintenanceProperty.maintenanceCost.gold > gameState.player.resources.gold) {
                canPayMaintenance = false;
            }

            // Check for labor power (workshops)
            if ('laborPower' in maintenanceProperty.maintenanceCost &&
                maintenanceProperty.maintenanceCost.laborPower > gameState.player.resources.laborPower) {
                canPayMaintenance = false;
            }

            // Pay maintenance if possible
            if (canPayMaintenance) {
                gameState.player.resources.gold -= maintenanceProperty.maintenanceCost.gold;

                if ('laborPower' in maintenanceProperty.maintenanceCost) {
                    gameState.player.resources.laborPower -= maintenanceProperty.maintenanceCost.laborPower;
                }

                maintenanceProperty.active = true;
                console.log(`Unterhalt bezahlt! ${property.name} ist aktiv für diese Runde.`);
            } else {
                maintenanceProperty.active = false;
                console.log(`Unterhalt konnte nicht bezahlt werden! ${property.name} ist inaktiv für diese Runde.`);
            }
        }
    }
}

// Phase 3: Production phase
export function runProductionPhase(gameState: GameState): void {
    console.log('\n=== PRODUKTIONSPHASE ===');

    // Process domain production
    for (const property of gameState.player.properties) {
        if (property.type === 'domain') {
            const domain = property as Domain;

            if (domain.active) {
                // Get food storage capacity for this domain
                const foodStorage = domain.facilities.find(f => f.type === 'foodStorage') as StorageFacility | undefined;
                let foodCapacity = foodStorage?.maxCapacity.food || 0;

                // Calculate how much food can be stored
                const currentFood = gameState.player.resources.rawMaterials.food;
                const maxFoodProduction = Math.min(domain.baseProduction.food, foodCapacity - currentFood);

                if (maxFoodProduction > 0) {
                    gameState.player.resources.rawMaterials.food += maxFoodProduction;
                    console.log(`${domain.name} produziert ${maxFoodProduction} Nahrung.`);
                } else if (domain.baseProduction.food > 0) {
                    console.log(`${domain.name} könnte ${domain.baseProduction.food} Nahrung produzieren, aber der Speicher ist voll!`);
                }

                // Add wood (no specific storage for wood on domains)
                gameState.player.resources.rawMaterials.wood += domain.baseProduction.wood;
                console.log(`${domain.name} produziert ${domain.baseProduction.wood} Holz.`);
            } else {
                console.log(`${domain.name} ist inaktiv und produziert nichts.`);
            }
        }
    }

    // Process workshop production
    for (const property of gameState.player.properties) {
        if (property.type === 'workshop') {
            const workshop = property as Workshop;

            if (workshop.active) {
                // Calculate wood needed for full production
                const woodNeeded = Math.floor(workshop.productionRate.maxProduction / workshop.productionRate.toolsPerWood);

                // Check if we have enough wood
                const availableWood = Math.min(woodNeeded, gameState.player.resources.rawMaterials.wood);

                if (availableWood > 0) {
                    // Calculate how many tools to produce
                    const toolsToAdd = Math.floor(availableWood * workshop.productionRate.toolsPerWood);

                    // Find tool storage capacity
                    let toolCapacity = 0;
                    for (const prop of gameState.player.properties) {
                        if ('maxCapacity' in prop && prop.maxCapacity.tools) {
                            toolCapacity += prop.maxCapacity.tools;
                        }
                    }

                    const currentTools = gameState.player.resources.specialMaterials.tools;
                    const maxToolsProduction = Math.min(toolsToAdd, toolCapacity - currentTools);

                    if (maxToolsProduction > 0) {
                        // Consume wood and add tools
                        gameState.player.resources.rawMaterials.wood -= availableWood;
                        gameState.player.resources.specialMaterials.tools += maxToolsProduction;

                        console.log(`${workshop.name} verarbeitet ${availableWood} Holz zu ${maxToolsProduction} Werkzeug.`);
                    } else if (toolsToAdd > 0) {
                        console.log(`${workshop.name} könnte Werkzeug produzieren, aber der Lagerplatz für Werkzeug ist voll!`);
                    }
                } else {
                    console.log(`${workshop.name} hat nicht genug Holz für die Produktion.`);
                }
            } else {
                console.log(`${workshop.name} ist inaktiv und produziert nichts.`);
            }
        }
    }
}

// Phase 4: Resource conversion phase
export function runResourceConversionPhase(gameState: GameState): void {
    console.log('\n=== RESSOURCENUMWANDLUNG ===');

    // Calculate storage capacities
    let foodCapacity = 0;
    let woodCapacity = 0;
    let toolsCapacity = 0;

    for (const property of gameState.player.properties) {
        if ('maxCapacity' in property) {
            const storage = property as StorageFacility;
            if (storage.maxCapacity.food) foodCapacity += storage.maxCapacity.food;
            if (storage.maxCapacity.wood) woodCapacity += storage.maxCapacity.wood;
            if (storage.maxCapacity.tools) toolsCapacity += storage.maxCapacity.tools;
        }
    }

    // Check for excess resources
    const excessFood = Math.max(0, gameState.player.resources.rawMaterials.food - foodCapacity);
    const excessWood = Math.max(0, gameState.player.resources.rawMaterials.wood - woodCapacity);
    const excessTools = Math.max(0, gameState.player.resources.specialMaterials.tools - toolsCapacity);

    // Convert excess raw materials to gold (4 RM = 1 Gold)
    const totalExcessRM = excessFood + excessWood;
    const goldFromRM = Math.floor(totalExcessRM / 4);

    // Convert excess special materials to gold (1 SM = 2 Gold)
    const goldFromSM = excessTools * 2;

    // Add gold and reduce resources
    if (goldFromRM > 0 || goldFromSM > 0) {
        gameState.player.resources.gold += goldFromRM + goldFromSM;

        // Adjust resources
        if (excessFood > 0) {
            const foodToConvert = Math.min(excessFood, totalExcessRM * (excessFood / totalExcessRM));
            gameState.player.resources.rawMaterials.food = Math.min(foodCapacity, gameState.player.resources.rawMaterials.food);
            console.log(`${foodToConvert} überschüssige Nahrung wurde zu Gold umgewandelt.`);
        }

        if (excessWood > 0) {
            const woodToConvert = Math.min(excessWood, totalExcessRM * (excessWood / totalExcessRM));
            gameState.player.resources.rawMaterials.wood = Math.min(woodCapacity, gameState.player.resources.rawMaterials.wood);
            console.log(`${woodToConvert} überschüssiges Holz wurde zu Gold umgewandelt.`);
        }

        if (excessTools > 0) {
            gameState.player.resources.specialMaterials.tools = Math.min(toolsCapacity, gameState.player.resources.specialMaterials.tools);
            console.log(`${excessTools} überschüssiges Werkzeug wurde zu Gold umgewandelt.`);
        }

        console.log(`Insgesamt wurden ${goldFromRM + goldFromSM} Gold aus überschüssigen Ressourcen gewonnen.`);
    } else {
        console.log('Keine überschüssigen Ressourcen gefunden.');
    }
}

// Phase 5: Game end check
export function checkGameEnd(gameState: GameState): { gameOver: boolean, message?: string } {
    // Check for bankruptcy
    if (gameState.player.resources.gold < -20) {
        return {
            gameOver: true,
            message: 'BANKROTT! Du hast zu viele Schulden angehäuft und dein Imperium ist gefallen.'
        };
    }

    // Check for round limit
    if (gameState.round > 30) {
        return {
            gameOver: true,
            message: 'SIEG! Du hast 30 Runden erfolgreich überlebt und dein Imperium hat die Zeitprobe bestanden.'
        };
    }

    // Game continues
    return { gameOver: false };
}

// Reset action points for new round
export function resetActionPoints(gameState: GameState): void {
    gameState.actionPointsRemaining = 2;
} 