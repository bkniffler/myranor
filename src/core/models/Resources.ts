// RAW MATERIALS AND SPECIAL MATERIALS
// Note: The actual resource definitions are now in data/materials/*.json
// These interfaces are kept for TypeScript compatibility

// Raw materials model
export interface RawMaterials {
  [key: string]: number;
}

// Special materials model
export interface SpecialMaterials {
  [key: string]: number;
}

// Initialize all raw materials with empty object
export function createEmptyRawMaterials(): RawMaterials {
  return {};
}

// Initialize all special materials with empty object
export function createEmptySpecialMaterials(): SpecialMaterials {
  return {};
}

// Player resources model
export interface PlayerResources {
  gold: number;
  laborPower: number;
  baseLaborPower: number;
  temporaryInfluence: number;
  permanentInfluence: number;
  combatPower: number;
  rawMaterials: RawMaterials;
  specialMaterials: SpecialMaterials;
}

// Initialize player resources - now just an empty function since we load from JSON
export function createInitialPlayerResources(): PlayerResources {
  return {
    gold: 0,
    laborPower: 0,
    baseLaborPower: 0,
    temporaryInfluence: 0,
    permanentInfluence: 0,
    combatPower: 0,
    rawMaterials: createEmptyRawMaterials(),
    specialMaterials: createEmptySpecialMaterials(),
  };
}

// Market price category
export enum MarketPriceCategory {
  NOT_IN_DEMAND = 'notInDemand',
  IN_DEMAND = 'inDemand',
  HIGH_DEMAND = 'highDemand',
  COVETED = 'coveted',
}

// Material category for market fluctuations
export enum MaterialCategory {
  CHEAP_RAW = 'cheapRaw',
  MEDIUM_RAW = 'mediumRaw', // Changed from SIMPLE_RAW to MEDIUM_RAW for consistency
  EXPENSIVE_RAW = 'expensiveRaw',
  CHEAP_SPECIAL = 'cheapSpecial',
  MEDIUM_SPECIAL = 'mediumSpecial', // Changed from SIMPLE_SPECIAL to MEDIUM_SPECIAL for consistency
  EXPENSIVE_SPECIAL = 'expensiveSpecial',
}

// Market prices interface
export interface MarketPrices {
  rawMaterials: Record<
    string,
    {
      basePrice: number;
      category: MaterialCategory;
      currentDemand: MarketPriceCategory;
      priceModifier: number;
    }
  >;

  specialMaterials: Record<
    string,
    {
      basePrice: number;
      category: MaterialCategory;
      currentDemand: MarketPriceCategory;
      priceModifier: number;
    }
  >;
}

// JSON file data types for DataLoader

// Raw material from JSON file
export interface RawMaterialData {
  id: string;
  name: string;
  category: 'cheap' | 'medium' | 'expensive';
  basePrice: number;
  description: string;
  priceBonus?: number;
}

// Conversion requirement for special materials
export interface ConversionRequirement {
  materialId: string;
  amount: number;
  laborCost: number;
  facilityType?: string;
  specialistRequired?: string;
}

// Special material from JSON file
export interface SpecialMaterialData {
  id: string;
  name: string;
  category: 'cheap' | 'medium' | 'expensive';
  basePrice: number;
  description: string;
  priceBonus?: number;
  conversionRequirements: ConversionRequirement[];
}

// Property type from JSON file
export interface PropertyTypeData {
  id: string;
  name: string;
  type: string;
  size: string;
  defaultActive: boolean;
  maintenance: {
    gold?: number;
    laborPower?: number;
    rawMaterials?: Record<string, number>;
    specialMaterials?: Record<string, number>;
    influence?: number;
  };
  production: {
    laborPower?: number;
    gold?: number;
    influence?: number;
    temporaryInfluence?: number;
    permanentInfluence?: number;
    rawMaterials?: Record<string, number>;
    specialMaterials?: Record<string, number>;
    combatPower?: number;
  };
  dcModifiers?: {
    gainInfluence?: { small?: number; medium?: number; large?: number };
    gainMoney?: { small?: number; medium?: number; large?: number };
    gainMaterials?: { small?: number; medium?: number; large?: number };
    politicalActions?: { small?: number; medium?: number; large?: number };
  };
  facilitySlots: {
    general: number;
    specialized: number;
    workshop?: number;
    warehouse?: number;
  };
  cost: {
    gold: number;
    influence?: number;
  };
  specialFeatures?: Record<string, any>;
}

// Facility effect from JSON file
export interface FacilityEffectData {
  productionBonus?: {
    gold?: number;
    laborPower?: number;
    influence?: number;
    temporaryInfluence?: number;
    permanentInfluence?: number;
    rawMaterials?: Record<string, number>;
    specialMaterials?: Record<string, number>;
    combatPower?: number;
  };
  storageCapacity?: {
    rawMaterials?: Record<string, number>;
    specialMaterials?: Record<string, number>;
  };
  conversionRate?: Array<{
    inputType: string;
    outputType: string;
    ratio: number;
    maxConversion: number;
  }>;
  materialProduction?: {
    rawMaterials?: Record<string, { amount: number; frequency: number }>;
    specialMaterials?: Record<string, { amount: number; frequency: number }>;
  };
  maintenanceReduction?: {
    gold?: number;
    laborPower?: number;
    rawMaterials?: Record<string, number>;
    specialMaterials?: Record<string, number>;
    influence?: number;
  };
  dcModifiers?: Record<string, number>;
  specialEffects?: string[];
}

// Facility type from JSON file
export interface FacilityTypeData {
  id: string;
  name: string;
  type: string;
  category: string;
  description: string;
  buildRequirements: {
    resources: {
      gold: number;
      laborPower?: number;
      rawMaterials?: Record<string, number>;
      specialMaterials?: Record<string, number>;
      influence?: number;
    };
    propertyTypes?: string[];
    propertySize?: string[];
    specializations?: string[];
    requiredFacilities?: string[];
  };
  maintenance?: {
    gold?: number;
    laborPower?: number;
    rawMaterials?: Record<string, number>;
    specialMaterials?: Record<string, number>;
    influence?: number;
  };
  effects: FacilityEffectData;
}

// Game state configuration from JSON file
export interface GameStateConfig {
  initialResources: {
    gold: number;
    laborPower: number;
    baseLaborPower: number;
    temporaryInfluence: number;
    permanentInfluence: number;
    combatPower: number;
    rawMaterials: Record<string, number>;
    specialMaterials: Record<string, number>;
  };
  startingProperties: Array<{
    type: string;
    active: boolean;
    rented?: boolean;
  }>;
  startingFacilities: Array<{
    type: string;
    attachedToProperty: number;
  }>;
  gameSettings: {
    startingActionPoints: number;
    maxTurns: number;
    gameOverGoldThreshold: number;
    initialRound: number;
  };
  marketSettings: {
    rollFrequency: number;
    maxPriceModifier: {
      notInDemand: number;
      inDemand: number;
      highDemand: number;
      coveted: number;
    };
  };
}
