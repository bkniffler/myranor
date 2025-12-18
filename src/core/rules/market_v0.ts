import type { MaterialTier, MarketState } from '../domain/types';
import { rollDice, type DiceRoll } from '../util/dice';
import type { Rng } from '../util/rng';

export type MarketModifierRoll = {
  roll: DiceRoll;
  sign: 1 | -1;
  tiers: MaterialTier[];
};

export type MarketSideRoll = {
  tableRoll: DiceRoll;
  categoryLabel: string;
  demandLabel: string;
  modifiers: Record<MaterialTier, number>;
  modifierRolls: MarketModifierRoll[];
  metaRolls: DiceRoll[];
};

function emptyMods(): Record<MaterialTier, number> {
  return { cheap: 0, basic: 0, expensive: 0 };
}

function applyRoll(
  mods: Record<MaterialTier, number>,
  modifierRolls: MarketModifierRoll[],
  tiers: MaterialTier[],
  sign: 1 | -1,
  roll: DiceRoll,
): void {
  modifierRolls.push({ roll, sign, tiers });
  for (const tier of tiers) {
    mods[tier] += sign * roll.total;
  }
}

function rollRawMarketSide(rng: Rng): MarketSideRoll {
  const tableRoll = rollDice('2d6', rng);
  const mods = emptyMods();
  const modifierRolls: MarketModifierRoll[] = [];
  const metaRolls: DiceRoll[] = [];

  const total = tableRoll.total;

  if (total === 2) {
    applyRoll(mods, modifierRolls, ['expensive'], 1, rollDice('2d6', rng));
    applyRoll(mods, modifierRolls, ['cheap', 'basic'], -1, rollDice('1d4', rng));
    return {
      tableRoll,
      categoryLabel: 'Teuerstes Rohmaterial',
      demandLabel: 'Begehrt',
      modifiers: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 3 || total === 4) {
    applyRoll(mods, modifierRolls, ['cheap'], 1, rollDice('1d4', rng));
    applyRoll(mods, modifierRolls, ['basic', 'expensive'], -1, rollDice('1d2', rng));
    return {
      tableRoll,
      categoryLabel: total === 3 ? 'Billiges Baumaterial' : 'Billiges Nahrungsmaterial',
      demandLabel: 'Sehr gefragt',
      modifiers: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 5) {
    applyRoll(mods, modifierRolls, ['cheap'], 1, rollDice('1d4', rng));
    return {
      tableRoll,
      categoryLabel: 'Billiges Verbrauchsgut',
      demandLabel: 'Sehr gefragt',
      modifiers: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 6) {
    applyRoll(mods, modifierRolls, ['cheap'], 1, rollDice('1d2', rng));
    return {
      tableRoll,
      categoryLabel: 'Billiges/Einfaches Material',
      demandLabel: 'Gefragt',
      modifiers: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 7) {
    return {
      tableRoll,
      categoryLabel: 'Alle Materialien',
      demandLabel: 'Normal',
      modifiers: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 8 || total === 9 || total === 10) {
    applyRoll(mods, modifierRolls, ['basic'], 1, rollDice('1d6', rng));
    return {
      tableRoll,
      categoryLabel:
        total === 8
          ? 'Einfaches Baumaterial'
          : total === 9
            ? 'Einfaches Nahrungsmaterial'
            : 'Einfaches Verbrauchsgut',
      demandLabel: 'Sehr gefragt',
      modifiers: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 11) {
    applyRoll(mods, modifierRolls, ['expensive'], 1, rollDice('1d8', rng));
    applyRoll(mods, modifierRolls, ['cheap', 'basic'], -1, rollDice('1d2', rng));
    return {
      tableRoll,
      categoryLabel: 'Teures Baumaterial',
      demandLabel: 'Gefragt',
      modifiers: mods,
      modifierRolls,
      metaRolls,
    };
  }

  // total === 12
  applyRoll(mods, modifierRolls, ['expensive'], -1, rollDice('1d8', rng));
  applyRoll(mods, modifierRolls, ['cheap'], 1, rollDice('1d6', rng));
  return {
    tableRoll,
    categoryLabel: 'Teures Material',
    demandLabel: 'Nicht gefragt',
    modifiers: mods,
    modifierRolls,
    metaRolls,
  };
}

function rollSpecialMarketSide(rng: Rng): MarketSideRoll {
  const tableRoll = rollDice('2d6', rng);
  const mods = emptyMods();
  const modifierRolls: MarketModifierRoll[] = [];
  const metaRolls: DiceRoll[] = [];

  const total = tableRoll.total;

  if (total === 2) {
    applyRoll(mods, modifierRolls, ['expensive'], 1, rollDice('2d8', rng));
    applyRoll(mods, modifierRolls, ['cheap', 'basic'], -1, rollDice('1d8', rng));
    return {
      tableRoll,
      categoryLabel: 'Teures Luxusgut',
      demandLabel: 'Begehrt',
      modifiers: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 3 || total === 4) {
    applyRoll(mods, modifierRolls, ['cheap'], 1, rollDice('1d4', rng));
    applyRoll(mods, modifierRolls, ['basic', 'expensive'], -1, rollDice('1d2', rng));
    return {
      tableRoll,
      categoryLabel: total === 3 ? 'Billiges Handwerksprodukt' : 'Billige Verbrauchsgüter',
      demandLabel: 'Sehr gefragt',
      modifiers: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 5 || total === 6) {
    applyRoll(mods, modifierRolls, ['cheap'], 1, rollDice('1d2', rng));
    return {
      tableRoll,
      categoryLabel: total === 5 ? 'Billige Nahrungsveredelung' : 'Billiges Sondermaterial',
      demandLabel: 'Gefragt',
      modifiers: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 7) {
    const direction = rollDice('1d6', rng);
    metaRolls.push(direction);
    const sign: 1 | -1 = direction.total <= 3 ? -1 : 1;
    applyRoll(mods, modifierRolls, ['cheap', 'basic', 'expensive'], sign, rollDice('1d2', rng));
    return {
      tableRoll,
      categoryLabel: 'Alle Sondermaterialien',
      demandLabel: 'Marktschwankung',
      modifiers: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 8) {
    applyRoll(mods, modifierRolls, ['basic'], 1, rollDice('1d6', rng));
    return {
      tableRoll,
      categoryLabel: 'Einfache Bauprodukte',
      demandLabel: 'Sehr gefragt',
      modifiers: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 9) {
    applyRoll(mods, modifierRolls, ['basic'], 1, rollDice('1d6', rng));
    applyRoll(mods, modifierRolls, ['cheap', 'expensive'], -1, rollDice('1d2', rng));
    return {
      tableRoll,
      categoryLabel: 'Einfache Handwerksprodukte',
      demandLabel: 'Sehr gefragt',
      modifiers: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 10) {
    applyRoll(mods, modifierRolls, ['expensive'], 1, rollDice('1d10', rng));
    return {
      tableRoll,
      categoryLabel: 'Teure Bauprodukte',
      demandLabel: 'Sehr gefragt',
      modifiers: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 11) {
    applyRoll(mods, modifierRolls, ['expensive'], 1, rollDice('2d6', rng));
    applyRoll(mods, modifierRolls, ['cheap', 'basic'], -1, rollDice('1d2', rng));
    return {
      tableRoll,
      categoryLabel: 'Teure Handwerksprodukte',
      demandLabel: 'Begehrt',
      modifiers: mods,
      modifierRolls,
      metaRolls,
    };
  }

  // total === 12
  const direction = rollDice('1d6', rng);
  metaRolls.push(direction);
  const sign: 1 | -1 = direction.total <= 2 ? -1 : 1;
  const magnitude = sign === -1 ? rollDice('2d6', rng) : rollDice('3d6', rng);
  applyRoll(mods, modifierRolls, ['expensive'], sign, magnitude);
  return {
    tableRoll,
    categoryLabel: 'Teures Luxusgut',
    demandLabel: 'Marktumschwung',
    modifiers: mods,
    modifierRolls,
    metaRolls,
  };
}

export type MarketRoll = {
  state: MarketState;
  raw: MarketSideRoll;
  special: MarketSideRoll;
};

export function rollMarket(round: number, rng: Rng): MarketRoll {
  const raw = rollRawMarketSide(rng);
  const special = rollSpecialMarketSide(rng);

  return {
    state: {
      round,
      raw: {
        tableRollTotal: raw.tableRoll.total,
        categoryLabel: raw.categoryLabel,
        demandLabel: raw.demandLabel,
        modifiers: raw.modifiers,
      },
      special: {
        tableRollTotal: special.tableRoll.total,
        categoryLabel: special.categoryLabel,
        demandLabel: special.demandLabel,
        modifiers: special.modifiers,
      },
    },
    raw,
    special,
  };
}

