import {
  type PropertyConfig,
  PropertySize,
  PropertyType,
  SpecializationType,
} from '../models';

// Small Rural Domain
export const SMALL_RURAL_DOMAIN: PropertyConfig = {
  name: 'Kleine Ländliche Domäne',
  type: PropertyType.DOMAIN,
  size: PropertySize.SMALL,
  specialization: SpecializationType.NONE,
  defaultActive: true,

  // Costs
  maintenanceCost: {
    gold: 2,
  },

  // Production
  baseProduction: {
    laborPower: 2,
    rawMaterials: {
      grain: 8,
      wood: 4,
    },
  },

  // Action DC modifiers
  dcModifiers: {
    gainMaterials: {
      small: -1,
    },
  },

  // Facility slots
  facilitySlots: {
    general: 2,
    specialized: 0,
    workshop: 1,
    warehouse: 1,
  },
};

// Medium Rural Domain
export const MEDIUM_RURAL_DOMAIN: PropertyConfig = {
  name: 'Mittlere Ländliche Domäne',
  type: PropertyType.DOMAIN,
  size: PropertySize.MEDIUM,
  specialization: SpecializationType.NONE,
  defaultActive: true,

  // Costs
  maintenanceCost: {
    gold: 4,
  },

  // Production
  baseProduction: {
    laborPower: 4,
    rawMaterials: {
      grain: 12,
      wood: 8,
    },
  },

  // Action DC modifiers
  dcModifiers: {
    gainMaterials: {
      medium: -1,
    },
  },

  // Facility slots
  facilitySlots: {
    general: 4,
    specialized: 1,
    workshop: 1,
    warehouse: 1,
  },
};

// Large Rural Domain
export const LARGE_RURAL_DOMAIN: PropertyConfig = {
  name: 'Große Ländliche Domäne',
  type: PropertyType.DOMAIN,
  size: PropertySize.LARGE,
  specialization: SpecializationType.NONE,
  defaultActive: true,

  // Costs
  maintenanceCost: {
    gold: 8,
  },

  // Production
  baseProduction: {
    laborPower: 8,
    rawMaterials: {
      grain: 20,
      wood: 16,
    },
  },

  // Action DC modifiers
  dcModifiers: {
    gainMaterials: {
      large: -1,
    },
  },

  // Facility slots
  facilitySlots: {
    general: 6,
    specialized: 2,
    workshop: 2,
    warehouse: 2,
  },
};

// Small City Property
export const SMALL_CITY_PROPERTY: PropertyConfig = {
  name: 'Kleiner Städtischer Besitz',
  type: PropertyType.CITY_PROPERTY,
  size: PropertySize.SMALL,
  specialization: SpecializationType.NONE,
  defaultActive: true,

  // Costs
  maintenanceCost: {
    gold: 2,
  },

  // Production when rented
  baseProduction: {
    laborPower: 1,
    gold: 3,
    influence: 1,
  },

  // Action DC modifiers
  dcModifiers: {
    gainInfluence: {
      small: -1,
    },
    politicalActions: {
      small: -1,
    },
  },

  // Facility slots
  facilitySlots: {
    general: 2,
    specialized: 0,
    workshop: 2,
    warehouse: 1,
  },
};

// Small Workshop
export const SMALL_WORKSHOP: PropertyConfig = {
  name: 'Kleine Werkstatt',
  type: PropertyType.WORKSHOP,
  size: PropertySize.SMALL,
  specialization: SpecializationType.NONE,
  defaultActive: true,

  // Costs
  maintenanceCost: {
    gold: 1,
    laborPower: 1,
  },

  // Production
  baseProduction: {
    // Workshops don't produce directly, they convert materials
  },

  // Facility slots - workshops don't have facilities
  facilitySlots: {
    general: 0,
    specialized: 0,
  },

  // Special data for workshop
  specialData: {
    conversionRate: {
      // 5 wood to 1 tool, max 1 per round
      inputType: 'wood',
      outputType: 'tools',
      ratio: 0.2,
      maxConversion: 1,
    },
  },
};

// Small Storage
export const SMALL_STORAGE: PropertyConfig = {
  name: 'Kleines Lager',
  type: PropertyType.WAREHOUSE,
  size: PropertySize.SMALL,
  specialization: SpecializationType.NONE,
  defaultActive: true,

  // Costs
  maintenanceCost: {
    laborPower: 1,
  },

  // Production
  baseProduction: {
    // Storage doesn't produce anything
  },

  // Facility slots - storage doesn't have facilities
  facilitySlots: {
    general: 0,
    specialized: 0,
  },

  // Special data for storage
  specialData: {
    storageCapacity: {
      rawMaterials: {
        // Can store any combination up to 10 units
        wood: 10,
        grain: 10,
        // etc...
      },
      specialMaterials: {
        // Can store any combination up to 5 units
        tools: 5,
        // etc...
      },
    },
  },
};

// Small Office
export const SMALL_OFFICE: PropertyConfig = {
  name: 'Kleines Amt',
  type: PropertyType.OFFICE,
  size: PropertySize.SMALL,
  specialization: SpecializationType.NONE,
  defaultActive: true,

  // Costs
  maintenanceCost: {
    // No maintenance for offices
  },

  // Production
  baseProduction: {
    // Choice between gold or influence
    gold: 5, // Player can choose this
    influence: 4, // Or this
  },

  // Action DC modifiers
  dcModifiers: {
    gainInfluence: {
      small: -1,
    },
    politicalActions: {
      small: -1,
    },
  },

  // Facility slots
  facilitySlots: {
    general: 2,
    specialized: 0,
  },
};

// Export all property types
export const PropertyTypes = {
  SMALL_RURAL_DOMAIN,
  MEDIUM_RURAL_DOMAIN,
  LARGE_RURAL_DOMAIN,
  SMALL_CITY_PROPERTY,
  SMALL_WORKSHOP,
  SMALL_STORAGE,
  SMALL_OFFICE,
};
