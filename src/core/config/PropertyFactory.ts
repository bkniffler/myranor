import {
  type PropertyConfig,
  type PropertySize,
  type PropertyType,
  SpecializationType,
} from '../models';
import { DataLoader } from '../utils/DataLoader';

// Property type IDs (for TypeScript type checking)
export const PropertyTypeID = {
  SMALL_RURAL_DOMAIN: 'small_rural_domain',
  MEDIUM_RURAL_DOMAIN: 'medium_rural_domain',
  LARGE_RURAL_DOMAIN: 'large_rural_domain',
  SMALL_CITY_PROPERTY: 'small_city_property',
  SMALL_WORKSHOP: 'small_workshop',
  SMALL_STORAGE: 'small_storage',
  SMALL_OFFICE: 'small_office',
} as const;

export type PropertyTypeIDType =
  (typeof PropertyTypeID)[keyof typeof PropertyTypeID];

/**
 * Factory function to get property configurations from JSON data
 * Converts raw JSON data to properly typed PropertyConfig objects
 */
export function getPropertyTypes(): Record<string, PropertyConfig> {
  const dataLoader = new DataLoader();
  const propertyTypes = dataLoader.loadPropertyTypes();

  const result: Record<string, PropertyConfig> = {};

  // Convert from array to record with keys in uppercase
  for (const property of propertyTypes) {
    const key = property.id.toUpperCase();

    // Convert string types to enum types where needed
    const propertyType = property.type as unknown as PropertyType;
    const size = property.size as unknown as PropertySize;

    result[key] = {
      name: property.name,
      type: propertyType,
      size: size,
      specialization: SpecializationType.NONE,
      defaultActive: property.defaultActive,
      maintenanceCost: property.maintenance,
      baseProduction: property.production,
      dcModifiers: property.dcModifiers,
      facilitySlots: property.facilitySlots,
      specialData: property.specialFeatures || {},
    };
  }

  return result;
}

/**
 * Get a property configuration by ID
 */
export function getPropertyConfigById(
  id: PropertyTypeIDType
): PropertyConfig | undefined {
  return getPropertyTypes()[id];
}

// Cached property types - loaded on demand
export const PropertyTypes = getPropertyTypes();
