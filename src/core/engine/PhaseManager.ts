import { DataLoader } from '../data/loaders/DataLoader';
import { GameEventType, createGameEvent } from '../events/GameEvent';
import type { GameState } from '../models';
import type { GameEngine } from './GameEngine';

export class PhaseManager {
  private engine: GameEngine;
  private dataLoader: DataLoader;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.dataLoader = new DataLoader();
  }

  // Process the maintenance phase
  processMaintenancePhase(): void {
    const state = this.engine.getCurrentState();
    const playerId = state.currentPlayerId;

    // Skip maintenance on first round
    if (state.round === 1) {
      this.engine.advancePhase();
      return;
    }

    // Get the current player
    const player = state.players[playerId];

    // Calculate total maintenance costs
    let totalGoldCost = 0;
    let totalLaborCost = 0;

    // Labor cost for all players (1 gold per 4 labor)
    totalGoldCost += Math.floor(player.resources.baseLaborPower / 4);

    // Property maintenance costs
    for (const propertyId of player.propertyIds) {
      const property = state.properties[propertyId];

      if (property?.active) {
        totalGoldCost += property.maintenanceCost.gold || 0;
        totalLaborCost += property.maintenanceCost.laborPower || 0;
      }
    }

    // Facility maintenance costs
    for (const propertyId of player.propertyIds) {
      const property = state.properties[propertyId];

      if (property?.active) {
        for (const facilityId of property.facilityIds) {
          const facility = state.facilities[facilityId];

          if (facility?.maintenanceCost) {
            totalGoldCost += facility.maintenanceCost.gold || 0;
            totalLaborCost += facility.maintenanceCost.laborPower || 0;
          }
        }
      }
    }

    // Create maintenance event
    const maintenanceEvent = createGameEvent({
      type: GameEventType.MAINTENANCE_PERFORMED,
      playerId,
      payload: {
        goldCost: totalGoldCost,
        laborCost: totalLaborCost,
      },
      apply: (state: GameState): GameState => {
        const player = { ...state.players[playerId] };

        // Deduct maintenance costs
        player.resources = {
          ...player.resources,
          gold: player.resources.gold - totalGoldCost,
          laborPower: player.resources.laborPower - totalLaborCost,
        };

        // Update player in state
        return {
          ...state,
          players: {
            ...state.players,
            [playerId]: player,
          },
        };
      },
    });

    // Add event to store
    this.engine.executeCommand({
      type: 'SYSTEM_MAINTENANCE',
      playerId,
      payload: {},
      validate: () => true,
      execute: () => [maintenanceEvent],
    });

    // Move to next phase
    this.engine.advancePhase();
  }

  // Process the production phase
  processProductionPhase(): void {
    const state = this.engine.getCurrentState();
    const playerId = state.currentPlayerId;

    // Get the current player
    const player = state.players[playerId];

    // Calculate production from properties
    const goldProduction: Record<string, number> = {};
    const laborProduction: Record<string, number> = {};
    const influenceProduction: Record<string, number> = {};
    const permanentInfluenceProduction: Record<string, number> = {};
    const rawMaterialsProduction: Record<string, Record<string, number>> = {};
    const specialMaterialsProduction: Record<
      string,
      Record<string, number>
    > = {};

    // Function to aggregate production values
    const _aggregateProduction = (
      production: Record<string, unknown>,
      source: Record<string, unknown>
    ) => {
      for (const key in source) {
        if (typeof source[key] === 'object' && source[key] !== null) {
          if (!production[key]) production[key] = {};
          _aggregateProduction(
            production[key] as Record<string, unknown>,
            source[key] as Record<string, unknown>
          );
        } else if (typeof source[key] === 'number') {
          production[key] =
            ((production[key] as number) || 0) + (source[key] as number);
        }
      }
    };

    // Process property production
    for (const propertyId of player.propertyIds) {
      const property = state.properties[propertyId];

      if (property?.active) {
        // Process base production
        if (property.baseProduction) {
          if (property.baseProduction.gold) {
            goldProduction[property.id] = property.baseProduction.gold;
          }

          if (property.baseProduction.laborPower) {
            laborProduction[property.id] = property.baseProduction.laborPower;
          }

          if (property.baseProduction.influence) {
            influenceProduction[property.id] =
              property.baseProduction.influence;
          }

          if (property.baseProduction.permanentInfluence) {
            permanentInfluenceProduction[property.id] =
              property.baseProduction.permanentInfluence;
          }

          if (property.baseProduction.rawMaterials) {
            rawMaterialsProduction[property.id] =
              property.baseProduction.rawMaterials;
          }

          if (property.baseProduction.specialMaterials) {
            specialMaterialsProduction[property.id] =
              property.baseProduction.specialMaterials;
          }
        }

        // Process facility production
        for (const facilityId of property.facilityIds) {
          const facility = state.facilities[facilityId];

          if (facility?.effects.productionBonus) {
            const bonus = facility.effects.productionBonus;

            if (bonus.gold) {
              goldProduction[facility.id] = bonus.gold;
            }

            if (bonus.laborPower) {
              laborProduction[facility.id] = bonus.laborPower;
            }

            if (bonus.influence) {
              influenceProduction[facility.id] = bonus.influence;
            }

            if (bonus.permanentInfluence) {
              permanentInfluenceProduction[facility.id] =
                bonus.permanentInfluence;
            }

            if (bonus.rawMaterials) {
              rawMaterialsProduction[facility.id] = bonus.rawMaterials;
            }

            if (bonus.specialMaterials) {
              specialMaterialsProduction[facility.id] = bonus.specialMaterials;
            }
          }
        }
      }
    }

    // Calculate total production
    const totalGoldProduction = Object.values(goldProduction).reduce(
      (sum, val) => sum + val,
      0
    );
    const totalLaborProduction = Object.values(laborProduction).reduce(
      (sum, val) => sum + val,
      0
    );
    const totalInfluenceProduction = Object.values(influenceProduction).reduce(
      (sum, val) => sum + val,
      0
    );
    const totalPermanentInfluenceProduction = Object.values(
      permanentInfluenceProduction
    ).reduce((sum, val) => sum + val, 0);

    // Create production event
    const productionEvent = createGameEvent({
      type: GameEventType.RESOURCES_PRODUCED,
      playerId,
      payload: {
        properties: {
          // Map properties to their production data
          ...Object.fromEntries(
            player.propertyIds
              .filter((id) => state.properties[id]?.active)
              .map((id) => [
                id,
                {
                  production: {
                    gold: goldProduction[id] || 0,
                    laborPower: laborProduction[id] || 0,
                    influence: influenceProduction[id] || 0,
                    rawMaterials: rawMaterialsProduction[id] || {},
                    specialMaterials: specialMaterialsProduction[id] || {},
                  },
                },
              ])
          ),
        },
        totalProduction: {
          gold: totalGoldProduction,
          laborPower: totalLaborProduction,
          influence: totalInfluenceProduction,
          rawMaterials: Object.values(rawMaterialsProduction).reduce(
            (acc, val) => {
              for (const [material, amount] of Object.entries(val)) {
                acc[material] = (acc[material] || 0) + amount;
              }
              return acc;
            },
            {}
          ),
          specialMaterials: Object.values(specialMaterialsProduction).reduce(
            (acc, val) => {
              for (const [material, amount] of Object.entries(val)) {
                acc[material] = (acc[material] || 0) + amount;
              }
              return acc;
            },
            {}
          ),
        },
      },
      apply: (state: GameState): GameState => {
        const player = { ...state.players[playerId] };

        // Add production values
        player.resources = {
          ...player.resources,
          gold: player.resources.gold + totalGoldProduction,
          laborPower: player.resources.laborPower + totalLaborProduction,
          temporaryInfluence:
            player.resources.temporaryInfluence + totalInfluenceProduction,
          permanentInfluence:
            player.resources.permanentInfluence +
            totalPermanentInfluenceProduction,
        };

        // Combine raw materials
        if (Object.keys(rawMaterialsProduction).length > 0) {
          const combinedRawMaterials = { ...player.resources.rawMaterials };

          for (const materialSet of Object.values(rawMaterialsProduction)) {
            for (const [material, amount] of Object.entries(materialSet)) {
              combinedRawMaterials[
                material as keyof typeof combinedRawMaterials
              ] =
                (combinedRawMaterials[
                  material as keyof typeof combinedRawMaterials
                ] || 0) + (amount as number);
            }
          }

          player.resources.rawMaterials = combinedRawMaterials;
        }

        // Combine special materials
        if (Object.keys(specialMaterialsProduction).length > 0) {
          const combinedSpecialMaterials = {
            ...player.resources.specialMaterials,
          };

          for (const materialSet of Object.values(specialMaterialsProduction)) {
            for (const [material, amount] of Object.entries(materialSet)) {
              combinedSpecialMaterials[
                material as keyof typeof combinedSpecialMaterials
              ] =
                (combinedSpecialMaterials[
                  material as keyof typeof combinedSpecialMaterials
                ] || 0) + (amount as number);
            }
          }

          player.resources.specialMaterials = combinedSpecialMaterials;
        }

        // Update player in state
        return {
          ...state,
          players: {
            ...state.players,
            [playerId]: player,
          },
        };
      },
    });

    // Add event to store
    this.engine.executeCommand({
      type: 'SYSTEM_PRODUCTION',
      playerId,
      payload: {},
      validate: () => true,
      execute: () => [productionEvent],
    });

    // Move to next phase
    this.engine.advancePhase();
  }

  // Process the resource conversion phase
  processResourceConversionPhase(): void {
    const state = this.engine.getCurrentState();
    const playerId = state.currentPlayerId;
    const player = state.players[playerId];

    // Process automatic workshop conversions from raw to special materials
    const hasWorkshops = player.propertyIds.some((propertyId) => {
      const property = state.properties[propertyId];
      return property?.active && property.type === 'workshop';
    });

    // Process materials conversion
    if (hasWorkshops) {
      // Load all special materials from JSON
      const specialMaterials = this.dataLoader.loadSpecialMaterials();

      // Get available raw materials
      const rawMaterials = { ...player.resources.rawMaterials };
      const specialMaterialsToAdd: Record<string, number> = {};

      // Process each special material that could potentially be crafted
      for (const specialMaterial of specialMaterials) {
        // Check if we have the necessary raw materials for this conversion
        const canCraft = specialMaterial.conversionRequirements.every((req) => {
          const availableAmount = rawMaterials[req.materialId] || 0;
          return availableAmount >= req.amount;
        });

        // Check if there's a matching workshop facility
        let matchingWorkshop = false;
        if (canCraft) {
          // Look for a matching workshop type if required
          const requiredFacilityType =
            specialMaterial.conversionRequirements.find(
              (req) => req.facilityType
            )?.facilityType;

          if (requiredFacilityType) {
            // Check if we have a matching facility
            for (const propertyId of player.propertyIds) {
              const property = state.properties[propertyId];
              if (property?.active) {
                for (const facilityId of property.facilityIds) {
                  const facility = state.facilities[facilityId];
                  if (facility && facility.type === requiredFacilityType) {
                    matchingWorkshop = true;
                    break;
                  }
                }
                if (matchingWorkshop) break;
              }
            }
          } else {
            // If no specific facility is required, check if we have any workshop
            for (const propertyId of player.propertyIds) {
              const property = state.properties[propertyId];
              if (property?.active && property.type === 'workshop') {
                matchingWorkshop = true;
                break;
              }
            }
          }
        }

        // If we can craft and have the right facility, process the conversion
        if (canCraft && matchingWorkshop) {
          // Calculate maximum conversion based on available materials
          let maxConversion = Number.POSITIVE_INFINITY;
          for (const req of specialMaterial.conversionRequirements) {
            const availableAmount = rawMaterials[req.materialId] || 0;
            const possibleConversions = Math.floor(
              availableAmount / req.amount
            );
            maxConversion = Math.min(maxConversion, possibleConversions);
          }

          // Limit to 1 per workshop for basic conversions in V1
          maxConversion = Math.min(maxConversion, 1);

          if (maxConversion > 0) {
            // Consume raw materials
            for (const req of specialMaterial.conversionRequirements) {
              const materialToConsume = req.amount * maxConversion;
              rawMaterials[req.materialId] =
                (rawMaterials[req.materialId] || 0) - materialToConsume;
            }

            // Add special material
            specialMaterialsToAdd[specialMaterial.id] = maxConversion;
          }
        }
      }

      // If we have changes, create a conversion event
      if (Object.keys(specialMaterialsToAdd).length > 0) {
        const conversionEvent = createGameEvent({
          type: GameEventType.RESOURCES_CONVERTED,
          playerId,
          payload: {
            rawMaterialsConverted: Object.fromEntries(
              Object.entries(rawMaterials)
                .map(([material, amount]) => [
                  material,
                  (player.resources.rawMaterials[material] || 0) - amount,
                ])
                .filter(([_, amount]) => Number(amount) > 0)
            ),
            specialMaterialsConverted: specialMaterialsToAdd,
            goldGained: 0, // Workshop conversions don't generate gold directly
          },
          apply: (state: GameState): GameState => {
            const player = { ...state.players[playerId] };

            // Update raw materials (consumed)
            player.resources.rawMaterials = { ...rawMaterials };

            // Update special materials (produced)
            const updatedSpecialMaterials = {
              ...player.resources.specialMaterials,
            };
            for (const [materialId, amount] of Object.entries(
              specialMaterialsToAdd
            )) {
              updatedSpecialMaterials[materialId] =
                (updatedSpecialMaterials[materialId] || 0) + amount;
            }
            player.resources.specialMaterials = updatedSpecialMaterials;

            return {
              ...state,
              players: {
                ...state.players,
                [playerId]: player,
              },
            };
          },
        });

        // Add event to store
        this.engine.executeCommand({
          type: 'SYSTEM_CONVERSION',
          playerId,
          payload: {},
          validate: () => true,
          execute: () => [conversionEvent],
        });
      }
    }

    // Automatic conversion of raw materials to gold (if no storage)
    // Check if the player has any storage facilities
    const hasStorage = player.propertyIds.some((propertyId) => {
      const property = state.properties[propertyId];
      if (!property || !property.active) return false;

      // Check if the property itself is a warehouse
      if (property.type === 'warehouse') return true;

      // Check if the property has any storage facilities
      return property.facilityIds.some((facilityId) => {
        const facility = state.facilities[facilityId];
        return facility && facility.type === 'storage';
      });
    });

    // If no storage, convert raw materials to gold
    if (
      !hasStorage &&
      Object.values(player.resources.rawMaterials).some((val) => val > 0)
    ) {
      let totalGoldToAdd = 0;
      const rawMaterialsToConvert: Record<string, number> = {};

      // Calculate gold value of each raw material (4 raw = 1 gold in V1)
      for (const [materialId, amount] of Object.entries(
        player.resources.rawMaterials
      )) {
        if (amount > 0) {
          const goldValue = Math.floor(amount / 4);
          if (goldValue > 0) {
            totalGoldToAdd += goldValue;
            rawMaterialsToConvert[materialId] = goldValue * 4; // Amount to convert
          }
        }
      }

      if (totalGoldToAdd > 0) {
        const autoConversionEvent = createGameEvent({
          type: GameEventType.RESOURCES_AUTO_CONVERTED,
          playerId,
          payload: {
            rawMaterialsConverted: rawMaterialsToConvert,
            goldGained: totalGoldToAdd,
          },
          apply: (state: GameState): GameState => {
            const player = { ...state.players[playerId] };

            // Add gold
            player.resources.gold += totalGoldToAdd;

            // Remove converted raw materials
            const updatedRawMaterials = { ...player.resources.rawMaterials };
            for (const [materialId, amountToConvert] of Object.entries(
              rawMaterialsToConvert
            )) {
              updatedRawMaterials[materialId] =
                (updatedRawMaterials[materialId] || 0) - amountToConvert;
            }
            player.resources.rawMaterials = updatedRawMaterials;

            return {
              ...state,
              players: {
                ...state.players,
                [playerId]: player,
              },
            };
          },
        });

        this.engine.executeCommand({
          type: 'SYSTEM_AUTO_CONVERSION',
          playerId,
          payload: {},
          validate: () => true,
          execute: () => [autoConversionEvent],
        });
      }
    }

    // Similarly, convert special materials to gold (if no storage)
    if (
      !hasStorage &&
      Object.values(player.resources.specialMaterials).some((val) => val > 0)
    ) {
      let totalGoldToAdd = 0;
      const specialMaterialsToConvert: Record<string, number> = {};

      // Calculate gold value of each special material (1 special = 2 gold in V1)
      for (const [materialId, amount] of Object.entries(
        player.resources.specialMaterials
      )) {
        if (amount > 0) {
          const goldValue = amount * 2; // Each special material is worth 2 gold
          totalGoldToAdd += goldValue;
          specialMaterialsToConvert[materialId] = amount; // Convert all
        }
      }

      if (totalGoldToAdd > 0) {
        const autoConversionEvent = createGameEvent({
          type: GameEventType.RESOURCES_AUTO_CONVERTED,
          playerId,
          payload: {
            specialMaterialsConverted: specialMaterialsToConvert,
            goldGained: totalGoldToAdd,
          },
          apply: (state: GameState): GameState => {
            const player = { ...state.players[playerId] };

            // Add gold
            player.resources.gold += totalGoldToAdd;

            // Remove converted special materials
            player.resources.specialMaterials = {};

            return {
              ...state,
              players: {
                ...state.players,
                [playerId]: player,
              },
            };
          },
        });

        this.engine.executeCommand({
          type: 'SYSTEM_AUTO_CONVERSION',
          playerId,
          payload: {},
          validate: () => true,
          execute: () => [autoConversionEvent],
        });
      }
    }

    // Move to next phase
    this.engine.advancePhase();
  }

  // Process the resource reset phase
  processResourceResetPhase(): void {
    const state = this.engine.getCurrentState();
    const playerId = state.currentPlayerId;
    const player = state.players[playerId];

    // Create resource reset event
    const resetEvent = createGameEvent({
      type: GameEventType.RESOURCES_RESET,
      playerId,
      payload: {
        previousState: {
          laborPower: player.resources.laborPower,
          influence: player.resources.temporaryInfluence,
        },
        newState: {
          laborPower: player.resources.baseLaborPower,
          influence: 0,
        },
      },
      apply: (state: GameState): GameState => {
        const player = { ...state.players[playerId] };

        // Reset temporary influence
        player.resources = {
          ...player.resources,
          temporaryInfluence: 0,
          laborPower: player.resources.baseLaborPower,
        };

        // Update player in state
        return {
          ...state,
          players: {
            ...state.players,
            [playerId]: player,
          },
        };
      },
    });

    // Add event to store
    this.engine.executeCommand({
      type: 'SYSTEM_RESET',
      playerId,
      payload: {},
      validate: () => true,
      execute: () => [resetEvent],
    });

    // Move to next phase
    this.engine.advancePhase();
  }
}
