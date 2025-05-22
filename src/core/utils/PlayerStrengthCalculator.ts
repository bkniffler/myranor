import type { AveConfig } from '../data/config/ave_config';
import { DEFAULT_AVE_CONFIG } from '../data/config/ave_config';
import type { GameState, Player } from '../models';
import type { PlayerStrengthProfile } from '../models/PlayerProfile';
import { AveCalculator } from './AveCalculator';

export class PlayerStrengthCalculator {
  private aveConfig: AveConfig;
  private aveCalculator: AveCalculator;

  constructor(
    aveConfig: AveConfig = DEFAULT_AVE_CONFIG,
    aveCalculator?: AveCalculator
  ) {
    this.aveConfig = aveConfig;
    this.aveCalculator = aveCalculator || new AveCalculator(this.aveConfig);
  }

  public calculatePlayerStrength(
    player: Player,
    gameState: GameState
  ): PlayerStrengthProfile {
    // 1. Liquid Resources AVE
    const liquidResourcesBundle = {
      gold: player.resources.gold,
      rawMaterials: player.resources.rawMaterials,
      specialMaterials: player.resources.specialMaterials,
      temporaryInfluence: player.resources.temporaryInfluence,
    };
    const liquidResourcesAVE = this.aveCalculator.calculateResourceBundleAve(
      liquidResourcesBundle,
      false // one-time value
    );

    // 2. Net Income Per Round AVE & Asset Potential AVE
    let totalNetProductionPerRoundAVE = 0;
    let totalMaintenancePerRoundAVE = 0;
    let assetPotentialAVE = 0;

    for (const propertyId of player.propertyIds) {
      const property = gameState.properties[propertyId];
      if (property?.active) {
        // Changed to optional chaining
        // Use pre-calculated AVE profile if available
        totalNetProductionPerRoundAVE +=
          this.aveCalculator.calculateResourceBundleAve(
            property.baseProduction,
            true
          );
        totalMaintenancePerRoundAVE +=
          this.aveCalculator.calculateResourceBundleAve(
            property.maintenanceCost,
            true
          );

        // Asset potential from the property itself
        assetPotentialAVE +=
          property.aveProfile?.totalNetBenefitOverPaybackPeriodAVE || 0;

        for (const facilityId of property.facilityIds) {
          const facility = gameState.facilities[facilityId];
          if (facility) {
            // Add facility's direct production to player's income
            if (facility.effects.productionBonus) {
              totalNetProductionPerRoundAVE +=
                this.aveCalculator.calculateResourceBundleAve(
                  facility.effects.productionBonus,
                  true
                );
            }
            // Add facility's material production
            if (facility.effects.materialProduction) {
              if (facility.effects.materialProduction.rawMaterials) {
                for (const matId in facility.effects.materialProduction
                  .rawMaterials) {
                  const prod =
                    facility.effects.materialProduction.rawMaterials[matId];
                  const avePerUnit =
                    this.aveConfig.resources.rawMaterials[matId] ??
                    this.aveConfig.resources.defaultRawMaterial;
                  totalNetProductionPerRoundAVE +=
                    (prod.amount * avePerUnit) / prod.frequency;
                }
              }
              if (facility.effects.materialProduction.specialMaterials) {
                for (const matId in facility.effects.materialProduction
                  .specialMaterials) {
                  const prod =
                    facility.effects.materialProduction.specialMaterials[matId];
                  const avePerUnit =
                    this.aveConfig.resources.specialMaterials[matId] ??
                    this.aveConfig.resources.defaultSpecialMaterial;
                  totalNetProductionPerRoundAVE +=
                    (prod.amount * avePerUnit) / prod.frequency;
                }
              }
            }

            // Subtract facility's maintenance
            if (facility.maintenanceCost) {
              totalMaintenancePerRoundAVE +=
                this.aveCalculator.calculateResourceBundleAve(
                  facility.maintenanceCost,
                  true
                );
            }

            // Add facility's own asset potential
            assetPotentialAVE +=
              facility.aveProfile?.totalNetBenefitOverPaybackPeriodAVE || 0;
          }
        }
      }
    }
    const netIncomePerRoundAVE =
      totalNetProductionPerRoundAVE - totalMaintenancePerRoundAVE;

    // 3. Permanent Influence Per Round AVE (for display, already included in netIncomePerRoundAVE if part of production)
    const displayPermanentInfluencePerRoundAVE =
      player.resources.permanentInfluence *
      this.aveConfig.resources.permanentInfluencePerRound;

    // 4. Combat Strength AVE
    const combatStrengthAVE =
      player.resources.combatPower * this.aveConfig.effects.combatPowerPoint;

    // 5. Total Strength Score
    // Simple sum for now. Weights could be introduced later.
    const totalStrengthScore =
      liquidResourcesAVE +
      netIncomePerRoundAVE * this.aveConfig.balancing.paybackPeriodRounds + // Value of ongoing income stream
      assetPotentialAVE + // Value of existing assets' future potential (already accounts for payback period)
      combatStrengthAVE;
    // Note: permanentInfluence's contribution to netIncomePerRoundAVE is already valued over the payback period.

    return {
      liquidResourcesAVE,
      netIncomePerRoundAVE,
      assetPotentialAVE,
      permanentInfluencePerRoundAVE: displayPermanentInfluencePerRoundAVE, // Display the direct per-round AVE
      combatStrengthAVE,
      totalStrengthScore,
    };
  }
}
