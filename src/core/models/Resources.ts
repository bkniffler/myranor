// Import types from the new location for backward compatibility
import type {
  ConversionRequirement,
  FacilityEffectData,
  FacilityTypeData,
  GameStateConfig,
  PropertyTypeData,
  RawMaterialData,
  SpecialMaterialData,
} from '../data/types/JsonTypes';

// Re-export for backward compatibility
export type {
  ConversionRequirement,
  FacilityEffectData,
  FacilityTypeData,
  GameStateConfig,
  PropertyTypeData,
  RawMaterialData,
  SpecialMaterialData,
};

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
