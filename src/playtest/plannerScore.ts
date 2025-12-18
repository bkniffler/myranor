import type { CampaignState, MaterialStock, PlayerState } from '../core';

import { rawAutoConvertDivisor } from '../core/rules/eventModifiers_v1';
import { storageCapacity } from '../core/rules/v1';

export type NetWorthWeights = {
  gold: number;
  pendingGold: number;
  inventoryGoldEq: number;
  pendingInventoryGoldEq: number;
  labor: number;
  influence: number;
  storageCapacityGoldEq: number;
  combatPower: number;
};

export const DEFAULT_NET_WORTH_WEIGHTS: NetWorthWeights = {
  gold: 1,
  pendingGold: 0.9,
  inventoryGoldEq: 1,
  pendingInventoryGoldEq: 0.75,
  labor: 0.5,
  influence: 0.25,
  storageCapacityGoldEq: 0.05,
  combatPower: 0.25,
};

export type NetWorthBreakdown = {
  gold: number;
  pendingGold: number;
  inventoryGoldEq: number;
  pendingInventoryGoldEq: number;
  labor: number;
  influence: number;
  storageCapacityGoldEq: number;
  combatPower: number;
  score: number;
};

function rawStockGoldEq(state: CampaignState, stock: MaterialStock): number {
  let value = 0;
  for (const [materialId, count] of Object.entries(stock)) {
    const c = count ?? 0;
    if (c <= 0) continue;
    const divisor = rawAutoConvertDivisor(materialId, state.globalEvents, state.round);
    value += c / Math.max(1, divisor);
  }
  return value;
}

function specialStockGoldEq(stock: MaterialStock): number {
  let value = 0;
  for (const count of Object.values(stock)) value += 2 * (count ?? 0);
  return value;
}

function inventoryGoldEq(state: CampaignState, me: PlayerState['economy']['inventory']): number {
  return rawStockGoldEq(state, me.raw) + specialStockGoldEq(me.special);
}

function pendingInventoryGoldEq(state: CampaignState, me: PlayerState['economy']['pending']): number {
  return rawStockGoldEq(state, me.raw) + specialStockGoldEq(me.special);
}

function storageCapacityGoldEq(state: CampaignState, player: PlayerState): number {
  const ids = new Set(player.turn.upkeep.maintainedStorageIds);
  let rawCap = 0;
  let specialCap = 0;
  for (const s of player.holdings.storages) {
    if (!ids.has(s.id)) continue;
    const cap = storageCapacity(s.tier, state.rules);
    rawCap += cap.raw;
    specialCap += cap.special;
  }
  // Treat capacity as "potentially preservable value" at auto-conversion rates.
  return rawCap / 4 + specialCap * 2;
}

function combatPower(player: PlayerState): number {
  // Rough proxy for "military options": bodyguards and mercenaries count more than militia/thugs.
  const t = player.holdings.troops;
  return t.bodyguardLevels * 2 + t.mercenaryLevels * 1.5 + t.militiaLevels * 1 + t.thugLevels * 0.75;
}

export function computeNetWorth(
  state: CampaignState,
  player: PlayerState,
  weights: NetWorthWeights = DEFAULT_NET_WORTH_WEIGHTS,
): NetWorthBreakdown {
  const breakdown: Omit<NetWorthBreakdown, 'score'> = {
    gold: player.economy.gold,
    pendingGold: player.economy.pending.gold,
    inventoryGoldEq: inventoryGoldEq(state, player.economy.inventory),
    pendingInventoryGoldEq: pendingInventoryGoldEq(state, player.economy.pending),
    labor: player.turn.laborAvailable,
    influence: player.turn.influenceAvailable,
    storageCapacityGoldEq: storageCapacityGoldEq(state, player),
    combatPower: combatPower(player),
  };

  const score =
    weights.gold * breakdown.gold +
    weights.pendingGold * breakdown.pendingGold +
    weights.inventoryGoldEq * breakdown.inventoryGoldEq +
    weights.pendingInventoryGoldEq * breakdown.pendingInventoryGoldEq +
    weights.labor * breakdown.labor +
    weights.influence * breakdown.influence +
    weights.storageCapacityGoldEq * breakdown.storageCapacityGoldEq +
    weights.combatPower * breakdown.combatPower;

  return { ...breakdown, score };
}

export function formatNetWorthShort(b: NetWorthBreakdown): string {
  const r = (n: number) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);
  return `score=${r(b.score)} gold=${r(b.gold)} inv≈${r(b.inventoryGoldEq)} inf=${r(b.influence)} labor=${r(b.labor)} pending=${r(b.pendingGold)}`;
}
