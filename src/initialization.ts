import { Domain, GameState, HousingFacility, PlayerResources, StorageFacility, Workshop } from './types';

// Initialize player resources with starting values
export function initializePlayerResources(): PlayerResources {
    return {
        gold: 50,
        laborPower: 5,
        baseLaborPower: 5,
        temporaryInfluence: 0,
        permanentInfluence: 0,
        rawMaterials: {
            food: 20,
            wood: 10,
        },
        specialMaterials: {
            tools: 2,
        },
    };
}

// Initial domain for the player
export function createHomeDomain(): Domain {
    const foodStorage: StorageFacility = {
        type: 'foodStorage',
        name: 'Speicher 1',
        maxCapacity: {
            food: 50,
        },
    };

    const housing: HousingFacility = {
        type: 'housing',
        name: 'Baracke 1',
        laborBonus: 2,
    };

    return {
        type: 'domain',
        name: 'Heimathof',
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
}

// Initial workshop for the player
export function createInitialWorkshop(): Workshop {
    return {
        type: 'workshop',
        name: 'Werkelstube',
        maintenanceCost: {
            gold: 1,
            laborPower: 1,
        },
        active: true,
        productionRate: {
            toolsPerWood: 1 / 5, // 1 tool per 5 wood
            maxProduction: 1,
        },
    };
}

// Initial general storage for the player
export function createInitialStorage(): StorageFacility {
    return {
        type: 'generalStorage',
        name: 'Lagerhalle 1',
        maxCapacity: {
            wood: 30,
            tools: 10,
        },
    };
}

// Initialize the game state
export function initializeGameState(): GameState {
    const playerResources = initializePlayerResources();
    const homeDomain = createHomeDomain();
    const initialWorkshop = createInitialWorkshop();
    const initialStorage = createInitialStorage();

    // Calculate base labor power with housing bonus
    const housingBonus = homeDomain.facilities
        .filter(facility => facility.type === 'housing')
        .reduce((bonus, facility) => bonus + (facility as HousingFacility).laborBonus, 0);

    playerResources.baseLaborPower += housingBonus;
    playerResources.laborPower = playerResources.baseLaborPower;

    return {
        round: 1,
        player: {
            resources: playerResources,
            properties: [homeDomain, initialWorkshop, initialStorage],
        },
        actionPointsRemaining: 2, // Start with 2 action points per round
    };
} 