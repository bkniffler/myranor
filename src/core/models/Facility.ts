import type { AveProfile } from '../data/config/ave_config';
import type {
  MaintenanceCost,
  Production,
  PropertySize,
  PropertyType,
  SpecializationType,
} from './Property';

export enum FacilityType {
  // General facilities
  HOUSING = 'housing', // Arbeiterunterkünfte
  DEFENSE = 'defense', // Verteidigungsanlage
  STORAGE = 'storage', // Speicher
  SHRINE = 'shrine', // Schrein
  MARKET = 'market', // Marktplatz
  LAND_EXPANSION = 'landExpansion', // Landgewinnung

  // Domain specialized facilities
  MILL = 'mill', // Mühle
  TERRACES = 'terraces', // Terrassen
  GARDEN = 'garden', // Garten
  EXOTIC_GREENHOUSE = 'exoticGreenhouse', // Exotische Gewächshäuser
  SLAUGHTERHOUSE = 'slaughterhouse', // Schlachthaus
  DAIRY = 'dairy', // Molkerei
  BREEDING = 'breeding', // Zucht
  SAWMILL = 'sawmill', // Sägemühle
  HUNTING_GROUNDS = 'huntingGrounds', // Jagdgebiet
  BEEKEEPING = 'beekeeping', // Imkerei
  WOODWORKING = 'woodworking', // Waldarbeit
  MINE_SHAFT = 'mineShaft', // Schacht
  SMELTER = 'smelter', // Schmelze

  // City specialized facilities
  WORKSHOP = 'workshop', // Werkstatt
  MANUFACTORY = 'manufactory', // Manufaktur
  TAVERN = 'tavern', // Gasthaus
  MARKETPLACE = 'marketplace', // Marktstände
  DYEWORKS = 'dyeworks', // Färberei
  WEAVING = 'weaving', // Weberei
  TANNERY = 'tannery', // Gerberei
  SMITHY = 'smithy', // Schmiede
  GLASSWORKS = 'glassworks', // Glashütte
  ALCHEMIST = 'alchemist', // Alchemie
  SMUGGLING_TUNNEL = 'smugglingTunnel', // Schmugglertunnel
  GAMBLING_DEN = 'gamblingDen', // Spielhölle

  // Circle/office facilities
  HEADQUARTERS = 'headquarters', // Hauptquartier
  MESSENGER_NETWORK = 'messengerNetwork', // Botennetzwerk
  PROTECTION = 'protection', // Leibgarde
  WAREHOUSE = 'warehouse', // Lager
  TRAINING_FACILITY = 'trainingFacility', // Ausbildung
  REPRESENTATION = 'representation', // Repräsentation
  SMUGGLING = 'smuggling', // Schmuggel
  FANATICS = 'fanatics', // Fanatiker
  CULT_SITE = 'cultSite', // Kultstätte
  ARTIFACT = 'artifact', // Artefakt

  // Trading company facilities
  CONTRACTS = 'contracts', // Verträge
  WAREHOUSE_RENTAL = 'warehouseRental', // Lagermiete
  OFFICES = 'offices', // Schreibstuben
  AGENTS = 'agents', // Handelsagenten
  TRADE_MISSION = 'tradeMission', // Handelsmission
  INVESTMENT = 'investment', // Investment
  TRADING_POST = 'tradingPost', // Handelsstützpunkt
  MONOPOLY = 'monopoly', // Monopol
  TRADE_SHIP = 'tradeShip', // Handelsschiff

  // Many more from SOURCE.md
}

export enum FacilityCategory {
  GENERAL = 'general', // Allgemeine Einrichtung
  SPECIALIZED = 'specialized', // Spezialisierte Einrichtung
  WORKSHOP = 'workshop', // Werkstatt
  WAREHOUSE = 'warehouse', // Lager
}

export interface FacilityEffect {
  // Production bonuses
  productionBonus?: Production;

  // Storage capacity
  storageCapacity?: {
    rawMaterials?: Record<string, number>;
    specialMaterials?: Record<string, number>;
  };

  // Production conversion rates (for workshops)
  conversionRate?: {
    inputType: string;
    outputType: string;
    ratio: number;
    maxConversion: number;
  }[];

  // Maintenance cost reduction
  maintenanceReduction?: MaintenanceCost;

  // Action point bonuses
  bonusActions?: {
    actionType: string;
    frequency?: number; // e.g., 2 = every 2 rounds
  }[];

  // DC modifiers for actions
  dcModifiers?: Record<string, number>;

  // Special effects (can be handled by the game engine)
  specialEffects?: string[];
}

export interface BuildRequirement {
  resources?: {
    gold: number;
    laborPower?: number;
    rawMaterials?: Record<string, number>;
    specialMaterials?: Record<string, number>;
    influence?: number;
  };

  specializations?: SpecializationType[];

  // Required property types and sizes
  propertyTypes?: PropertyType[];
  propertySize?: PropertySize[];

  // Required facilities that must exist first
  requiredFacilities?: FacilityType[];

  // Required staff
  requiredStaff?: string[];

  // Difficulty class for building
  buildDC?: number;
}

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  description: string;

  // Category determines what slot type it uses
  category: FacilityCategory;

  // Cost to build/acquire
  buildRequirements: BuildRequirement;

  // Regular maintenance cost
  maintenanceCost?: MaintenanceCost;

  // Effects when active
  effects: FacilityEffect;

  // Calculated AVE profile for this facility type
  aveProfile?: AveProfile;
}

// Type for facility configurations used to create actual facilities
export type FacilityConfig = Omit<Facility, 'id'> & {
  aveProfile?: AveProfile; // Ensure FacilityConfig can hold the profile
};
