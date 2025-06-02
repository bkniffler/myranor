import {
  type GameEvent,
  GameEventType,
  createGameEvent,
} from '../events/GameEvent';
import type { GameState, Player } from '../models';
import { MarketPriceCategory, PropertySize, PropertyType } from '../models'; // Added PropertyType and PropertySize
import type { GameCommand } from './GameCommand';

// Define the structure for an investment unit for selling
export interface SellInvestmentUnit {
  type: 'rawMaterial' | 'specialMaterial'; // 'permanentLabor' can be added later
  materialId: string;
  // For raw materials, this should always be 6 as per rules.
  // For special materials, this should always be 1.
  // The command will enforce these counts based on type.
  count: number;
}

export interface SellMaterialsCommandPayload {
  investments: SellInvestmentUnit[];
  [key: string]: any; // For GameCommand compatibility
}

export interface SellMaterialsCommand extends GameCommand {
  type: 'SELL_MATERIALS';
  payload: SellMaterialsCommandPayload;
}

// Helper to determine trading post level for investment caps
function getTradingPostLevel(
  player: Player,
  state: GameState
): PropertySize | null {
  for (const propertyId of player.propertyIds) {
    const property = state.properties[propertyId];
    if (property?.active && property.type === PropertyType.TRADING_COMPANY) {
      return property.size;
    }
  }
  return null;
}

function getInvestmentCap(tradingPostLevel: PropertySize | null): number {
  if (tradingPostLevel === PropertySize.LARGE) return 10; // Example: Max 2 + 2*3 (small, medium, large) = 8. Adjust as per exact rule interpretation.
  if (tradingPostLevel === PropertySize.MEDIUM) return 6; // Max 2 + 2*2 = 6
  if (tradingPostLevel === PropertySize.SMALL) return 4; // Max 2 + 2*1 = 4
  return 2; // No trading post
}

const RAW_MATERIAL_SELL_BUNDLE_SIZE = 6;
const SPECIAL_MATERIAL_SELL_BUNDLE_SIZE = 1;

export const sellMaterialsHandler = {
  validate: (command: SellMaterialsCommand, state: GameState): boolean => {
    const player = state.players[command.playerId];
    if (!player) return false;

    if (state.phase !== 'action') return false;
    if (state.actionPointsRemaining <= 0) return false;

    const { investments } = command.payload;
    if (!investments || investments.length === 0) return false; // Must sell something

    // Validate investment cap
    const tradingPostLevel = getTradingPostLevel(player, state);
    const cap = getInvestmentCap(tradingPostLevel);
    if (investments.length > cap) return false;

    // Validate each investment unit and tally required materials
    const requiredRawMaterials: Record<string, number> = {};
    const requiredSpecialMaterials: Record<string, number> = {};

    for (const unit of investments) {
      if (unit.type === 'rawMaterial') {
        if (unit.count !== RAW_MATERIAL_SELL_BUNDLE_SIZE) return false; // Enforce bundle size
        requiredRawMaterials[unit.materialId] =
          (requiredRawMaterials[unit.materialId] || 0) + unit.count;
      } else if (unit.type === 'specialMaterial') {
        if (unit.count !== SPECIAL_MATERIAL_SELL_BUNDLE_SIZE) return false; // Enforce bundle size
        requiredSpecialMaterials[unit.materialId] =
          (requiredSpecialMaterials[unit.materialId] || 0) + unit.count;
      } else {
        return false; // Unknown investment type
      }
    }

    // Check if player has enough raw materials
    for (const [material, amount] of Object.entries(requiredRawMaterials)) {
      if ((player.resources.rawMaterials[material] || 0) < amount) return false;
    }

    // Check if player has enough special materials
    for (const [material, amount] of Object.entries(requiredSpecialMaterials)) {
      if ((player.resources.specialMaterials[material] || 0) < amount)
        return false;
    }

    // TODO: DC validation based on number of investments (4+ for medium, 8+ for large)

    return true;
  },

  execute: (command: SellMaterialsCommand, state: GameState): GameEvent[] => {
    // const player = state.players[command.playerId]; // Unused
    const { investments } = command.payload;
    const marketPrices = state.market;
    let totalGoldGained = 0;

    const materialsSoldPayload: {
      raw: Record<string, number>;
      special: Record<string, number>;
    } = { raw: {}, special: {} };

    // TODO: Implement DC check and success scale from SOURCE.MD
    // For now, assume normal success (base exchange value + 1 gold per investment unit)

    for (const unit of investments) {
      let marketValue = 0;
      const fixedBonusPerInvestment = 1;

      if (unit.type === 'rawMaterial') {
        const materialMarketData = marketPrices.rawMaterials[unit.materialId];
        if (materialMarketData) {
          let price = materialMarketData.basePrice;
          // Apply demand modifiers (simplified for now, could be more complex)
          if (
            materialMarketData.currentDemand === MarketPriceCategory.HIGH_DEMAND
          )
            price *= 1.5;
          else if (
            materialMarketData.currentDemand === MarketPriceCategory.COVETED
          )
            price *= 2;
          else if (
            materialMarketData.currentDemand ===
            MarketPriceCategory.NOT_IN_DEMAND
          )
            price *= 0.5;
          if (materialMarketData.priceModifier)
            price *= 1 + materialMarketData.priceModifier;

          // Value for the bundle of 6
          marketValue = Math.floor(price * unit.count);
        } else {
          marketValue = unit.count; // Fallback: 1 gold per material if not in market
        }
        materialsSoldPayload.raw[unit.materialId] =
          (materialsSoldPayload.raw[unit.materialId] || 0) + unit.count;
      } else if (unit.type === 'specialMaterial') {
        const materialMarketData =
          marketPrices.specialMaterials[unit.materialId];
        if (materialMarketData) {
          let price = materialMarketData.basePrice;
          // Apply demand modifiers
          if (
            materialMarketData.currentDemand === MarketPriceCategory.HIGH_DEMAND
          )
            price *= 1.5;
          else if (
            materialMarketData.currentDemand === MarketPriceCategory.COVETED
          )
            price *= 2;
          else if (
            materialMarketData.currentDemand ===
            MarketPriceCategory.NOT_IN_DEMAND
          )
            price *= 0.5;
          if (materialMarketData.priceModifier)
            price *= 1 + materialMarketData.priceModifier;

          marketValue = Math.floor(price * unit.count); // unit.count is 1 for special
        } else {
          marketValue = unit.count * 2; // Fallback: 2 gold per special material
        }
        materialsSoldPayload.special[unit.materialId] =
          (materialsSoldPayload.special[unit.materialId] || 0) + unit.count;
      }
      totalGoldGained += marketValue + fixedBonusPerInvestment;
    }

    const sellEvent = createGameEvent({
      type: GameEventType.MATERIALS_SOLD,
      playerId: command.playerId,
      payload: {
        investmentsSold: investments, // Keep track of what was sold per investment rules
        rawMaterialsSold: materialsSoldPayload.raw,
        specialMaterialsSold: materialsSoldPayload.special,
        goldGained: totalGoldGained,
        // successLevel: 'Normal', // TODO: Add once DC/success scale is in
      },
      apply: (currentState: GameState): GameState => {
        const newPlayerState = { ...currentState.players[command.playerId] };
        newPlayerState.resources = { ...newPlayerState.resources };

        newPlayerState.resources.gold += totalGoldGained;

        const newRawMaterials = { ...newPlayerState.resources.rawMaterials };
        for (const unit of investments) {
          if (unit.type === 'rawMaterial') {
            newRawMaterials[unit.materialId] =
              (newRawMaterials[unit.materialId] || 0) - unit.count;
            if (newRawMaterials[unit.materialId] <= 0)
              delete newRawMaterials[unit.materialId];
          }
        }
        newPlayerState.resources.rawMaterials = newRawMaterials;

        const newSpecialMaterials = {
          ...newPlayerState.resources.specialMaterials,
        };
        for (const unit of investments) {
          if (unit.type === 'specialMaterial') {
            newSpecialMaterials[unit.materialId] =
              (newSpecialMaterials[unit.materialId] || 0) - unit.count;
            if (newSpecialMaterials[unit.materialId] <= 0)
              delete newSpecialMaterials[unit.materialId];
          }
        }
        newPlayerState.resources.specialMaterials = newSpecialMaterials;

        return {
          ...currentState,
          actionPointsRemaining: currentState.actionPointsRemaining - 1,
          players: {
            ...currentState.players,
            [command.playerId]: newPlayerState,
          },
        };
      },
    });

    return [sellEvent];
  },
};
