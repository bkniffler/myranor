import type { GlobalEventState } from '../domain/types';
import { getMaterialOrThrow } from './materials_v1';

export type WorkshopUpkeepMods = {
  laborFlat: number;
  goldFlat: number;
  goldPerTier: number;
};

export type OfficeIncomeMods = {
  goldMultiplier: number;
  goldBonusPerTier: number;
};

export type MoneyActionMods = {
  lendDc: number;
  sellDc: number;
  influenceDc: number;
  bonusGoldPerTwoInvestments: number;
};

export function activeEventsForRound(
  events: GlobalEventState[],
  round: number
): GlobalEventState[] {
  return events.filter(
    (e) => round >= e.startsAtRound && round <= e.endsAtRound
  );
}

export function workshopUpkeepMods(
  events: GlobalEventState[],
  round: number
): WorkshopUpkeepMods {
  const mods: WorkshopUpkeepMods = {
    laborFlat: 0,
    goldFlat: 0,
    goldPerTier: 0,
  };
  for (const e of activeEventsForRound(events, round)) {
    switch (e.tableRollTotal) {
      case 3:
        mods.laborFlat += 1;
        break;
      case 9:
        mods.goldFlat += 1;
        break;
      case 20:
        mods.goldFlat += 1;
        break;
      case 27:
        mods.goldPerTier += 1;
        break;
    }
  }
  return mods;
}

export function officeIncomeMods(
  events: GlobalEventState[],
  round: number
): OfficeIncomeMods {
  const mods: OfficeIncomeMods = { goldMultiplier: 1, goldBonusPerTier: 0 };
  for (const e of activeEventsForRound(events, round)) {
    switch (e.tableRollTotal) {
      case 7:
        mods.goldMultiplier *= 0.5;
        break;
      case 23:
        mods.goldBonusPerTier += 2;
        break;
    }
  }
  return mods;
}

export function taxGoldPerRound(
  events: GlobalEventState[],
  round: number
): number {
  let tax = 0;
  for (const e of activeEventsForRound(events, round)) {
    if (e.tableRollTotal === 4) tax += 5;
  }
  return tax;
}

export function moneyActionMods(
  events: GlobalEventState[],
  round: number
): MoneyActionMods {
  const mods: MoneyActionMods = {
    lendDc: 0,
    sellDc: 0,
    influenceDc: 0,
    bonusGoldPerTwoInvestments: 0,
  };

  for (const e of activeEventsForRound(events, round)) {
    switch (e.tableRollTotal) {
      case 7:
        mods.lendDc += 4;
        break;
      case 10:
        mods.lendDc += 2;
        mods.sellDc += 2;
        break;
      case 12:
        mods.influenceDc -= 2;
        break;
      case 15:
        mods.sellDc += 1;
        break;
      case 16:
        mods.sellDc += 2;
        break;
      case 31:
        mods.bonusGoldPerTwoInvestments += 1;
        break;
      case 39:
        mods.influenceDc -= 4;
        break;
    }
  }

  return mods;
}

export function rawAutoConvertDivisor(
  materialId: string,
  events: GlobalEventState[],
  round: number
): number {
  const material = getMaterialOrThrow(materialId);
  if (material.kind !== 'raw') return 4;
  const active = activeEventsForRound(events, round);
  const hunger = active.some((e) => e.tableRollTotal === 2);
  if (hunger && material.tags.includes('food')) return 3;
  return 4;
}

export function marketDeltaPerInvestment(
  materialId: string,
  events: GlobalEventState[],
  round: number
): number {
  const material = getMaterialOrThrow(materialId);
  let delta = 0;

  const add = (value: unknown, sign = 1) => {
    const rollTotal = (value as any)?.total;
    if (typeof rollTotal === 'number') delta += sign * rollTotal;
    else if (typeof value === 'number') delta += sign * value;
  };

  for (const e of activeEventsForRound(events, round)) {
    const meta = (e.meta ?? {}) as Record<string, unknown>;
    switch (e.tableRollTotal) {
      case 10: {
        // Alle teuren Ressourcen -1d4 Gold Marktwert.
        if (material.tier === 'expensive')
          add(meta.marketExpensiveAllPenalty, -1);
        break;
      }
      case 11: {
        // Nahrungsmittelpreise -1 Gold Marktwert.
        if (material.tags.includes('food')) delta -= 1;
        break;
      }
      case 17: {
        // Alle teuren SM +2 Gold Marktwert.
        if (material.kind === 'special' && material.tier === 'expensive')
          delta += 2;
        break;
      }
      case 19: {
        // Alle teuren SM -1d6 Gold Marktwert.
        if (material.kind === 'special' && material.tier === 'expensive')
          add(meta.marketExpensiveSpecialPenalty, -1);
        break;
      }
      case 21: {
        // Metallische Rohstoffe -1d4 Gold Marktwert.
        if (material.kind === 'raw' && material.tags.includes('metal'))
          add(meta.marketMetalPenalty, -1);
        break;
      }
      case 33: {
        // Teure SM -1d4 Marktwert
        if (material.kind === 'special' && material.tier === 'expensive')
          add(meta.marketExpensiveSpecialPenalty, -1);
        break;
      }
      case 35: {
        // Teure SM +2d6 Gold Marktwert.
        if (material.kind === 'special' && material.tier === 'expensive')
          add(meta.marketExpensiveSpecialBonus, 1);
        break;
      }
      case 40: {
        // Nahrungsmittelpreise -1d4 Gold Marktwert.
        if (material.tags.includes('food')) add(meta.marketFoodPenalty, -1);
        break;
      }
    }
  }

  return delta;
}

export function saleBonusGoldForAction(
  soldMaterialIds: string[],
  events: GlobalEventState[],
  round: number
): number {
  // These are event-provided “extra value” bonuses that are not obviously tied to market demand tables.
  // For now, treat them as a single flat bonus per sale action if any sold item matches.
  const sold = soldMaterialIds.map((id) => getMaterialOrThrow(id));
  const any = (pred: (m: ReturnType<typeof getMaterialOrThrow>) => boolean) =>
    sold.some(pred);

  let bonus = 0;
  for (const e of activeEventsForRound(events, round)) {
    const meta = (e.meta ?? {}) as Record<string, unknown>;
    switch (e.tableRollTotal) {
      case 3:
        if (any((m) => m.tags.includes('medicine'))) {
          const roll = (meta.marketMedicineSaleBonus as any)?.total;
          if (typeof roll === 'number') bonus += roll;
        }
        break;
      case 2:
      case 8:
        if (any((m) => m.tags.includes('food'))) {
          const roll = (meta.marketFoodSaleBonus as any)?.total;
          if (typeof roll === 'number') bonus += roll;
        }
        break;
      case 4:
      case 5:
        if (any((m) => m.tags.includes('weapon') || m.tags.includes('armor'))) {
          const roll = (meta.marketWeaponsArmorSaleBonus as any)?.total;
          if (typeof roll === 'number') bonus += roll;
        }
        break;
      case 14:
        if (any((m) => m.tags.includes('magic'))) {
          const roll = (meta.marketMagicParaphernaliaSaleBonus as any)?.total;
          if (typeof roll === 'number') bonus += roll;
        }
        break;
      case 20:
        if (any((m) => m.tags.includes('alchemy'))) {
          const roll = (meta.marketAlchemySaleBonus as any)?.total;
          if (typeof roll === 'number') bonus += roll;
        }
        break;
      case 9:
        if (any((m) => m.tags.includes('building'))) {
          const hasCheapOrBasic = any(
            (m) => m.tags.includes('building') && m.tier !== 'expensive'
          );
          const hasExpensive = any(
            (m) => m.tags.includes('building') && m.tier === 'expensive'
          );
          const cheapBasic = (meta.marketBuildingCheapBasicBonus as any)?.total;
          const expensive = (meta.marketBuildingExpensiveBonus as any)?.total;
          if (hasCheapOrBasic && typeof cheapBasic === 'number')
            bonus += cheapBasic;
          if (hasExpensive && typeof expensive === 'number') bonus += expensive;
        }
        break;
      case 15:
        if (
          soldMaterialIds.includes('raw.wood') ||
          soldMaterialIds.includes('raw.fish')
        ) {
          const roll = (meta.marketWoodFishSaleBonus as any)?.total;
          if (typeof roll === 'number') bonus += roll;
        }
        break;
      case 25:
        if (any((m) => m.tags.includes('food') || m.tags.includes('armor'))) {
          const roll = (meta.marketFoodArmorSaleBonus as any)?.total;
          if (typeof roll === 'number') bonus += roll;
        }
        break;
      case 30:
      case 36:
        if (any((m) => m.tags.includes('building'))) {
          const roll = (meta.marketBuildingSaleBonus as any)?.total;
          if (typeof roll === 'number') bonus += roll;
        }
        break;
      case 31:
        if (any((m) => m.tags.includes('luxury'))) {
          const roll = (meta.marketLuxurySaleBonus as any)?.total;
          if (typeof roll === 'number') bonus += roll;
        }
        break;
    }
  }

  return bonus;
}
