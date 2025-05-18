export enum PropertySize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
}

export enum PropertyType {
  DOMAIN = 'domain', // Ländliche Domäne
  CITY_PROPERTY = 'cityProperty', // Städtischer Besitz
  OFFICE = 'office', // Amt
  CIRCLE = 'circle', // Circel
  TRADING_COMPANY = 'tradingCompany', // Handelsunternehmung
  WORKSHOP = 'workshop', // Werkstatt
  WAREHOUSE = 'warehouse', // Lager
}

export enum CircleType {
  UNDERWORLD = 'underworld', // Unterweltcircel
  CULT = 'cult', // Kult
  CRAFT = 'craft', // Handwerkscollegium
  TRADE = 'trade', // Handelscollegium
}

export enum SpecializationType {
  // Domain specializations
  AGRICULTURE = 'agriculture', // Landwirtschaft
  ANIMAL_HUSBANDRY = 'animalHusbandry', // Tierzucht
  FORESTRY = 'forestry', // Forstwirtschaft
  MINING = 'mining', // Bergbau/Steinbruch

  // City property specializations
  FOOD_PRODUCTION = 'foodProduction', // Nahrungsproduktion
  CRAFTING = 'crafting', // Handwerkswaren
  METAL_WORKING = 'metalWorking', // Metallverarbeitung
  LUXURY_CRAFTING = 'luxuryCrafting', // Edelhandwerk & Kunst
  CONSTRUCTION = 'construction', // Bau und Bauprodukte
  RED_LIGHT = 'redLight', // Rotlicht und Vergnügungsbezirk

  // Office specializations
  CHURCH_OVERSIGHT = 'churchOversight', // Kirchenaufsicht
  CITY_ADMINISTRATION = 'cityAdministration', // Städtische Verwaltung
  COURT_POSITION = 'courtPosition', // Hof- und Ehrenämter
  PROVINCE_ADMINISTRATION = 'provinceAdministration', // Provinzverwaltung
  MILITARY_POSITION = 'militaryPosition', // Offiziersposten

  NONE = 'none',
}

export interface MaintenanceCost {
  gold?: number;
  laborPower?: number;
  rawMaterials?: Record<string, number>;
  specialMaterials?: Record<string, number>;
  influence?: number;
}

export interface Production {
  gold?: number;
  laborPower?: number;
  influence?: number;
  temporaryInfluence?: number;
  permanentInfluence?: number;
  rawMaterials?: Record<string, number>;
  specialMaterials?: Record<string, number>;
  combatPower?: number;
}

export interface DCModifiers {
  gainInfluence?: {
    small?: number;
    medium?: number;
    large?: number;
  };
  gainMoney?: {
    small?: number;
    medium?: number;
    large?: number;
  };
  gainMaterials?: {
    small?: number;
    medium?: number;
    large?: number;
  };
  politicalActions?: {
    small?: number;
    medium?: number;
    large?: number;
  };
}

export interface FacilitySlots {
  general: number;
  specialized: number;
  workshop?: number;
  warehouse?: number;
}

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  size: PropertySize;
  active: boolean;
  specialization: SpecializationType;
  circleType?: CircleType;

  // Costs
  maintenanceCost: MaintenanceCost;

  // Production/yield when active
  baseProduction: Production;

  // City properties can be rented or used for own production
  rented?: boolean;

  // DC modifiers for different actions
  dcModifiers?: DCModifiers;

  // References to facilities that can be built on this property
  facilityIds: string[];

  // Max capacities for different facility types
  facilitySlots: FacilitySlots;

  // For specialized properties that need additional data
  specialData?: Record<string, any>;
}

// Export a type for property configurations that will be used to create properties
export type PropertyConfig = Omit<Property, 'id' | 'facilityIds' | 'active'> & {
  defaultActive?: boolean;
};
