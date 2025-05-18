import type { Facility } from '../models/Facility';
import type { GamePhase } from '../models/GameState';
import type { Property } from '../models/Property';

// Game flow event payloads
export interface GameStartedPayload {
  playerId: string;
  playerName: string;
}

export interface PhaseChangedPayload {
  newPhase: GamePhase;
  previousPhase: GamePhase;
}

export interface RoundAdvancedPayload {
  round: number;
}

// Player action event payloads
export interface InfluenceGainedPayload {
  goldSpent: number;
  influenceGained: number;
}

export interface MaterialsSoldPayload {
  rawMaterials?: Record<string, number>;
  specialMaterials?: Record<string, number>;
  goldGained: number;
}

export interface MaterialsGatheredPayload {
  laborSpent: number;
  propertyId?: string;
  roll: number;
  dc: number;
  success: boolean;
  materialsGathered: Record<string, number>;
}

export interface PropertyAcquiredPayload {
  property: Property;
  cost: {
    gold: number;
    influence?: number;
  };
}

export interface PoliticalActionPerformedPayload {
  actionType: string;
  targets?: string[];
  goldSpent?: number;
  influenceSpent?: number;
  success: boolean;
}

export interface FacilityBuiltPayload {
  facility: Facility;
  propertyId: string;
  roll?: number;
  success: boolean;
  resourceCosts: {
    gold?: number;
    laborPower?: number;
    rawMaterials?: Record<string, number>;
    specialMaterials?: Record<string, number>;
  };
}

// Automatic phase event payloads
export interface MaintenancePerformedPayload {
  goldCost: number;
  laborCost: number;
  unpaidProperties?: string[];
  unpaidFacilities?: string[];
}

export interface ResourcesProducedPayload {
  properties: Record<
    string,
    {
      production: {
        gold?: number;
        laborPower?: number;
        influence?: number;
        rawMaterials?: Record<string, number>;
        specialMaterials?: Record<string, number>;
      };
    }
  >;
  totalProduction: {
    gold: number;
    laborPower: number;
    influence: number;
    rawMaterials: Record<string, number>;
    specialMaterials: Record<string, number>;
  };
}

export interface ResourcesResetPayload {
  previousState: {
    laborPower: number;
    influence: number;
  };
  newState: {
    laborPower: number;
    influence: number;
  };
}

export interface MarketUpdatedPayload {
  rawMaterialDemand: Record<string, string>;
  specialMaterialDemand: Record<string, string>;
  priceChanges: Record<string, number>;
}

// Resource conversion event payloads
export interface ResourcesConvertedPayload {
  rawMaterialsConverted?: Record<string, number>;
  specialMaterialsConverted?: Record<string, number>;
  goldGained: number;
}

export interface ResourcesAutoConvertedPayload {
  rawMaterialsConverted?: Record<string, number>;
  specialMaterialsConverted?: Record<string, number>;
  goldGained: number;
}

// Resource-specific event payloads
export interface GoldAddedPayload {
  amount: number;
  source: string;
}

export interface GoldRemovedPayload {
  amount: number;
  reason: string;
}

export interface LaborAddedPayload {
  amount: number;
  source: string;
}

export interface LaborRemovedPayload {
  amount: number;
  reason: string;
}

export interface InfluenceAddedPayload {
  amount: number;
  source: string;
  isTemporary: boolean;
}

export interface InfluenceRemovedPayload {
  amount: number;
  reason: string;
}

export interface RawMaterialsAddedPayload {
  materials: Record<string, number>;
  source: string;
}

export interface RawMaterialsRemovedPayload {
  materials: Record<string, number>;
  reason: string;
}

export interface SpecialMaterialsAddedPayload {
  materials: Record<string, number>;
  source: string;
}

export interface SpecialMaterialsRemovedPayload {
  materials: Record<string, number>;
  reason: string;
}

// Game result event payloads
export interface GameWonPayload {
  reason: string;
  finalScore?: number;
  roundsPlayed: number;
}

export interface GameLostPayload {
  reason: string;
  finalScore?: number;
  roundsPlayed: number;
}
