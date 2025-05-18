import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  FacilityTypeData,
  GameStateConfig,
  PropertyTypeData,
  RawMaterialData,
  SpecialMaterialData,
} from '../types/JsonTypes';

export class DataLoader {
  private dataDirectory: string;

  // Caches for loaded data
  private rawMaterialsCache: RawMaterialData[] | null = null;
  private specialMaterialsCache: SpecialMaterialData[] | null = null;
  private propertyTypesCache: PropertyTypeData[] | null = null;
  private facilityTypesCache: FacilityTypeData[] | null = null;
  private gameStateCache: GameStateConfig | null = null;

  // Lookup maps for efficient access by ID
  private rawMaterialsMap: Map<string, RawMaterialData> = new Map();
  private specialMaterialsMap: Map<string, SpecialMaterialData> = new Map();
  private propertyTypesMap: Map<string, PropertyTypeData> = new Map();
  private facilityTypesMap: Map<string, FacilityTypeData> = new Map();

  constructor(rootDirectory: string = process.cwd()) {
    this.dataDirectory = path.join(rootDirectory, 'data');
  }

  public loadRawMaterials(): RawMaterialData[] {
    if (!this.rawMaterialsCache) {
      this.rawMaterialsCache = this.loadJsonFile<RawMaterialData[]>(
        'materials/raw_materials.json'
      );
      // Build lookup map
      for (const material of this.rawMaterialsCache) {
        this.rawMaterialsMap.set(material.id, material);
      }
    }
    return this.rawMaterialsCache;
  }

  public loadSpecialMaterials(): SpecialMaterialData[] {
    if (!this.specialMaterialsCache) {
      this.specialMaterialsCache = this.loadJsonFile<SpecialMaterialData[]>(
        'materials/special_materials.json'
      );
      // Build lookup map
      for (const material of this.specialMaterialsCache) {
        this.specialMaterialsMap.set(material.id, material);
      }
    }
    return this.specialMaterialsCache;
  }

  public loadPropertyTypes(): PropertyTypeData[] {
    if (!this.propertyTypesCache) {
      this.propertyTypesCache = this.loadJsonFile<PropertyTypeData[]>(
        'properties/property_types.json'
      );
      // Build lookup map
      for (const property of this.propertyTypesCache) {
        this.propertyTypesMap.set(property.id, property);
      }
    }
    return this.propertyTypesCache;
  }

  public loadFacilityTypes(): FacilityTypeData[] {
    if (!this.facilityTypesCache) {
      this.facilityTypesCache = this.loadJsonFile<FacilityTypeData[]>(
        'facilities/facility_types.json'
      );
      // Build lookup map
      for (const facility of this.facilityTypesCache) {
        this.facilityTypesMap.set(facility.id, facility);
      }
    }
    return this.facilityTypesCache;
  }

  public loadGameState(): GameStateConfig {
    if (!this.gameStateCache) {
      this.gameStateCache =
        this.loadJsonFile<GameStateConfig>('game_state.json');
    }
    return this.gameStateCache;
  }

  private loadJsonFile<T>(relativePath: string): T {
    const filePath = path.join(this.dataDirectory, relativePath);
    try {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContents) as T;
    } catch (error) {
      console.error(`Error loading file ${filePath}:`, error);
      throw error;
    }
  }

  // Helper method to get a raw material by ID - using the lookup map for efficiency
  public getRawMaterialById(id: string): RawMaterialData | undefined {
    this.loadRawMaterials(); // Ensure data is loaded
    return this.rawMaterialsMap.get(id);
  }

  // Helper method to get a special material by ID - using the lookup map for efficiency
  public getSpecialMaterialById(id: string): SpecialMaterialData | undefined {
    this.loadSpecialMaterials(); // Ensure data is loaded
    return this.specialMaterialsMap.get(id);
  }

  // Helper method to get a property type by ID - using the lookup map for efficiency
  public getPropertyTypeById(id: string): PropertyTypeData | undefined {
    this.loadPropertyTypes(); // Ensure data is loaded
    return this.propertyTypesMap.get(id);
  }

  // Helper method to get a facility type by ID - using the lookup map for efficiency
  public getFacilityTypeById(id: string): FacilityTypeData | undefined {
    this.loadFacilityTypes(); // Ensure data is loaded
    return this.facilityTypesMap.get(id);
  }

  // Get all raw materials of a specific category
  public getRawMaterialsByCategory(
    category: 'cheap' | 'medium' | 'expensive'
  ): RawMaterialData[] {
    return this.loadRawMaterials().filter(
      (material) => material.category === category
    );
  }

  // Get all special materials of a specific category
  public getSpecialMaterialsByCategory(
    category: 'cheap' | 'medium' | 'expensive'
  ): SpecialMaterialData[] {
    return this.loadSpecialMaterials().filter(
      (material) => material.category === category
    );
  }

  // Get all raw materials that can be converted to a specific special material
  public getInputMaterialsForSpecialMaterial(
    specialMaterialId: string
  ): RawMaterialData[] {
    const specialMaterial = this.getSpecialMaterialById(specialMaterialId);
    if (!specialMaterial) {
      return [];
    }

    return specialMaterial.conversionRequirements
      .map((req) => this.getRawMaterialById(req.materialId))
      .filter(
        (material): material is RawMaterialData => material !== undefined
      );
  }

  // Reset caches (useful for testing or if files change at runtime)
  public clearCaches(): void {
    this.rawMaterialsCache = null;
    this.specialMaterialsCache = null;
    this.propertyTypesCache = null;
    this.facilityTypesCache = null;
    this.gameStateCache = null;

    this.rawMaterialsMap.clear();
    this.specialMaterialsMap.clear();
    this.propertyTypesMap.clear();
    this.facilityTypesMap.clear();
  }
}
