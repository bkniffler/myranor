import type { AveConfig, AveProfile } from '../data/config/ave_config';
import { DEFAULT_AVE_CONFIG } from '../data/config/ave_config';
import type { DataLoader } from '../data/loaders/DataLoader';
import type {
  FacilityTypeData,
  PropertyTypeData,
} from '../data/types/JsonTypes';
import type { PlayerResources } from '../models'; // For type reference if needed for cost bundles

// Type for a bundle of resources that can represent costs or production
type ResourceBundle = Partial<
  Pick<
    PlayerResources,
    | 'gold'
    | 'laborPower'
    | 'temporaryInfluence'
    | 'permanentInfluence'
    | 'rawMaterials'
    | 'specialMaterials'
  > & { influence?: number } // General influence for costs
>;

export class AveCalculator {
  private config: AveConfig;
  private dataLoader?: DataLoader; // Optional: if we need to fetch material base prices dynamically

  constructor(config: AveConfig = DEFAULT_AVE_CONFIG, dataLoader?: DataLoader) {
    this.config = config;
    this.dataLoader = dataLoader;
  }

  /**
   * Calculates the total AVE of a given bundle of resources.
   * @param bundle The resource bundle (e.g., costs, production).
   * @param perRoundContext If true, uses per-round AVE values for resources like labor/influence.
   *                        If false, uses one-time AVE values.
   * @returns The total AVE of the resource bundle.
   */
  public calculateResourceBundleAve(
    bundle: ResourceBundle | undefined,
    perRoundContext: boolean
  ): number {
    if (!bundle) {
      return 0;
    }

    let totalAve = 0;
    const resValues = this.config.resources;

    if (bundle.gold) {
      totalAve += bundle.gold * resValues.gold;
    }

    if (bundle.laborPower) {
      totalAve +=
        bundle.laborPower *
        (perRoundContext
          ? resValues.laborPowerPerRound
          : resValues.laborPowerOneTime);
    }

    // Handle general 'influence' for costs, map to temporaryInfluenceOneTime
    // For production, specific temporaryInfluencePerRound or permanentInfluencePerRound should be used.
    if (bundle.influence && !perRoundContext) {
      totalAve += bundle.influence * resValues.temporaryInfluenceOneTime;
    }

    if (bundle.temporaryInfluence) {
      totalAve +=
        bundle.temporaryInfluence *
        (perRoundContext
          ? resValues.temporaryInfluencePerRound
          : resValues.temporaryInfluenceOneTime);
    }

    if (bundle.permanentInfluence && perRoundContext) {
      // Permanent influence is typically a per-round benefit
      totalAve +=
        bundle.permanentInfluence * resValues.permanentInfluencePerRound;
    }

    if (bundle.rawMaterials) {
      for (const materialId in bundle.rawMaterials) {
        const amount = bundle.rawMaterials[materialId];
        const avePerUnit =
          resValues.rawMaterials[materialId] ?? resValues.defaultRawMaterial;
        totalAve += amount * avePerUnit;
      }
    }

    if (bundle.specialMaterials) {
      for (const materialId in bundle.specialMaterials) {
        const amount = bundle.specialMaterials[materialId];
        const avePerUnit =
          resValues.specialMaterials[materialId] ??
          resValues.defaultSpecialMaterial;
        totalAve += amount * avePerUnit;
      }
    }

    return totalAve;
  }

  /**
   * Calculates the AVE profile for a given property type.
   * @param propertyData The raw data for the property type.
   * @returns The calculated AVE profile.
   */
  public calculatePropertyAveProfile(
    propertyData: PropertyTypeData
  ): AveProfile {
    const acquisitionCostAVE = this.calculateResourceBundleAve(
      propertyData.cost,
      false // Costs are one-time
    );

    const maintenanceCostPerRoundAVE = this.calculateResourceBundleAve(
      propertyData.maintenance,
      true // Maintenance is per-round
    );

    let benefitsPerRoundAVE = this.calculateResourceBundleAve(
      propertyData.production,
      true // Production is per-round
    );

    // Add AVE from DC modifiers
    if (propertyData.dcModifiers) {
      for (const actionModifiers of Object.values(propertyData.dcModifiers)) {
        for (const dcReduction of Object.values(actionModifiers)) {
          benefitsPerRoundAVE +=
            Math.abs(dcReduction) * this.config.effects.dcReductionPoint;
          // Assuming DC reduction is a per-round benefit by enabling cheaper/more successful actions
        }
      }
    }

    // TODO: Add AVE from specialFeatures (e.g., storage, workshop capacity)
    // This will require more complex logic based on the feature type.
    // Example for workshop:
    // if (propertyData.type === 'workshop' && propertyData.specialFeatures?.conversionCapacity) {
    //   const workshopBenefit = this.calculateWorkshopBenefitAve(propertyData);
    //   benefitsPerRoundAVE += workshopBenefit;
    // }

    const netBenefitPerRoundAVE =
      benefitsPerRoundAVE - maintenanceCostPerRoundAVE;

    const totalNetBenefitOverPaybackPeriodAVE =
      netBenefitPerRoundAVE * this.config.balancing.paybackPeriodRounds;

    const paybackFactor =
      acquisitionCostAVE > 0
        ? totalNetBenefitOverPaybackPeriodAVE / acquisitionCostAVE
        : Number.POSITIVE_INFINITY; // Avoid division by zero; infinite return if free

    return {
      acquisitionCostAVE,
      maintenanceCostPerRoundAVE,
      benefitsPerRoundAVE,
      netBenefitPerRoundAVE,
      totalNetBenefitOverPaybackPeriodAVE,
      paybackFactor,
    };
  }

  /**
   * Calculates the AVE profile for a given facility type.
   * @param facilityData The raw data for the facility type.
   * @returns The calculated AVE profile.
   */
  public calculateFacilityAveProfile(
    facilityData: FacilityTypeData
  ): AveProfile {
    const acquisitionCostAVE = this.calculateResourceBundleAve(
      facilityData.buildRequirements.resources,
      false // Build costs are one-time
    );

    const maintenanceCostPerRoundAVE = this.calculateResourceBundleAve(
      facilityData.maintenance,
      true // Maintenance is per-round
    );

    let benefitsPerRoundAVE = 0;

    // Production Bonus
    if (facilityData.effects.productionBonus) {
      benefitsPerRoundAVE += this.calculateResourceBundleAve(
        facilityData.effects.productionBonus,
        true
      );
    }

    // Material Production (e.g., marketplace producing perfume every X rounds)
    if (facilityData.effects.materialProduction) {
      if (facilityData.effects.materialProduction.rawMaterials) {
        for (const matId in facilityData.effects.materialProduction
          .rawMaterials) {
          const prod =
            facilityData.effects.materialProduction.rawMaterials[matId];
          const avePerUnit =
            this.config.resources.rawMaterials[matId] ??
            this.config.resources.defaultRawMaterial;
          benefitsPerRoundAVE += (prod.amount * avePerUnit) / prod.frequency;
        }
      }
      if (facilityData.effects.materialProduction.specialMaterials) {
        for (const matId in facilityData.effects.materialProduction
          .specialMaterials) {
          const prod =
            facilityData.effects.materialProduction.specialMaterials[matId];
          const avePerUnit =
            this.config.resources.specialMaterials[matId] ??
            this.config.resources.defaultSpecialMaterial;
          benefitsPerRoundAVE += (prod.amount * avePerUnit) / prod.frequency;
        }
      }
    }

    // Maintenance Reduction
    if (facilityData.effects.maintenanceReduction) {
      benefitsPerRoundAVE += this.calculateResourceBundleAve(
        // Reduction is a benefit
        facilityData.effects.maintenanceReduction,
        true
      );
    }

    // DC Modifiers
    if (facilityData.effects.dcModifiers) {
      for (const dcReduction of Object.values(
        facilityData.effects.dcModifiers
      )) {
        benefitsPerRoundAVE +=
          Math.abs(dcReduction) * this.config.effects.dcReductionPoint;
      }
    }

    // TODO: Add AVE from other effects:
    // - storageCapacity (value of preventing decay/auto-conversion)
    // - conversionRate (value added by converting RM to SM)
    // - specialEffects (string array, needs mapping to AVE values)

    const netBenefitPerRoundAVE =
      benefitsPerRoundAVE - maintenanceCostPerRoundAVE;

    const totalNetBenefitOverPaybackPeriodAVE =
      netBenefitPerRoundAVE * this.config.balancing.paybackPeriodRounds;

    const paybackFactor =
      acquisitionCostAVE > 0
        ? totalNetBenefitOverPaybackPeriodAVE / acquisitionCostAVE
        : Number.POSITIVE_INFINITY;

    return {
      acquisitionCostAVE,
      maintenanceCostPerRoundAVE,
      benefitsPerRoundAVE,
      netBenefitPerRoundAVE,
      totalNetBenefitOverPaybackPeriodAVE,
      paybackFactor,
    };
  }

  // Placeholder for more complex benefit calculations
  // private calculateWorkshopBenefitAve(propertyData: PropertyTypeData): number {
  //   // Needs access to RawMaterialData and SpecialMaterialData to find conversion values
  //   // Example: (AVE of SM output - AVE of RM input - AVE of labor) * capacity
  //   return 0;
  // }

  // private calculateStorageBenefitAve(propertyData: PropertyTypeData | FacilityTypeData): number {
  //   // Value of preventing auto-conversion of typical stored goods
  //   return 0;
  // }
}
