import type {
  MarketSideState,
  MarketState,
  RawMarketGroup,
  SpecialMarketGroup,
} from '../domain/types';
import { type DiceRoll, rollDice } from '../util/dice';
import type { Rng } from '../util/rng';

export type MarketSideRoll = {
  tableRoll: DiceRoll;
  categoryLabel: string;
  demandLabel: string;
  modifiersByGroup: Record<string, number>;
  modifierRolls: Array<{ roll: DiceRoll; note: string }>;
  metaRolls: DiceRoll[];
};

export type MarketInstanceRoll = {
  id: string;
  label: string;
  ownerPlayerId?: string;
  raw: MarketSideRoll;
  special: MarketSideRoll;
};

export type MarketRoll = {
  round: number;
  instances: MarketInstanceRoll[];
};

export function isMarketSectionStartRound(round: number): boolean {
  // Soll: Markt-Abschnitte dauern 4 Runden (R1–R4, R5–R8, ...).
  return (round - 1) % 4 === 0;
}

function emptyRawMods(): Record<RawMarketGroup, number> {
  return {
    rawCheapBuilding: 0,
    rawCheapFood: 0,
    rawCheapConsumable: 0,
    rawCheapOther: 0,
    rawBasicBuilding: 0,
    rawBasicFood: 0,
    rawBasicConsumable: 0,
    rawBasicOther: 0,
    rawExpensiveBuilding: 0,
    rawExpensiveOther: 0,
  };
}

function emptySpecialMods(): Record<SpecialMarketGroup, number> {
  return {
    specialCheapCraft: 0,
    specialCheapConsumable: 0,
    specialCheapFood: 0,
    specialCheapOther: 0,
    specialBasicBuilding: 0,
    specialBasicCraft: 0,
    specialBasicOther: 0,
    specialExpensiveBuilding: 0,
    specialExpensiveCraft: 0,
    specialExpensiveLuxury: 0,
    specialExpensiveOther: 0,
  };
}

function addMods(
  mods: Record<string, number>,
  keys: string[],
  delta: number
): void {
  for (const k of keys) mods[k] = (mods[k] ?? 0) + delta;
}

function addAllExcept(
  mods: Record<string, number>,
  excluded: string[],
  delta: number
): void {
  const exclude = new Set(excluded);
  for (const k of Object.keys(mods)) {
    if (exclude.has(k)) continue;
    mods[k] = (mods[k] ?? 0) + delta;
  }
}

function rollRawSide(rng: Rng): MarketSideRoll {
  const tableRoll = rollDice('2d6', rng);
  const modifierRolls: Array<{ roll: DiceRoll; note: string }> = [];
  const metaRolls: DiceRoll[] = [];
  const mods = emptyRawMods();

  const total = tableRoll.total;

  if (total === 2) {
    const bonus = rollDice('2d6', rng);
    const penalty = rollDice('1d4', rng);
    modifierRolls.push({ roll: bonus, note: 'Teure RM +bonus' });
    modifierRolls.push({ roll: penalty, note: 'Andere -penalty' });
    addMods(mods, ['rawExpensiveBuilding', 'rawExpensiveOther'], bonus.total);
    addAllExcept(
      mods,
      ['rawExpensiveBuilding', 'rawExpensiveOther'],
      -penalty.total
    );
    return {
      tableRoll,
      categoryLabel: 'Teuerstes Rohmaterial',
      demandLabel: 'Begehrt',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 3 || total === 4) {
    const bonus = rollDice('1d4', rng);
    const penalty = rollDice('1d2', rng);
    modifierRolls.push({ roll: bonus, note: 'Gefragte Kategorie +bonus' });
    modifierRolls.push({ roll: penalty, note: 'Andere -penalty' });
    const demanded: RawMarketGroup =
      total === 3 ? 'rawCheapBuilding' : 'rawCheapFood';
    mods[demanded] += bonus.total;
    addAllExcept(mods, [demanded], -penalty.total);
    return {
      tableRoll,
      categoryLabel:
        total === 3 ? 'Billiges Baumaterial' : 'Billiges Nahrungsmaterial',
      demandLabel: 'Sehr gefragt',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 5) {
    const bonus = rollDice('1d4', rng);
    modifierRolls.push({ roll: bonus, note: 'Billige Verbrauchsgüter +bonus' });
    mods.rawCheapConsumable += bonus.total;
    return {
      tableRoll,
      categoryLabel: 'Billiges Verbrauchsgut',
      demandLabel: 'Sehr gefragt',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 6) {
    const bonus = rollDice('1d2', rng);
    modifierRolls.push({ roll: bonus, note: 'Billig/Einfach +bonus' });
    addMods(
      mods,
      [
        'rawCheapBuilding',
        'rawCheapFood',
        'rawCheapConsumable',
        'rawCheapOther',
        'rawBasicBuilding',
        'rawBasicFood',
        'rawBasicConsumable',
        'rawBasicOther',
      ],
      bonus.total
    );
    return {
      tableRoll,
      categoryLabel: 'Billiges/Einfaches Material',
      demandLabel: 'Gefragt',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 7) {
    return {
      tableRoll,
      categoryLabel: 'Alle Materialien',
      demandLabel: 'Normal',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 8 || total === 9 || total === 10) {
    const bonus = rollDice('1d6', rng);
    modifierRolls.push({ roll: bonus, note: 'Einfache Kategorie +bonus' });
    const demanded: RawMarketGroup =
      total === 8
        ? 'rawBasicBuilding'
        : total === 9
          ? 'rawBasicFood'
          : 'rawBasicConsumable';
    mods[demanded] += bonus.total;
    return {
      tableRoll,
      categoryLabel:
        total === 8
          ? 'Einfaches Baumaterial'
          : total === 9
            ? 'Einfaches Nahrungsmaterial'
            : 'Einfaches Verbrauchsgut',
      demandLabel: 'Sehr gefragt',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 11) {
    const bonus = rollDice('1d8', rng);
    const penalty = rollDice('1d2', rng);
    modifierRolls.push({ roll: bonus, note: 'Teures Baumaterial +bonus' });
    modifierRolls.push({ roll: penalty, note: 'Andere -penalty' });
    mods.rawExpensiveBuilding += bonus.total;
    addAllExcept(mods, ['rawExpensiveBuilding'], -penalty.total);
    return {
      tableRoll,
      categoryLabel: 'Teures Baumaterial',
      demandLabel: 'Gefragt',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }

  // total === 12
  {
    const expensivePenalty = rollDice('1d8', rng);
    const cheapBonus = rollDice('1d6', rng);
    modifierRolls.push({
      roll: expensivePenalty,
      note: 'Teures Material -penalty',
    });
    modifierRolls.push({ roll: cheapBonus, note: 'Billiges Material +bonus' });
    addMods(
      mods,
      ['rawExpensiveBuilding', 'rawExpensiveOther'],
      -expensivePenalty.total
    );
    addMods(
      mods,
      [
        'rawCheapBuilding',
        'rawCheapFood',
        'rawCheapConsumable',
        'rawCheapOther',
      ],
      cheapBonus.total
    );
    return {
      tableRoll,
      categoryLabel: 'Teures Material',
      demandLabel: 'Nicht gefragt',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }
}

function rollSpecialSide(rng: Rng): MarketSideRoll {
  const tableRoll = rollDice('2d6', rng);
  const modifierRolls: Array<{ roll: DiceRoll; note: string }> = [];
  const metaRolls: DiceRoll[] = [];
  const mods = emptySpecialMods();
  const total = tableRoll.total;

  if (total === 2) {
    const bonus = rollDice('2d8', rng);
    const penalty = rollDice('1d8', rng);
    modifierRolls.push({ roll: bonus, note: 'Teures Luxusgut +bonus' });
    modifierRolls.push({ roll: penalty, note: 'Andere -penalty' });
    mods.specialExpensiveLuxury += bonus.total;
    addAllExcept(mods, ['specialExpensiveLuxury'], -penalty.total);
    return {
      tableRoll,
      categoryLabel: 'Teures Luxusgut',
      demandLabel: 'Begehrt',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 3 || total === 4) {
    const bonus = rollDice('1d4', rng);
    const penalty = rollDice('1d2', rng);
    modifierRolls.push({ roll: bonus, note: 'Gefragte Kategorie +bonus' });
    modifierRolls.push({ roll: penalty, note: 'Andere -penalty' });
    const demanded: SpecialMarketGroup =
      total === 3 ? 'specialCheapCraft' : 'specialCheapConsumable';
    mods[demanded] += bonus.total;
    addAllExcept(mods, [demanded], -penalty.total);
    return {
      tableRoll,
      categoryLabel:
        total === 3 ? 'Billiges Handwerksprodukt' : 'Billige Verbrauchsgüter',
      demandLabel: 'Sehr gefragt',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 5 || total === 6) {
    const bonus = rollDice('1d2', rng);
    modifierRolls.push({ roll: bonus, note: 'Gefragte Kategorie +bonus' });
    const demanded: SpecialMarketGroup =
      total === 5 ? 'specialCheapFood' : 'specialCheapOther';
    mods[demanded] += bonus.total;
    return {
      tableRoll,
      categoryLabel:
        total === 5 ? 'Billige Nahrungsveredelung' : 'Billiges Sondermaterial',
      demandLabel: 'Gefragt',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 7) {
    const direction = rollDice('1d6', rng);
    metaRolls.push(direction);
    const sign = direction.total <= 3 ? -1 : 1;
    const magnitude = rollDice('1d2', rng);
    modifierRolls.push({
      roll: magnitude,
      note: `Alle Sondermaterialien ${sign === -1 ? '-' : '+'}1d2`,
    });
    addMods(mods, Object.keys(mods), sign * magnitude.total);
    return {
      tableRoll,
      categoryLabel: 'Alle Sondermaterialien',
      demandLabel: 'Marktschwankung',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 8) {
    const bonus = rollDice('1d6', rng);
    modifierRolls.push({ roll: bonus, note: 'Einfache Bauprodukte +bonus' });
    mods.specialBasicBuilding += bonus.total;
    return {
      tableRoll,
      categoryLabel: 'Einfache Bauprodukte',
      demandLabel: 'Sehr gefragt',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 9) {
    const bonus = rollDice('1d6', rng);
    const penalty = rollDice('1d2', rng);
    modifierRolls.push({
      roll: bonus,
      note: 'Einfache Handwerksprodukte +bonus',
    });
    modifierRolls.push({ roll: penalty, note: 'Andere -penalty' });
    mods.specialBasicCraft += bonus.total;
    addAllExcept(mods, ['specialBasicCraft'], -penalty.total);
    return {
      tableRoll,
      categoryLabel: 'Einfache Handwerksprodukte',
      demandLabel: 'Sehr gefragt',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 10) {
    const bonus = rollDice('1d10', rng);
    modifierRolls.push({ roll: bonus, note: 'Teure Bauprodukte +bonus' });
    mods.specialExpensiveBuilding += bonus.total;
    return {
      tableRoll,
      categoryLabel: 'Teure Bauprodukte',
      demandLabel: 'Sehr gefragt',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }

  if (total === 11) {
    const bonus = rollDice('2d6', rng);
    const penalty = rollDice('1d2', rng);
    modifierRolls.push({ roll: bonus, note: 'Teure Handwerksprodukte +bonus' });
    modifierRolls.push({ roll: penalty, note: 'Andere -penalty' });
    mods.specialExpensiveCraft += bonus.total;
    addAllExcept(mods, ['specialExpensiveCraft'], -penalty.total);
    return {
      tableRoll,
      categoryLabel: 'Teure Handwerksprodukte',
      demandLabel: 'Begehrt',
      modifiersByGroup: mods,
      modifierRolls,
      metaRolls,
    };
  }

  // total === 12
  const direction = rollDice('1d6', rng);
  metaRolls.push(direction);
  const sign = direction.total <= 2 ? -1 : 1;
  const magnitude = sign === -1 ? rollDice('2d6', rng) : rollDice('3d6', rng);
  modifierRolls.push({
    roll: magnitude,
    note: `Luxusgut ${sign === -1 ? '-' : '+'}${sign === -1 ? '2d6' : '3d6'}`,
  });
  mods.specialExpensiveLuxury += sign * magnitude.total;
  return {
    tableRoll,
    categoryLabel: 'Teures Luxusgut',
    demandLabel: 'Marktumschwung',
    modifiersByGroup: mods,
    modifierRolls,
    metaRolls,
  };
}

export function rollMarketInstances(
  round: number,
  instances: Array<{ id: string; label: string; ownerPlayerId?: string }>,
  rng: Rng
): MarketRoll {
  return {
    round,
    instances: instances.map((inst) => ({
      id: inst.id,
      label: inst.label,
      ownerPlayerId: inst.ownerPlayerId,
      raw: rollRawSide(rng),
      special: rollSpecialSide(rng),
    })),
  };
}

export function marketStateFromRoll(roll: MarketRoll): MarketState {
  const toSideState = (side: MarketSideRoll): MarketSideState => ({
    tableRollTotal: side.tableRoll.total,
    categoryLabel: side.categoryLabel,
    demandLabel: side.demandLabel,
    modifiersByGroup: side.modifiersByGroup,
  });
  return {
    round: roll.round,
    instances: roll.instances.map((i) => ({
      id: i.id,
      label: i.label,
      ownerPlayerId: i.ownerPlayerId as any,
      raw: toSideState(i.raw),
      special: toSideState(i.special),
    })),
  };
}
