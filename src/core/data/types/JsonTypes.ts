/**
 * Type definitions for JSON data files
 * These types represent the raw shape of JSON data before conversion to domain models
 */
import type { AveProfile } from '../config/ave_config';

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
    laborPower?: number; // Added for potential one-time labor costs
    rawMaterials?: Record<string, number>; // Added for potential RM costs
    specialMaterials?: Record<string, number>; // Added for potential SM costs
  };
  specialFeatures?: Record<string, any>;
  aveProfile?: AveProfile; // Optional field for storing calculated AVE data
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
  aveProfile?: AveProfile; // Optional field for storing calculated AVE data
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
