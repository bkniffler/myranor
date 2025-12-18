import type { GlobalEventState } from '../domain/types';
import { rollDice, type DiceRoll } from '../util/dice';
import type { Rng } from '../util/rng';

import { EVENT_TABLE_V0 } from './eventTable_v0';

export type SectionEventRoll = {
  tableRoll: DiceRoll;
  name: string;
  effectsText: string;
};

export function rollSectionEvents(
  startsAtRound: number,
  rng: Rng,
  eventsPerSection = 2,
  durationRounds = 5,
): { startsAtRound: number; endsAtRound: number; events: SectionEventRoll[] } {
  const endsAtRound = startsAtRound + durationRounds - 1;

  const byRoll = new Map(EVENT_TABLE_V0.map((row) => [row.roll, row]));
  const chosenTotals = new Set<number>();
  const events: SectionEventRoll[] = [];

  while (events.length < eventsPerSection) {
    const tableRoll = rollDice('2d20', rng);
    const total = tableRoll.total;
    const row = byRoll.get(total);
    if (!row) continue;
    if (chosenTotals.has(total)) continue;
    chosenTotals.add(total);
    events.push({ tableRoll, name: row.name, effectsText: row.effectsText });
  }

  return { startsAtRound, endsAtRound, events };
}

export type CampaignEventModifiers = {
  taxGoldPerRound: number;
  oneTimeGoldTaxPerOffice: number;
  officeGoldIncomeMultiplier: number;
  officeGoldIncomeBonusPerOffice: number;
  lendMoneyDcBonus: number;
  sellMaterialsDcBonus: number;
  influenceActionDcBonus: number;
  workshopUpkeepLaborBonusFlat: number;
  workshopUpkeepGoldBonusFlat: number;
  workshopUpkeepGoldBonusPerTier: number;
  rawAutoConvertDivisor: number;
  lendMoneyPayoutMultiplier: number;
  moneyBonusGoldPerTwoInvestments: number;
};

export function computeCampaignEventModifiers(events: GlobalEventState[]): CampaignEventModifiers {
  const mods: CampaignEventModifiers = {
    taxGoldPerRound: 0,
    oneTimeGoldTaxPerOffice: 0,
    officeGoldIncomeMultiplier: 1,
    officeGoldIncomeBonusPerOffice: 0,
    lendMoneyDcBonus: 0,
    sellMaterialsDcBonus: 0,
    influenceActionDcBonus: 0,
    workshopUpkeepLaborBonusFlat: 0,
    workshopUpkeepGoldBonusFlat: 0,
    workshopUpkeepGoldBonusPerTier: 0,
    rawAutoConvertDivisor: 4,
    lendMoneyPayoutMultiplier: 1,
    moneyBonusGoldPerTwoInvestments: 0,
  };

  const clampDivisor = (d: number) => Math.max(1, Math.trunc(d));

  for (const e of events) {
    const t = e.effectsText;

    // Taxes
    const taxMatch = /Sonderabgabe von\\s*(\\d+)\\s*Gold\\s*f[üu]r alle Spieler pro Runde/i.exec(t);
    if (taxMatch) mods.taxGoldPerRound += Number.parseInt(taxMatch[1] ?? '0', 10);

    const oneTimeOfficeTax = /Einmal-Abgabe von\\s*(\\d+)\\s*Gold\\s*pro kleinem Amt/i.exec(t);
    if (oneTimeOfficeTax) mods.oneTimeGoldTaxPerOffice += Number.parseInt(oneTimeOfficeTax[1] ?? '0', 10);

    // Office income
    if (/Hälfte des Gold-Amtseinkommen/i.test(t)) {
      mods.officeGoldIncomeMultiplier *= 0.5;
    }
    const officeBonus = /\\*Alle Ämter\\*?:\\s*\\+(\\d+)\\s*Gold per Runde und Stufe/i.exec(t);
    if (officeBonus) mods.officeGoldIncomeBonusPerOffice += Number.parseInt(officeBonus[1] ?? '0', 10);

    // DC modifiers
    const lendDc = /Geldverleih\\*?:\\s*DC\\s*steigt\\s*um\\s*(\\d+)/i.exec(t);
    if (lendDc) mods.lendMoneyDcBonus += Number.parseInt(lendDc[1] ?? '0', 10);

    const lendSellDc = /Geldverleih\\s+und\\s+Verkauf\\*?:\\s*DC\\s*steigt\\s*um\\s*(\\d+)/i.exec(t);
    if (lendSellDc) {
      const v = Number.parseInt(lendSellDc[1] ?? '0', 10);
      mods.lendMoneyDcBonus += v;
      mods.sellMaterialsDcBonus += v;
    }

    const sellDcPlus = /Geldgewinn:\\s*Verkauf\\*?:\\s*(?:DC\\s*)?\\+\\s*(\\d+)/i.exec(t);
    if (sellDcPlus) mods.sellMaterialsDcBonus += Number.parseInt(sellDcPlus[1] ?? '0', 10);
    const sellDcPlusAlt = /Geldgewinn:\\s*Verkauf\\*?:\\s*\\+(\\d+)\\s*DC/i.exec(t);
    if (sellDcPlusAlt) mods.sellMaterialsDcBonus += Number.parseInt(sellDcPlusAlt[1] ?? '0', 10);

    const influenceDc1 = /Einflussgewinnaktionen\\*?:\\s*DC\\s*-\\s*(\\d+)/i.exec(t);
    if (influenceDc1) mods.influenceActionDcBonus -= Number.parseInt(influenceDc1[1] ?? '0', 10);
    const influenceDc2 = /Einflussgewinn-?Aktion\\*?:\\s*-\\s*(\\d+)\\s*DC/i.exec(t);
    if (influenceDc2) mods.influenceActionDcBonus -= Number.parseInt(influenceDc2[1] ?? '0', 10);

    // Workshop upkeep modifiers
    const workLabor = /Unterhalt aller Werkst[aä]tten\\s*\\+(\\d+)\\s*AK/i.exec(t);
    if (workLabor) mods.workshopUpkeepLaborBonusFlat += Number.parseInt(workLabor[1] ?? '0', 10);

    const workGold = /Unterhalt aller Werkst[aä]tten\\s*\\+(\\d+)\\s*Gold/i.exec(t);
    if (workGold) mods.workshopUpkeepGoldBonusFlat += Number.parseInt(workGold[1] ?? '0', 10);

    const workGoldPerWorkshop = /\\+\\s*(\\d+)\\s*Gold\\s*Unterhalt\\s*per Werkst[aä]tte/i.exec(t);
    if (workGoldPerWorkshop) mods.workshopUpkeepGoldBonusFlat += Number.parseInt(workGoldPerWorkshop[1] ?? '0', 10);

    const workGoldPerTier = /Werkstattunterhalt\\*?:\\s*\\+(\\d+)\\s*Gold per Stufe/i.exec(t);
    if (workGoldPerTier) mods.workshopUpkeepGoldBonusPerTier += Number.parseInt(workGoldPerTier[1] ?? '0', 10);

    // Conversion ratio tweaks
    const ratio = /Verh[äa]ltnis\\s*(\\d+):1\\s*\\(statt\\s*(\\d+):1\\)/i.exec(t);
    if (ratio) {
      const d = Number.parseInt(ratio[1] ?? '4', 10);
      mods.rawAutoConvertDivisor = Math.min(mods.rawAutoConvertDivisor, clampDivisor(d));
    }

    // Money action payout tweaks
    if (/Ertr[äa]ge aus Geldverleih halbiert/i.test(t)) {
      mods.lendMoneyPayoutMultiplier *= 0.5;
    }

    const perTwo = /Alle\\s*2\\s*Investitionen\\s*erzielen\\s*\\+(\\d+)\\s*Gold/i.exec(t);
    if (perTwo) mods.moneyBonusGoldPerTwoInvestments += Number.parseInt(perTwo[1] ?? '0', 10);
  }

  return mods;
}

