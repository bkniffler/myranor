import type {
  SystemAutoConversionRawCommand,
  SystemAutoConversionSpecialCommand,
  SystemConversionCommand,
  SystemMaintenanceCommand,
  SystemProductionCommand,
  SystemResetCommand, // Added SystemResetCommand
} from '../commands'; // Import system command types
import { GameEventType, createGameEvent } from '../events/GameEvent'; // Ensured GameEvent type import
import type { GameState } from '../models';
import { FacilityType } from '../models/Facility';
import { PropertyType } from '../models/Property';
import type { SpecialMaterialData } from '../models/Resources';
import { DataLoader } from '../utils';
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
      payload: { gameEvent: maintenanceEvent },
    } as SystemMaintenanceCommand);

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
        goldProduction,
        laborProduction,
        influenceProduction,
        permanentInfluenceProduction,
        rawMaterialsProduction,
        specialMaterialsProduction,
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
      payload: { gameEvent: productionEvent },
    } as SystemProductionCommand);

    // Move to next phase
    this.engine.advancePhase();
  }

  // Process the resource conversion phase
  processResourceConversionPhase(): void {
    const state = this.engine.getCurrentState();
    const playerId = state.currentPlayerId;
    const player = state.players[playerId];
    const allSpecialMaterialDefinitions =
      this.dataLoader.loadSpecialMaterials();
    const availableRawMaterials = { ...player.resources.rawMaterials };
    const specialMaterialsProducedThisPhase: Record<string, number> = {};

    // Helper function to check and consume raw materials for one unit of an SM
    const canAndConsumeForOneUnit = (
      smDef: SpecialMaterialData,
      currentRawMaterials: Record<string, number>
    ): boolean => {
      // Check availability
      for (const req of smDef.conversionRequirements) {
        if ((currentRawMaterials[req.materialId] || 0) < req.amount) {
          return false;
        }
      }
      // Consume
      for (const req of smDef.conversionRequirements) {
        currentRawMaterials[req.materialId] -= req.amount;
      }
      return true;
    };

    for (const propertyId of player.propertyIds) {
      const property = state.properties[propertyId];
      if (!property || !property.active) continue;

      // Case 1: Property is a Workshop
      if (property.type === PropertyType.WORKSHOP) {
        let workshopCapacity = property.specialData?.conversionsPerRound || 0;

        while (workshopCapacity > 0) {
          let craftedThisIteration = false;
          for (const smDef of allSpecialMaterialDefinitions) {
            const requiredFacilityTypeBySM = smDef.conversionRequirements.find(
              (req) => req.facilityType
            )?.facilityType;

            // This workshop can craft if SM requires no specific facility,
            // or requires a generic 'workshop' type (assuming FacilityType.WORKSHOP exists and is used for this)
            // or if the SM's required facility type matches this property's inherent workshop nature.
            // For simplicity, we assume a PropertyType.WORKSHOP can attempt generic conversions.
            // A more robust check might involve specific tags or capabilities on the workshop property.
            const canPropertyWorkshopCraft =
              !requiredFacilityTypeBySM ||
              requiredFacilityTypeBySM === FacilityType.WORKSHOP; // Assuming FacilityType.WORKSHOP is a valid enum for generic workshop

            if (canPropertyWorkshopCraft) {
              if (canAndConsumeForOneUnit(smDef, availableRawMaterials)) {
                specialMaterialsProducedThisPhase[smDef.id] =
                  (specialMaterialsProducedThisPhase[smDef.id] || 0) + 1;
                workshopCapacity--;
                craftedThisIteration = true;
                break; // Crafted one, try to use remaining capacity for another (or same) SM
              }
            }
          }
          if (!craftedThisIteration) break; // No SM could be crafted with remaining capacity
        }
      }

      // Case 2: Property has Facilities that can convert
      for (const facilityId of property.facilityIds) {
        const facility = state.facilities[facilityId];
        // facility is active if its parent property is active (checked by `if (!property || !property.active) continue;` above)
        if (facility?.effects?.conversionRate) {
          for (const conversionRule of facility.effects.conversionRate) {
            const targetSmDef = allSpecialMaterialDefinitions.find(
              (s) => s.id === conversionRule.outputType
            );
            if (!targetSmDef) continue;

            // Check if this facility type is appropriate for the SM's requirements
            let facilityMatchesSMRequirement = true; // Assume true if SM has no specific facility requirement
            const requiredFacilityTypeBySM =
              targetSmDef.conversionRequirements.find(
                (req) => req.facilityType
              )?.facilityType;

            if (requiredFacilityTypeBySM) {
              facilityMatchesSMRequirement =
                facility.type === requiredFacilityTypeBySM;
            }

            if (!facilityMatchesSMRequirement) continue;

            const facilityCapacityForThisSM = conversionRule.maxConversion;
            for (let i = 0; i < facilityCapacityForThisSM; i++) {
              if (canAndConsumeForOneUnit(targetSmDef, availableRawMaterials)) {
                specialMaterialsProducedThisPhase[targetSmDef.id] =
                  (specialMaterialsProducedThisPhase[targetSmDef.id] || 0) + 1;
              } else {
                break; // Not enough raw materials for another unit of this SM
              }
            }
          }
        }
      }
    }

    // If any special materials were produced, create and dispatch an event
    if (Object.keys(specialMaterialsProducedThisPhase).length > 0) {
      const conversionEvent = createGameEvent({
        type: GameEventType.RESOURCES_CONVERTED,
        playerId,
        payload: {
          workshopConversions: specialMaterialsProducedThisPhase,
          // We'll pass the final state of raw materials in the apply function
        },
        apply: (currentState: GameState): GameState => {
          const newPlayerState = { ...currentState.players[playerId] };
          newPlayerState.resources = { ...newPlayerState.resources };

          // Update raw materials (reflecting all consumptions)
          newPlayerState.resources.rawMaterials = { ...availableRawMaterials };

          // Update special materials (reflecting all productions)
          const newSpecialMaterials = {
            ...newPlayerState.resources.specialMaterials,
          };
          for (const [smId, amount] of Object.entries(
            specialMaterialsProducedThisPhase
          )) {
            newSpecialMaterials[smId] =
              (newSpecialMaterials[smId] || 0) + amount;
          }
          newPlayerState.resources.specialMaterials = newSpecialMaterials;

          return {
            ...currentState,
            players: {
              ...currentState.players,
              [playerId]: newPlayerState,
            },
          };
        },
      });
      this.engine.executeCommand({
        type: 'SYSTEM_CONVERSION',
        playerId,
        payload: { gameEvent: conversionEvent },
      } as SystemConversionCommand);
    }

    // Automatic conversion of raw materials to gold (if no storage)
    // This logic now uses 'availableRawMaterials' which has been depleted by workshop production
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

    // If no storage, convert remaining raw materials to gold
    // This uses 'availableRawMaterials' which reflects post-workshop-conversion amounts
    if (
      !hasStorage &&
      Object.values(availableRawMaterials).some((val) => val > 0)
    ) {
      let goldFromRaw = 0;
      const rawMaterialsConsumedForGold: Record<string, number> = {};

      for (const [materialId, amount] of Object.entries(
        availableRawMaterials
      )) {
        if (amount > 0) {
          const goldValue = Math.floor(amount / 4);
          if (goldValue > 0) {
            goldFromRaw += goldValue;
            const amountToConsume = goldValue * 4;
            rawMaterialsConsumedForGold[materialId] = amountToConsume;
            availableRawMaterials[materialId] =
              (availableRawMaterials[materialId] || 0) - amountToConsume;
          }
        }
      }

      if (goldFromRaw > 0) {
        const rawToGoldEvent = createGameEvent({
          type: GameEventType.RESOURCES_AUTO_CONVERTED, // Consider a more specific type if needed
          playerId,
          payload: {
            rawMaterialsConverted: rawMaterialsConsumedForGold,
            goldGained: goldFromRaw,
          },
          apply: (currentState: GameState): GameState => {
            const newPlayerState = { ...currentState.players[playerId] };
            newPlayerState.resources = { ...newPlayerState.resources };
            newPlayerState.resources.gold += goldFromRaw;
            // Raw materials are already updated in availableRawMaterials,
            // so we ensure the player state reflects this final version.
            newPlayerState.resources.rawMaterials = {
              ...availableRawMaterials,
            };
            return {
              ...currentState,
              players: { ...currentState.players, [playerId]: newPlayerState },
            };
          },
        });
        this.engine.executeCommand({
          type: 'SYSTEM_AUTO_CONVERSION_RAW',
          playerId,
          payload: { gameEvent: rawToGoldEvent }, // Corrected payload
        } as SystemAutoConversionRawCommand);
      }
    }
    // Loss of unconvertible raw materials if no storage
    if (!hasStorage) {
      for (const materialId in availableRawMaterials) {
        if (
          availableRawMaterials[materialId] > 0 &&
          availableRawMaterials[materialId] < 4
        ) {
          // These are lost
          availableRawMaterials[materialId] = 0;
        }
      }
      // Event for lost raw materials (optional, good for logging/UI)
      // For now, just update the state in the next apply if needed, or ensure raw-to-gold apply sets final state.
      // The raw-to-gold apply function now sets player.resources.rawMaterials = { ...availableRawMaterials };
      // which will include these zeroed out amounts.
    }

    // Similarly, convert special materials to gold (if no storage)
    // This should use the player's special materials *after* workshop production
    const smForGoldConversion = { ...player.resources.specialMaterials };
    for (const [smId, amount] of Object.entries(
      specialMaterialsProducedThisPhase
    )) {
      smForGoldConversion[smId] = (smForGoldConversion[smId] || 0) + amount;
    }

    if (
      !hasStorage &&
      Object.values(smForGoldConversion).some((val) => val > 0)
    ) {
      let goldFromSpecial = 0;
      const specialMaterialsConsumedForGold: Record<string, number> = {};

      for (const [materialId, amount] of Object.entries(smForGoldConversion)) {
        if (amount > 0) {
          const goldValue = amount * 2;
          goldFromSpecial += goldValue;
          specialMaterialsConsumedForGold[materialId] = amount;
          // These special materials will be effectively zeroed out in the apply function
        }
      }

      if (goldFromSpecial > 0) {
        const specialToGoldEvent = createGameEvent({
          type: GameEventType.RESOURCES_AUTO_CONVERTED, // Consider a more specific type
          playerId,
          payload: {
            specialMaterialsConverted: specialMaterialsConsumedForGold,
            goldGained: goldFromSpecial,
          },
          apply: (currentState: GameState): GameState => {
            const newPlayerState = { ...currentState.players[playerId] };
            newPlayerState.resources = { ...newPlayerState.resources };
            newPlayerState.resources.gold += goldFromSpecial;

            const finalSpecialMaterials = {
              ...newPlayerState.resources.specialMaterials,
            };
            for (const smId of Object.keys(specialMaterialsConsumedForGold)) {
              finalSpecialMaterials[smId] =
                (finalSpecialMaterials[smId] || 0) -
                (specialMaterialsConsumedForGold[smId] || 0);
              if (finalSpecialMaterials[smId] <= 0) {
                delete finalSpecialMaterials[smId];
              }
            }
            newPlayerState.resources.specialMaterials = finalSpecialMaterials;

            // Ensure raw materials reflect any losses if not already handled by raw-to-gold apply
            newPlayerState.resources.rawMaterials = {
              ...availableRawMaterials,
            };

            return {
              ...currentState,
              players: { ...currentState.players, [playerId]: newPlayerState },
            };
          },
        });
        this.engine.executeCommand({
          type: 'SYSTEM_AUTO_CONVERSION_SPECIAL',
          playerId,
          payload: { gameEvent: specialToGoldEvent },
        } as SystemAutoConversionSpecialCommand);
      }
    }
    // Ensure player's raw materials in the actual state are updated to availableRawMaterials
    // if no gold conversion happened that would do it.
    // This is best handled by ensuring the apply function of the *last* event in this phase
    // sets the final raw/special material counts.
    // The special-to-gold event's apply function now also sets rawMaterials.

    // Move to next phase
    this.engine.advancePhase();
  }

  // Process the resource reset phase
  processResourceResetPhase(): void {
    const state = this.engine.getCurrentState();
    const playerId = state.currentPlayerId;

    // Create resource reset event
    const resetEvent = createGameEvent({
      type: GameEventType.RESOURCES_RESET,
      playerId,
      payload: {}, // Payload for the event itself, not the command
      apply: (state: GameState): GameState => {
        const player = { ...state.players[playerId] };

        // Reset temporary influence
        player.resources = {
          ...state.players[playerId].resources, // Ensure we're using latest from state for other resources
          temporaryInfluence: 0,
          laborPower: state.players[playerId].resources.baseLaborPower, // Use baseLaborPower from state
        };

        // Reset semi-permanent influence gained this round for each office
        if (player.influenceGainedThisRound) {
          player.influenceGainedThisRound.semiPermanentPerOffice = {};
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
      type: 'SYSTEM_RESET',
      playerId,
      payload: { gameEvent: resetEvent }, // Corrected payload
    } as SystemResetCommand);

    // Move to next phase
    this.engine.advancePhase();
  }
}
