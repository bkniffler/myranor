import { Domain, GameState, HousingFacility, StorageFacility, Workshop } from './types';

// Action types
export enum ActionType {
  GAIN_INFLUENCE = 'GAIN_INFLUENCE',
  SELL_MATERIALS = 'SELL_MATERIALS',
  GATHER_MATERIALS = 'GATHER_MATERIALS',
  ACQUIRE_PROPERTY = 'ACQUIRE_PROPERTY'
}

// Material types
export type MaterialType = 'food' | 'wood' | 'tools';

// Property types
export type PropertyType = 'domain' | 'workshop' | 'storage';

// Action payloads
export type GainInfluencePayload = {
  goldAmount: number;
};

export type SellMaterialsPayload = {
  materialType: MaterialType;
  amount: number;
};

export type GatherMaterialsPayload = {
  domainIndex: number;
};

export type AcquirePropertyPayload = {
  propertyType: PropertyType;
  propertyName: string;
};

// Action union type
export type GameAction = 
  | { type: ActionType.GAIN_INFLUENCE; payload: GainInfluencePayload }
  | { type: ActionType.SELL_MATERIALS; payload: SellMaterialsPayload }
  | { type: ActionType.GATHER_MATERIALS; payload: GatherMaterialsPayload }
  | { type: ActionType.ACQUIRE_PROPERTY; payload: AcquirePropertyPayload };

// Result type
export type ActionResult = {
  success: boolean;
  message: string;
  roll?: number;
};

// D20 roll helper
export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

// Main action handler function
export function performAction(gameState: GameState, action: GameAction): ActionResult {
  switch (action.type) {
    case ActionType.GAIN_INFLUENCE:
      return gainInfluenceAction(gameState, action.payload.goldAmount);
    
    case ActionType.SELL_MATERIALS:
      return sellMaterialsAction(gameState, action.payload.materialType, action.payload.amount);
    
    case ActionType.GATHER_MATERIALS:
      return gatherMaterialsAction(gameState, action.payload.domainIndex);
    
    case ActionType.ACQUIRE_PROPERTY:
      return acquirePropertyAction(
        gameState, 
        action.payload.propertyType, 
        action.payload.propertyName
      );
    
    default:
      return { success: false, message: 'Unbekannte Aktion!' };
  }
}

// Internal implementation functions
function gainInfluenceAction(
  gameState: GameState,
  goldAmount: number
): ActionResult {
  // Check if player has enough labor power
  if (gameState.player.resources.laborPower < 1) {
    return { success: false, message: 'Du hast nicht genug Arbeitskraft für diese Aktion!' };
  }
  
  // Check if player has enough gold
  if (goldAmount > gameState.player.resources.gold) {
    return { success: false, message: 'Du hast nicht genug Gold für diese Investition!' };
  }
  
  // Calculate influence gain (round down)
  const influenceGain = Math.floor(goldAmount / 2);
  
  // Apply changes
  gameState.player.resources.gold -= goldAmount;
  gameState.player.resources.laborPower -= 1;
  gameState.player.resources.temporaryInfluence += influenceGain;
  gameState.actionPointsRemaining -= 1;
  
  return { 
    success: true, 
    message: `Du hast ${goldAmount} Gold investiert und ${influenceGain} temporären Einfluss gewonnen.` 
  };
}

function sellMaterialsAction(
  gameState: GameState,
  materialType: MaterialType,
  amount: number
): ActionResult {
  // Check if player has enough labor power
  if (gameState.player.resources.laborPower < 1) {
    return { success: false, message: 'Du hast nicht genug Arbeitskraft für diese Aktion!' };
  }
  
  let availableAmount: number;
  let conversionRate: number;
  let materialName: string;
  
  // Determine material properties
  switch (materialType) {
    case 'food':
      availableAmount = gameState.player.resources.rawMaterials.food;
      conversionRate = 0.2; // 1 Nahrung = 0.2 Gold
      materialName = 'Nahrung';
      break;
    case 'wood':
      availableAmount = gameState.player.resources.rawMaterials.wood;
      conversionRate = 0.25; // 1 Holz = 0.25 Gold
      materialName = 'Holz';
      break;
    case 'tools':
      availableAmount = gameState.player.resources.specialMaterials.tools;
      conversionRate = 2; // 1 Werkzeug = 2 Gold
      materialName = 'Werkzeug';
      break;
    default:
      return { success: false, message: 'Ungültiger Materialtyp!' };
  }
  
  // Check if player has any of the chosen material
  if (availableAmount <= 0) {
    return { success: false, message: `Du hast kein ${materialName} zum Verkaufen!` };
  }
  
  // Check if amount is valid
  if (amount <= 0 || amount > availableAmount) {
    return { 
      success: false, 
      message: `Bitte gib eine gültige Menge zwischen 1 und ${availableAmount} ein.` 
    };
  }
  
  // Calculate gold to receive
  const goldGain = Math.floor(amount * conversionRate);
  
  // Apply changes
  gameState.player.resources.gold += goldGain;
  gameState.player.resources.laborPower -= 1;
  gameState.actionPointsRemaining -= 1;
  
  // Update specific resource
  switch (materialType) {
    case 'food':
      gameState.player.resources.rawMaterials.food -= amount;
      break;
    case 'wood':
      gameState.player.resources.rawMaterials.wood -= amount;
      break;
    case 'tools':
      gameState.player.resources.specialMaterials.tools -= amount;
      break;
  }
  
  return { 
    success: true, 
    message: `Du hast ${amount} ${materialName} für ${goldGain} Gold verkauft.` 
  };
}

function gatherMaterialsAction(
  gameState: GameState,
  domainIndex: number
): ActionResult {
  // Check if player has enough labor power
  if (gameState.player.resources.laborPower < 1) {
    return { success: false, message: 'Du hast nicht genug Arbeitskraft für diese Aktion!' };
  }
  
  // Find domains
  const domains = gameState.player.properties.filter(p => p.type === 'domain') as Domain[];
  
  if (domains.length === 0) {
    return { success: false, message: 'Du besitzt keine Domänen, die du verwalten könntest!' };
  }
  
  // Check if domain index is valid
  if (domainIndex < 0 || domainIndex >= domains.length) {
    return { success: false, message: 'Ungültige Domänenauswahl!' };
  }
  
  const selectedDomain = domains[domainIndex];
  
  // Check if domain is active
  if (!selectedDomain.active) {
    return { 
      success: false, 
      message: `${selectedDomain.name} ist inaktiv und kann keine zusätzlichen Materialien produzieren!` 
    };
  }
  
  // Roll d20 for success check
  const roll = rollD20();
  const difficulty = 12;
  
  // Apply action cost regardless of outcome
  gameState.player.resources.laborPower -= 1;
  gameState.actionPointsRemaining -= 1;
  
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
      
      if (foodToAdd < extraFood) {
        return { 
          success: true, 
          message: `Erfolg! ${selectedDomain.name} produziert zusätzlich ${foodToAdd} Nahrung.\nHinweis: ${extraFood - foodToAdd} Nahrung ging verloren, da dein Speicher voll ist!`, 
          roll 
        };
      }
      
      return { 
        success: true, 
        message: `Erfolg! ${selectedDomain.name} produziert zusätzlich ${foodToAdd} Nahrung.`, 
        roll 
      };
    } else {
      return { 
        success: true, 
        message: 'Erfolg! Aber dein Nahrungsspeicher ist bereits voll!', 
        roll 
      };
    }
  } else {
    // Failure
    return { 
      success: false, 
      message: `Fehlschlag! ${selectedDomain.name} produziert keine zusätzlichen Materialien.`, 
      roll 
    };
  }
}

function acquirePropertyAction(
  gameState: GameState,
  propertyType: PropertyType,
  propertyName: string
): ActionResult {
  // Check if player has enough labor power
  if (gameState.player.resources.laborPower < 1) {
    return { success: false, message: 'Du hast nicht genug Arbeitskraft für diese Aktion!' };
  }
  
  // Check for property limits
  const domains = gameState.player.properties.filter(p => p.type === 'domain');
  const workshops = gameState.player.properties.filter(p => p.type === 'workshop');
  const storages = gameState.player.properties.filter(p => 
    p.type === 'generalStorage' || p.type === 'foodStorage'
  );
  
  // Check limits based on selected property
  switch (propertyType) {
    case 'domain':
      if (domains.length >= 3) {
        return { success: false, message: 'Du kannst nicht mehr als 3 Domänen besitzen!' };
      }
      
      // Check resources
      if (gameState.player.resources.gold < 30 || gameState.player.resources.specialMaterials.tools < 5) {
        return { success: false, message: 'Du hast nicht genug Ressourcen für eine neue Domäne!' };
      }
      
      // Create new domain with standard facilities
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
      
      const newDomain: Domain = {
        type: 'domain',
        name: propertyName,
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
      
      break;
      
    case 'workshop':
      if (workshops.length >= 2) {
        return { success: false, message: 'Du kannst nicht mehr als 2 Werkstätten besitzen!' };
      }
      
      // Check resources
      if (gameState.player.resources.gold < 15 || gameState.player.resources.rawMaterials.wood < 8) {
        return { success: false, message: 'Du hast nicht genug Ressourcen für eine neue Werkstatt!' };
      }
      
      // Create new workshop
      const newWorkshop: Workshop = {
        type: 'workshop',
        name: propertyName,
        maintenanceCost: {
          gold: 1,
          laborPower: 1,
        },
        active: true,
        productionRate: {
          toolsPerWood: 1/5,
          maxProduction: 1,
        },
      };
      
      // Add workshop and update resources
      gameState.player.properties.push(newWorkshop);
      gameState.player.resources.gold -= 15;
      gameState.player.resources.rawMaterials.wood -= 8;
      
      break;
      
    case 'storage':
      if (storages.length >= 2) {
        return { success: false, message: 'Du kannst nicht mehr als 2 Lager besitzen!' };
      }
      
      // Check resources
      if (gameState.player.resources.gold < 10 || gameState.player.resources.rawMaterials.wood < 5) {
        return { success: false, message: 'Du hast nicht genug Ressourcen für ein neues Lager!' };
      }
      
      // Create new storage
      const newStorage: StorageFacility = {
        type: 'generalStorage',
        name: propertyName,
        maxCapacity: {
          wood: 30,
          tools: 10,
        },
      };
      
      // Add storage and update resources
      gameState.player.properties.push(newStorage);
      gameState.player.resources.gold -= 10;
      gameState.player.resources.rawMaterials.wood -= 5;
      
      break;
      
    default:
      return { success: false, message: 'Ungültiger Eigentumstyp!' };
  }
  
  // Apply action cost
  gameState.player.resources.laborPower -= 1;
  gameState.actionPointsRemaining -= 1;
  
  return { 
    success: true, 
    message: `${propertyName} erfolgreich erworben!` 
  };
} 