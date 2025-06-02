import {
  GameActionType,
  GamePhase,
  type GameState,
  MarketPriceCategory,
  MaterialCategory,
} from '../models';
import { DataLoader } from '../utils';
import { GameEngine } from './GameEngine';

// Create game engine from JSON data
export function createFromJsonData(): GameEngine {
  const dataLoader = new DataLoader();

  // Load the game state configuration
  const gameStateConfig = dataLoader.loadGameState();

  // Create property instances from the starting properties config
  const properties: Record<string, any> = {};
  const playerPropertyIds: string[] = [];

  for (const [
    index,
    propConfig,
  ] of gameStateConfig.startingProperties.entries()) {
    const propertyType = dataLoader.getPropertyTypeById(propConfig.type);
    if (!propertyType) {
      throw new Error(`Property type ${propConfig.type} not found`);
    }

    const propertyId = `property_${index}`;
    playerPropertyIds.push(propertyId);

    properties[propertyId] = {
      id: propertyId,
      name: propertyType.name,
      type: propertyType.type,
      size: propertyType.size,
      specialization: 'none',
      active: propConfig.active,
      rented: propConfig.rented ?? false,
      maintenanceCost: propertyType.maintenance,
      baseProduction: propertyType.production,
      facilityIds: [],
      facilitySlots: propertyType.facilitySlots,
      dcModifiers: propertyType.dcModifiers,
      specialData: propertyType.specialFeatures || {},
    };
  }

  // Create facility instances from the starting facilities config
  const facilities: Record<string, any> = {};

  for (const [
    index,
    facilityConfig,
  ] of gameStateConfig.startingFacilities.entries()) {
    const facilityType = dataLoader.getFacilityTypeById(facilityConfig.type);
    if (!facilityType) {
      throw new Error(`Facility type ${facilityConfig.type} not found`);
    }

    const facilityId = `facility_${index}`;
    const attachedPropertyId =
      playerPropertyIds[facilityConfig.attachedToProperty];

    if (!attachedPropertyId) {
      throw new Error(
        `Property index ${facilityConfig.attachedToProperty} not found`
      );
    }

    facilities[facilityId] = {
      id: facilityId,
      name: facilityType.name,
      type: facilityType.type,
      description: facilityType.description,
      category: facilityType.category,
      buildRequirements: facilityType.buildRequirements,
      maintenanceCost: facilityType.maintenance || {},
      effects: facilityType.effects,
    };

    // Add facility to property
    properties[attachedPropertyId].facilityIds.push(facilityId);
  }

  // Initialize market - using data from JSON
  const rawMaterials = dataLoader.loadRawMaterials();
  const specialMaterials = dataLoader.loadSpecialMaterials();

  const marketRawMaterials: Record<string, any> = {};
  const marketSpecialMaterials: Record<string, any> = {};

  // Initialize market for raw materials
  for (const material of rawMaterials) {
    let category: MaterialCategory;

    // Determine market category based on material category
    if (material.category === 'cheap') {
      category = MaterialCategory.CHEAP_RAW;
    } else if (material.category === 'medium') {
      category = MaterialCategory.MEDIUM_RAW;
    } else {
      category = MaterialCategory.EXPENSIVE_RAW;
    }

    // Set initial market status
    marketRawMaterials[material.id] = {
      basePrice: material.basePrice,
      category,
      currentDemand: MarketPriceCategory.IN_DEMAND, // Default in-demand state
      priceModifier: 0, // No initial modifier
    };
  }

  // Initialize market for special materials
  for (const material of specialMaterials) {
    let category: MaterialCategory;

    // Determine market category based on material category
    if (material.category === 'cheap') {
      category = MaterialCategory.CHEAP_SPECIAL;
    } else if (material.category === 'medium') {
      category = MaterialCategory.MEDIUM_SPECIAL;
    } else {
      category = MaterialCategory.EXPENSIVE_SPECIAL;
    }

    // Set initial market status
    marketSpecialMaterials[material.id] = {
      basePrice: material.basePrice,
      category,
      currentDemand: MarketPriceCategory.IN_DEMAND, // Default in-demand state
      priceModifier: 0, // No initial modifier
    };
  }

  // Create the initial game state
  const initialState: GameState = {
    gameId: generateUniqueId(),
    round: gameStateConfig.gameSettings.initialRound,
    phase: GamePhase.MAINTENANCE,
    currentPlayerId: 'player1',
    players: {
      player1: {
        id: 'player1',
        name: 'Player 1',
        resources: gameStateConfig.initialResources,
        propertyIds: playerPropertyIds,
        influenceGainedThisRound: {
          // Added initialization
          semiPermanentPerOffice: {},
        },
      },
    },
    properties,
    facilities,
    actionPointsRemaining: gameStateConfig.gameSettings.startingActionPoints,
    bonusActionPointsRemaining: {
      [GameActionType.GAIN_INFLUENCE]: 0,
      [GameActionType.GAIN_MONEY]: 0,
      [GameActionType.GAIN_MATERIALS]: 0,
      [GameActionType.ACQUIRE_PROPERTY]: 0,
      [GameActionType.POLITICAL_ACTION]: 0,
      [GameActionType.BUILD_FACILITY]: 0,
    },
    facilityBuildActionAvailable: true,
    market: {
      rawMaterials: marketRawMaterials,
      specialMaterials: marketSpecialMaterials,
    },
    settings: {
      winConditionRounds: gameStateConfig.gameSettings.maxTurns,
      loseConditionGold: gameStateConfig.gameSettings.gameOverGoldThreshold,
      startingActionPoints: gameStateConfig.gameSettings.startingActionPoints,
    },
  };

  return new GameEngine(initialState);
}

// Generate a unique ID (simple implementation)
function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
