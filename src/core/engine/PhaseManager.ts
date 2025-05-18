import { GameEventType, createGameEvent } from '../events/GameEvent';
import type { GameState } from '../models';
import type { GameEngine } from './GameEngine';

export class PhaseManager {
  private engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
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
    const rawMaterialsProduction: Record<string, any> = {};
    const specialMaterialsProduction: Record<string, any> = {};

    // Function to aggregate production values
    const _aggregateProduction = (production: any, source: any) => {
      for (const key in source) {
        if (typeof source[key] === 'object' && source[key] !== null) {
          if (!production[key]) production[key] = {};
          _aggregateProduction(production[key], source[key]);
        } else if (typeof source[key] === 'number') {
          production[key] = (production[key] || 0) + source[key];
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

          Object.values(rawMaterialsProduction).forEach((materialSet: any) => {
            for (const [material, amount] of Object.entries(materialSet)) {
              combinedRawMaterials[material as keyof typeof combinedRawMaterials] =
                (combinedRawMaterials[material as keyof typeof combinedRawMaterials] || 0) + (amount as number);
            }
          });

          player.resources.rawMaterials = combinedRawMaterials;
        }

        // Combine special materials
        if (Object.keys(specialMaterialsProduction).length > 0) {
          const combinedSpecialMaterials = {
            ...player.resources.specialMaterials,
          };

          Object.values(specialMaterialsProduction).forEach(
            (materialSet: any) => {
              for (const [material, amount] of Object.entries(materialSet)) {
                combinedSpecialMaterials[material as keyof typeof combinedSpecialMaterials] =
                  (combinedSpecialMaterials[material as keyof typeof combinedSpecialMaterials] || 0) +
                  (amount as number);
              }
            }
          );

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
    const _playerId = state.currentPlayerId;

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
      payload: {},
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
