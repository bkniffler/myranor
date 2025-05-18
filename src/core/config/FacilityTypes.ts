import {
  FacilityCategory,
  type FacilityConfig,
  FacilityType,
  PropertySize,
  PropertyType,
  SpecializationType,
} from '../models';

// Basic housing facility
export const BASIC_HOUSING: FacilityConfig = {
  name: 'Erweiterte Arbeiterunterkünfte',
  type: FacilityType.HOUSING,
  description: 'Verbesserte Unterkünfte für mehr Arbeitskräfte.',
  category: FacilityCategory.GENERAL,

  buildRequirements: {
    resources: {
      gold: 5,
    },
    propertyTypes: [PropertyType.DOMAIN],
  },

  effects: {
    productionBonus: {
      laborPower: 1,
    },
  },
};

// Food storage
export const FOOD_STORAGE: FacilityConfig = {
  name: 'Kornspeicher',
  type: FacilityType.STORAGE,
  description:
    'Ermöglicht die Lagerung von Nahrung ohne ein dediziertes Lager.',
  category: FacilityCategory.GENERAL,

  buildRequirements: {
    resources: {
      gold: 4,
    },
    propertyTypes: [PropertyType.DOMAIN],
  },

  effects: {
    storageCapacity: {
      rawMaterials: {
        grain: 5,
        fruit: 5,
        vegetables: 5,
      },
    },
  },
};

// Land expansion
export const LAND_EXPANSION: FacilityConfig = {
  name: 'Landgewinnung',
  type: FacilityType.LAND_EXPANSION,
  description: 'Ausweitung der nutzbaren Landfläche.',
  category: FacilityCategory.GENERAL,

  buildRequirements: {
    resources: {
      gold: 4,
      laborPower: 2,
    },
    propertyTypes: [PropertyType.DOMAIN],
  },

  effects: {
    productionBonus: {
      rawMaterials: {
        grain: 2,
      },
    },
  },
};

// Basic defense
export const BASIC_DEFENSE: FacilityConfig = {
  name: 'Einfache Verteidigungsanlagen',
  type: FacilityType.DEFENSE,
  description:
    'Verbesserte Sicherheit, reduziert die Wahrscheinlichkeit von Überfällen.',
  category: FacilityCategory.GENERAL,

  buildRequirements: {
    resources: {
      gold: 3,
      rawMaterials: {
        wood: 3,
      },
      laborPower: 1,
    },
    propertyTypes: [PropertyType.DOMAIN],
  },

  effects: {
    specialEffects: ['reduced_raid_chance'],
  },
};

// Shrine
export const OCTAD_SHRINE: FacilityConfig = {
  name: 'Großer Oktaden-Schrein',
  type: FacilityType.SHRINE,
  description: 'Ein imposanter Schrein zur Verehrung der Zwölfgötter.',
  category: FacilityCategory.GENERAL,

  buildRequirements: {
    resources: {
      gold: 8,
    },
    propertyTypes: [PropertyType.DOMAIN, PropertyType.CITY_PROPERTY],
  },

  effects: {
    productionBonus: {
      influence: 4,
    },
    specialEffects: ['add_250_subjects'],
  },
};

// Market
export const MARKETPLACE: FacilityConfig = {
  name: 'Marktplatz und Handelsposten',
  type: FacilityType.MARKET,
  description: 'Ein Marktplatz für den lokalen Handel.',
  category: FacilityCategory.GENERAL,

  buildRequirements: {
    resources: {
      gold: 16,
    },
    propertyTypes: [PropertyType.DOMAIN, PropertyType.CITY_PROPERTY],
  },

  maintenanceCost: {
    laborPower: 1,
  },

  effects: {
    productionBonus: {
      gold: 2,
      specialMaterials: {
        // Produces one expensive special material every 3 rounds
        perfume: 1 / 3,
      },
    },
  },
};

// Mill (agriculture specialization)
export const MECHANICAL_MILL: FacilityConfig = {
  name: 'Mechanische Mühlanlagen',
  type: FacilityType.MILL,
  description: 'Wandelt Getreide in wertvolle Produkte um.',
  category: FacilityCategory.SPECIALIZED,

  buildRequirements: {
    resources: {
      gold: 5,
    },
    specializations: [SpecializationType.AGRICULTURE],
    propertyTypes: [PropertyType.DOMAIN],
    propertySize: [PropertySize.MEDIUM, PropertySize.LARGE],
    requiredFacilities: [FacilityType.WORKSHOP],
  },

  effects: {
    conversionRate: [
      {
        inputType: 'grain',
        outputType: 'pulps',
        ratio: 1,
        maxConversion: 2,
      },
      {
        inputType: 'olives',
        outputType: 'oil',
        ratio: 1,
        maxConversion: 2,
      },
    ],
  },
};

// Exportable facilities list
export const FacilityTypes = {
  BASIC_HOUSING,
  FOOD_STORAGE,
  LAND_EXPANSION,
  BASIC_DEFENSE,
  OCTAD_SHRINE,
  MARKETPLACE,
  MECHANICAL_MILL,
};
