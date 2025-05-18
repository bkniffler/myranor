import type {
  BuildRequirement,
  FacilityCategory,
  FacilityConfig,
  FacilityType,
  PropertySize,
  PropertyType,
  SpecializationType,
} from '../models';
import { DataLoader } from '../utils/DataLoader';

// Facility type IDs (for TypeScript type checking)
export const FacilityTypeID = {
  BASIC_HOUSING: 'basic_housing',
  FOOD_STORAGE: 'food_storage',
  LAND_EXPANSION: 'land_expansion',
  BASIC_DEFENSE: 'basic_defense',
  OCTAD_SHRINE: 'octad_shrine',
  MARKETPLACE: 'marketplace',
  MECHANICAL_MILL: 'mechanical_mill',
} as const;

export type FacilityTypeIDType =
  (typeof FacilityTypeID)[keyof typeof FacilityTypeID];

/**
 * Factory function to get facility configurations from JSON data
 * Converts raw JSON data to properly typed FacilityConfig objects
 */
export function getFacilityTypes(): Record<string, FacilityConfig> {
  const dataLoader = new DataLoader();
  const facilityTypes = dataLoader.loadFacilityTypes();

  const result: Record<string, FacilityConfig> = {};

  // Convert from array to record with keys in uppercase
  for (const facility of facilityTypes) {
    const key = facility.id.toUpperCase();

    // Convert string types to enum types where needed
    const facilityType = facility.type as unknown as FacilityType;
    const category = facility.category as unknown as FacilityCategory;

    // Convert property types and specializations arrays
    const buildRequirements: BuildRequirement = {
      ...facility.buildRequirements,
      propertyTypes: facility.buildRequirements.propertyTypes?.map(
        (type) => type as unknown as PropertyType
      ),
      specializations: facility.buildRequirements.specializations?.map(
        (spec) => spec as unknown as SpecializationType
      ),
      propertySize: facility.buildRequirements.propertySize?.map(
        (size) => size as unknown as PropertySize
      ),
      requiredFacilities: facility.buildRequirements.requiredFacilities?.map(
        (fac) => fac as unknown as FacilityType
      ),
    };

    result[key] = {
      name: facility.name,
      type: facilityType,
      description: facility.description,
      category: category,
      buildRequirements: buildRequirements,
      maintenanceCost: facility.maintenance,
      effects: facility.effects,
    };
  }

  return result;
}

/**
 * Get a facility configuration by ID
 */
export function getFacilityConfigById(
  id: FacilityTypeIDType
): FacilityConfig | undefined {
  return getFacilityTypes()[id];
}

// Cached facility types - loaded on demand
export const FacilityTypes = getFacilityTypes();
