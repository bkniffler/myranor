// Player resource types
export interface PlayerResources {
    gold: number;
    laborPower: number;
    baseLaborPower: number;
    temporaryInfluence: number;
    permanentInfluence: number;
    rawMaterials: {
        food: number;
        wood: number;
    };
    specialMaterials: {
        tools: number;
    };
}

// Facility types
export interface StorageFacility {
    type: 'foodStorage' | 'generalStorage';
    name: string;
    maxCapacity: {
        food?: number;
        wood?: number;
        tools?: number;
    };
}

export interface HousingFacility {
    type: 'housing';
    name: string;
    laborBonus: number;
}

export interface Workshop {
    type: 'workshop';
    name: string;
    maintenanceCost: {
        gold: number;
        laborPower: number;
    };
    active: boolean;
    productionRate: {
        toolsPerWood: number;
        maxProduction: number;
    };
}

export interface Domain {
    type: 'domain';
    name: string;
    maintenanceCost: {
        gold: number;
    };
    active: boolean;
    baseProduction: {
        food: number;
        wood: number;
    };
    facilities: (StorageFacility | HousingFacility)[];
}

export type PlayerProperty = Domain | Workshop | StorageFacility;

// Game state
export interface GameState {
    round: number;
    player: {
        resources: PlayerResources;
        properties: (Domain | Workshop | StorageFacility)[];
    };
    actionPointsRemaining: number;
} 