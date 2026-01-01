import { type DiceRoll, rollDice } from '../util/dice';
import type { Rng } from '../util/rng';
import { EVENT_TABLE_V1 } from './eventTable_v1';

export type RolledSectionEvent = {
  tableRoll: DiceRoll;
  name: string;
  effectsText: string;
  meta?: Record<string, unknown>;
};

export type RolledSectionEvents = {
  startsAtRound: number;
  endsAtRound: number;
  events: RolledSectionEvent[];
};

export function isSectionStartRound(round: number): boolean {
  // Soll: Ereignis-Abschnitte starten ab Runde 2 und dauern 4 Runden (R2–R5, R6–R9, ...).
  return round >= 2 && (round - 2) % 4 === 0;
}

function findRow(total: number) {
  const row = EVENT_TABLE_V1.find((r) => r.roll === total);
  if (!row) throw new Error(`Event table missing roll ${total}`);
  return row;
}

export function rollSectionEvents(
  startsAtRound: number,
  rng: Rng
): RolledSectionEvents {
  const endsAtRound = startsAtRound + 3;

  const withMeta = (
    tableTotal: number
  ): Record<string, unknown> | undefined => {
    const meta: Record<string, unknown> = {};

    // "Aufruhr in Denera" conditional triggers (stored once for the whole section)
    const deneraThreshold = tableTotal === 30 || tableTotal === 35 ? 5 : 10;
    const hasDeneraClause = new Set([2, 5, 14, 18, 20, 23, 26, 28, 30, 35]).has(
      tableTotal
    );
    if (hasDeneraClause) {
      const roll = rollDice('1d20', rng);
      meta.deneraRiotRoll = roll;
      meta.deneraRiotThreshold = deneraThreshold;
      meta.deneraRiotTriggered = roll.total <= deneraThreshold;
    }

    // Event 16: determine raiders vs pirates
    if (tableTotal === 16) {
      const roll = rollDice('1d20', rng);
      meta.raidersOrPiratesRoll = roll;
      meta.raidersOrPirates = roll.total <= 10 ? 'raiders' : 'pirates';
    }

    // Deterministic market deltas (rolled once per section)
    if (tableTotal === 2) meta.marketFoodSaleBonus = rollDice('2d6', rng);
    if (tableTotal === 3) meta.marketMedicineSaleBonus = rollDice('1d8', rng);
    if (tableTotal === 4)
      meta.marketWeaponsArmorSaleBonus = rollDice('1d6', rng);
    if (tableTotal === 5)
      meta.marketWeaponsArmorSaleBonus = rollDice('1d4', rng);
    if (tableTotal === 8) meta.marketFoodSaleBonus = rollDice('1d4', rng);
    if (tableTotal === 9) {
      meta.marketBuildingCheapBasicBonus = rollDice('1d4', rng);
      meta.marketBuildingExpensiveBonus = rollDice('1d6', rng);
    }
    if (tableTotal === 10)
      meta.marketExpensiveAllPenalty = rollDice('1d4', rng);
    if (tableTotal === 14)
      meta.marketMagicParaphernaliaSaleBonus = rollDice('1d6', rng);
    if (tableTotal === 15) meta.marketWoodFishSaleBonus = rollDice('1d4', rng);
    if (tableTotal === 19)
      meta.marketExpensiveSpecialPenalty = rollDice('1d6', rng);
    if (tableTotal === 20) meta.marketAlchemySaleBonus = rollDice('1d6', rng);
    if (tableTotal === 21) meta.marketMetalPenalty = rollDice('1d4', rng);
    if (tableTotal === 25) meta.marketFoodArmorSaleBonus = rollDice('1d4', rng);
    if (tableTotal === 30) meta.marketBuildingSaleBonus = rollDice('1d4', rng);
    if (tableTotal === 31) meta.marketLuxurySaleBonus = rollDice('1d4', rng);
    if (tableTotal === 33)
      meta.marketExpensiveSpecialPenalty = rollDice('1d4', rng);
    if (tableTotal === 35)
      meta.marketExpensiveSpecialBonus = rollDice('2d6', rng);
    if (tableTotal === 36) meta.marketBuildingSaleBonus = rollDice('2d4', rng);
    if (tableTotal === 40) meta.marketFoodPenalty = rollDice('1d4', rng);

    // Event 34: "Bei 1-10 ..." triggers (rolled once per section for determinism)
    if (tableTotal === 34) {
      const magicSpecial = rollDice('1d20', rng);
      const magicLabor = rollDice('1d20', rng);
      meta.achaerMagicSpecialRoll = magicSpecial;
      meta.achaerMagicSpecialTriggered = magicSpecial.total <= 10;
      meta.achaerMagicLaborRoll = magicLabor;
      meta.achaerMagicLaborTriggered = magicLabor.total <= 10;
    }

    // Events 14/19: "Chance auf magisches Artefakt zum Verkauf (1-5 auf w20)".
    // We roll this once per section for determinism and expose it via event meta.
    if (tableTotal === 14 || tableTotal === 19) {
      const roll = rollDice('1d20', rng);
      meta.artifactForSaleRoll = roll;
      meta.artifactForSaleThreshold = 5;
      meta.artifactForSaleTriggered = roll.total <= 5;
    }

    // Event 38: "Bei 1-5 auf w20" for cult windfall (rolled once per section)
    if (tableTotal === 38) {
      const roll = rollDice('1d20', rng);
      meta.greatWonderCultRoll = roll;
      meta.greatWonderCultThreshold = 5;
      meta.greatWonderCultTriggered = roll.total <= 5;
    }

    return Object.keys(meta).length ? meta : undefined;
  };

  const chosenTotals = new Set<number>();
  const events: RolledSectionEvent[] = [];
  while (events.length < 2) {
    const roll = rollDice('2d20', rng);
    if (chosenTotals.has(roll.total)) continue;
    chosenTotals.add(roll.total);
    const row = findRow(roll.total);
    events.push({
      tableRoll: roll,
      name: row.name,
      effectsText: row.effectsText,
      meta: withMeta(roll.total),
    });
  }

  // "Aufruhr in Denera" clause on other events can add Event 27 as an additional section event.
  // We materialize it as a third event so downstream logic can treat it like a normal active event.
  {
    const hasExplicit27 = chosenTotals.has(27);
    const triggeredBy = events
      .map((e) => ({ rollTotal: e.tableRoll.total, meta: e.meta }))
      .filter((e) => (e.meta as any)?.deneraRiotTriggered === true)
      .map((e) => e.rollTotal);

    if (!hasExplicit27 && triggeredBy.length > 0) {
      const row27 = findRow(27);
      events.push({
        tableRoll: { expression: 'denera-trigger', rolls: [], total: 27 },
        name: row27.name,
        effectsText: row27.effectsText,
        meta: { triggeredBy },
      });
    }
  }

  return { startsAtRound, endsAtRound, events };
}
