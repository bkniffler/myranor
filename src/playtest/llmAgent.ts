import { type LanguageModel, Output, generateText } from 'ai';
import { z } from 'zod';

import type { GameCommand, PlayerState } from '../core';
import { getMaterialOrThrow } from '../core/rules/materials_v1';

import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { llmEnv } from '../llm/env';
import {
  bonusMaterialsSlots,
  bonusMoneySlots,
  hasRemainingInfluenceBonus,
  hasUsedCanonicalAction,
  hasUsedMarker,
  remainingInfluenceBonusSlots,
} from './turnRules';
import type { StrategyCard } from './types';

export type AgentCommand = GameCommand;

type Candidate = {
  id: string;
  kind: 'facility' | 'action';
  command: AgentCommand;
  actionKey: string | null;
  possibleNow: boolean;
  summary: string;
};

export type LlmFacilityPlan = {
  facility: AgentCommand | null;
  note: string | null;
  debug?: {
    facilityCandidates: Candidate[];
    rawModelOutput: unknown;
  };
};

export type LlmActionPlan = {
  action: AgentCommand | null;
  note: string | null;
  debug?: {
    actionCandidates: Candidate[];
    rawModelOutput: unknown;
  };
};

const facilityDecisionSchema = z.object({
  facilityCandidateId: z.string().nullable(),
  note: z.string().optional(),
});

const actionDecisionSchema = z.object({
  actionCandidateId: z.string(),
  note: z.string().optional(),
});

function sumStock(stock: Record<string, number>): number {
  let sum = 0;
  for (const v of Object.values(stock)) sum += v;
  return sum;
}

function formatStockSummary(
  stock: Record<string, number>,
  limit = 6
): string {
  const entries = Object.entries(stock)
    .filter(([, count]) => (count ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0) || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id, count]) => `${id}x${Math.trunc(count ?? 0)}`);
  return entries.length > 0 ? entries.join(', ') : '-';
}

function postTierRank(tier: 'small' | 'medium' | 'large'): number {
  return tier === 'small' ? 1 : tier === 'medium' ? 2 : 3;
}

function domainTierRank(tier: 'starter' | 'small' | 'medium' | 'large'): number {
  return tier === 'starter' ? 0 : postTierRank(tier);
}

const COST_BUFFER = 1.1;

function buffered(cost: number, bufferFactor: number): number {
  return Math.ceil(cost * bufferFactor);
}

function bufferFactorForStrategy(
  strategyCard?: StrategyCard,
  systemPreamble?: string
): number {
  if (strategyCard?.risk === 'aggressive') return 1;
  if (strategyCard?.risk === 'conservative') return COST_BUFFER;
  const hay = systemPreamble?.toLowerCase() ?? '';
  if (hay.includes('risiko') && hay.includes('hoch')) return 1;
  return COST_BUFFER;
}

function roundCheckBonus(round: number): number {
  return Math.floor(Math.max(1, round) / 10);
}

function effectiveCheckValue(base: number, round: number): number {
  return base + roundCheckBonus(round);
}

type OfficeRequirement = {
  tier: 'small' | 'medium' | 'large';
  payment: 'goldFirst' | 'influenceFirst';
  gold: number;
  influence: number;
};

function strategyWantsOffices(
  strategyCard?: StrategyCard,
  systemPreamble?: string
): boolean {
  const parts: string[] = [];
  if (strategyCard?.title) parts.push(strategyCard.title);
  if (strategyCard?.primary) parts.push(...strategyCard.primary);
  if (strategyCard?.secondary) parts.push(...strategyCard.secondary);
  if (systemPreamble) parts.push(systemPreamble);
  const hay = parts.join(' ').toLowerCase();
  return hay.includes('amt') || hay.includes('aemter');
}

function officeRequirements(me: PlayerState): OfficeRequirement[] {
  const out: OfficeRequirement[] = [
    { tier: 'small', payment: 'goldFirst', gold: 8, influence: 2 },
    { tier: 'small', payment: 'influenceFirst', gold: 4, influence: 8 },
  ];

  const smallCount = me.holdings.offices.filter((o) => o.tier === 'small').length;
  const mediumCount = me.holdings.offices.filter((o) => o.tier === 'medium').length;

  if (smallCount >= 2) {
    out.push(
      { tier: 'medium', payment: 'goldFirst', gold: 18, influence: 8 },
      { tier: 'medium', payment: 'influenceFirst', gold: 10, influence: 18 }
    );
  }
  if (mediumCount >= 2) {
    out.push(
      { tier: 'large', payment: 'goldFirst', gold: 70, influence: 20 },
      { tier: 'large', payment: 'influenceFirst', gold: 24, influence: 70 }
    );
  }

  return out;
}

function pickTempInfluenceForOffice(params: {
  me: PlayerState;
  actionsPerRound: number;
  candidates: Candidate[];
  strategyCard?: StrategyCard;
  systemPreamble?: string;
  bufferFactor: number;
}): Candidate | null {
  const { me, actionsPerRound, candidates, strategyCard, systemPreamble } =
    params;
  const { bufferFactor } = params;
  if (!strategyWantsOffices(strategyCard, systemPreamble)) return null;
  if (candidates.some((c) => c.actionKey === 'acquire.office')) return null;

  const tempCandidates = candidates
    .filter(
      (c) =>
        c.command.type === 'GainInfluence' &&
        c.command.kind === 'temporary' &&
        Number.isFinite(c.command.investments)
    )
    .map((c) => ({
      candidate: c,
      investments: Math.trunc(c.command.investments),
    }))
    .filter((c) => c.investments > 0)
    .sort((a, b) => a.investments - b.investments);

  if (tempCandidates.length === 0) return null;

  const baseRemaining = Math.max(0, actionsPerRound - me.turn.actionsUsed);
  const influenceUsesBase =
    !hasUsedCanonicalAction(me, 'influence') && baseRemaining >= 1;
  const canTakeOfficeAfterInfluence = influenceUsesBase
    ? baseRemaining >= 2
    : baseRemaining >= 1;
  if (!canTakeOfficeAfterInfluence) return null;

  const requirements = officeRequirements(me);
  const currentInfluence = me.turn.influenceAvailable;

  for (const req of requirements) {
    const neededInfluence = buffered(req.influence, bufferFactor);
    const shortfall = neededInfluence - currentInfluence;
    if (shortfall <= 0) continue;

    for (const temp of tempCandidates) {
      const minGain = Math.max(1, temp.investments * 2);
      const goldAfterTemp = me.economy.gold - temp.investments;
      if (goldAfterTemp < buffered(req.gold, bufferFactor)) continue;
      if (minGain >= shortfall) return temp.candidate;
    }

    for (const temp of tempCandidates) {
      const expectedGain = temp.investments * 4;
      const goldAfterTemp = me.economy.gold - temp.investments;
      if (goldAfterTemp < buffered(req.gold, bufferFactor)) continue;
      if (expectedGain >= shortfall) return temp.candidate;
    }
  }

  return null;
}

function pickBudgetOptions(max: number): number[] {
  if (max <= 0) return [];
  const mid = Math.ceil(max / 2);
  const raw = [1, mid, max].filter((v) => v > 0 && v <= max);
  return Array.from(new Set(raw));
}

function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

function sellBuyInvestmentCap(me: PlayerState): number {
  const capFromTrade = me.holdings.tradeEnterprises.reduce(
    (sum, te) => sum + 2 * postTierRank(te.tier),
    0
  );
  const capFromDomains = me.holdings.domains.reduce(
    (sum, d) => sum + (d.tier === 'starter' ? 0 : postTierRank(d.tier)),
    0
  );
  return 3 + capFromTrade + capFromDomains;
}

function localMarketInstanceId(): string {
  return 'local';
}

function tierUnits(tier: 'small' | 'medium' | 'large'): number {
  return tier === 'small' ? 1 : tier === 'medium' ? 2 : 4;
}

function domainFacilitySlotsMax(tier: 'starter' | 'small' | 'medium' | 'large'): number {
  if (tier === 'starter') return 0;
  return 2 * postTierRank(tier);
}

function cityFacilitySlotsMax(tier: 'small' | 'medium' | 'large'): number {
  return tier === 'small' ? 2 : tier === 'medium' ? 3 : 4;
}

function productionCapacityUnitsMaxForCity(tier: 'small' | 'medium' | 'large'): number {
  return 2 * tierUnits(tier);
}

function countFacilitySlotsUsedAtDomain(
  holdings: PlayerState['holdings'],
  domainId: string
): number {
  const domain = holdings.domains.find((d) => d.id === domainId);
  if (!domain) return 0;
  const workshopSlots = holdings.workshops.filter(
    (w) =>
      w.location.kind === 'domain' &&
      w.location.id === domainId &&
      w.id !== 'workshop-starter'
  ).length;
  const storageSlots = holdings.storages.filter(
    (s) => s.location.kind === 'domain' && s.location.id === domainId
  ).length;
  const specSlots = domain.specialization?.facilities?.length ?? 0;
  return domain.facilities.length + specSlots + workshopSlots + storageSlots;
}

function countFacilitySlotsUsedAtCity(
  holdings: PlayerState['holdings'],
  cityId: string
): number {
  const city = holdings.cityProperties.find((c) => c.id === cityId);
  if (!city) return 0;
  const workshopSlots = holdings.workshops.filter(
    (w) => w.location.kind === 'cityProperty' && w.location.id === cityId
  ).length;
  const storageSlots = holdings.storages.filter(
    (s) => s.location.kind === 'cityProperty' && s.location.id === cityId
  ).length;
  const specSlots = city.specialization?.facilities?.length ?? 0;
  return city.facilities.length + specSlots + workshopSlots + storageSlots;
}

function countProductionUnitsUsedAtCity(
  holdings: PlayerState['holdings'],
  cityId: string
): number {
  const workshopUnits = holdings.workshops
    .filter((w) => w.location.kind === 'cityProperty' && w.location.id === cityId)
    .reduce((sum, w) => sum + tierUnits(w.tier), 0);
  const storageUnits = holdings.storages
    .filter((s) => s.location.kind === 'cityProperty' && s.location.id === cityId)
    .reduce((sum, s) => sum + tierUnits(s.tier), 0);
  return workshopUnits + storageUnits;
}

function hasWorkshopSpecialist(
  me: PlayerState,
  requiredTier: 'simple' | 'experienced'
): boolean {
  return me.holdings.specialists.some((s) => {
    if (s.kind !== 'artisan' && s.kind !== 'workshop') return false;
    if (requiredTier === 'simple') return true;
    return s.tier === 'experienced' || s.tier === 'master';
  });
}

function buildFacilityCandidates(
  me: PlayerState,
  bufferFactor: number
): Candidate[] {
  const candidates: Candidate[] = [];
  const domainsByTier = [...me.holdings.domains].sort(
    (a, b) => domainTierRank(b.tier) - domainTierRank(a.tier)
  );
  const citiesByTier = [...me.holdings.cityProperties].sort(
    (a, b) => postTierRank(b.tier) - postTierRank(a.tier)
  );

  const starter = me.holdings.domains.find((d) => d.tier === 'starter');
  if (starter) {
    const possibleNow = me.economy.gold >= 10 && me.turn.laborAvailable >= 4;
    candidates.push({
      id: 'facility.domain.upgradeStarter',
      kind: 'facility',
      command: {
        type: 'UpgradeStarterDomain',
        campaignId: '',
        domainId: starter.id,
      },
      actionKey: null,
      possibleNow,
      summary: 'Starter-Domäne ausbauen (10 Gold, 4 AK).',
    });
  }

  const leasedCity = citiesByTier.find((c) => c.mode === 'leased');
  if (leasedCity) {
    candidates.push({
      id: `facility.city.mode.production.${leasedCity.id}`,
      kind: 'facility',
      command: {
        type: 'SetCityPropertyMode',
        campaignId: '',
        cityPropertyId: leasedCity.id,
        mode: 'production',
      },
      actionKey: null,
      possibleNow: true,
      summary: `Stadtbesitz ${leasedCity.id} auf Produktion umstellen.`,
    });
  }

  const tradeMode = me.holdings.tradeEnterprises.find(
    (t) => t.mode !== 'trade'
  );
  if (tradeMode) {
    candidates.push({
      id: `facility.trade.mode.trade.${tradeMode.id}`,
      kind: 'facility',
      command: {
        type: 'SetTradeEnterpriseMode',
        campaignId: '',
        tradeEnterpriseId: tradeMode.id,
        mode: 'trade',
      },
      actionKey: null,
      possibleNow: true,
      summary: `Handelsunternehmung ${tradeMode.id} auf Handel umstellen.`,
    });
  }

  const officeMode = me.holdings.offices.find((o) => o.yieldMode !== 'gold');
  if (officeMode) {
    candidates.push({
      id: `facility.office.mode.gold.${officeMode.id}`,
      kind: 'facility',
      command: {
        type: 'SetOfficeYieldMode',
        campaignId: '',
        officeId: officeMode.id,
        mode: 'gold',
      },
      actionKey: null,
      possibleNow: true,
      summary: `Amt ${officeMode.id} auf Gold-Ertrag umstellen.`,
    });
  }

  const specDomain = domainsByTier.find(
    (d) => d.tier !== 'starter' && !d.specialization
  );
  if (specDomain) {
    if (me.economy.gold >= buffered(6, bufferFactor)) {
      candidates.push({
        id: `facility.domain.spec.forestry.${specDomain.id}`,
        kind: 'facility',
        command: {
          type: 'SetDomainSpecialization',
          campaignId: '',
          domainId: specDomain.id,
          kind: 'forestry',
        },
        actionKey: null,
        possibleNow: true,
        summary: `Domäne ${specDomain.id} spezialisieren: Forstwirtschaft (6 Gold).`,
      });
    }
    if (
      me.economy.gold >= buffered(10, bufferFactor) &&
      (me.economy.inventory.raw['raw.grainVeg'] ?? 0) >= 2
    ) {
      candidates.push({
        id: `facility.domain.spec.agriculture.${specDomain.id}`,
        kind: 'facility',
        command: {
          type: 'SetDomainSpecialization',
          campaignId: '',
          domainId: specDomain.id,
          kind: 'agriculture',
          picks: { costRawId: 'raw.grainVeg' },
        },
        actionKey: null,
        possibleNow: true,
        summary:
          'Domäne ' +
          specDomain.id +
          ' spezialisieren: Landwirtschaft (10 Gold, 2 RM raw.grainVeg).',
      });
    }
    if (
      me.economy.gold >= buffered(20, bufferFactor) &&
      (me.economy.inventory.raw['raw.wood'] ?? 0) >= 4
    ) {
      candidates.push({
        id: `facility.domain.spec.mining.${specDomain.id}`,
        kind: 'facility',
        command: {
          type: 'SetDomainSpecialization',
          campaignId: '',
          domainId: specDomain.id,
          kind: 'mining',
        },
        actionKey: null,
        possibleNow: true,
        summary:
          'Domäne ' +
          specDomain.id +
          ' spezialisieren: Bergbau (20 Gold, 4 RM raw.wood).',
      });
    }
    const animalCount = Object.entries(me.economy.inventory.raw).reduce(
      (sum, [materialId, count]) => {
        try {
          const mat = getMaterialOrThrow(materialId);
          if (mat.tags.includes('animal')) return sum + (count ?? 0);
        } catch {
          return sum;
        }
        return sum;
      },
      0
    );
    if (me.economy.gold >= buffered(15, bufferFactor) && animalCount >= 4) {
      candidates.push({
        id: `facility.domain.spec.animal.${specDomain.id}`,
        kind: 'facility',
        command: {
          type: 'SetDomainSpecialization',
          campaignId: '',
          domainId: specDomain.id,
          kind: 'animalHusbandry',
        },
        actionKey: null,
        possibleNow: true,
        summary:
          'Domäne ' +
          specDomain.id +
          ' spezialisieren: Viehzucht (15 Gold, 4 RM Tiere).',
      });
    }
  }

  const domainForWorkshop = domainsByTier.find((d) => {
    if (d.tier === 'starter') return false;
    const used = countFacilitySlotsUsedAtDomain(me.holdings, d.id);
    const max = domainFacilitySlotsMax(d.tier);
    return used + 1 <= max;
  });
  if (domainForWorkshop) {
    const possibleNow = me.economy.gold >= 8;
    candidates.push({
      id: `facility.workshop.buildSmall.domain.${domainForWorkshop.id}`,
      kind: 'facility',
      command: {
        type: 'BuildWorkshop',
        campaignId: '',
        location: { kind: 'domain', id: domainForWorkshop.id },
        tier: 'small',
      },
      actionKey: null,
      possibleNow,
      summary: `Werkstatt (klein) bauen auf Domäne ${domainForWorkshop.id} (8 Gold).`,
    });
  }

  const domainForStorage = domainsByTier.find((d) => {
    if (d.tier === 'starter') return false;
    const used = countFacilitySlotsUsedAtDomain(me.holdings, d.id);
    const max = domainFacilitySlotsMax(d.tier);
    return used + 1 <= max;
  });
  if (domainForStorage) {
    const possibleNow = me.economy.gold >= 8;
    candidates.push({
      id: `facility.storage.buildSmall.domain.${domainForStorage.id}`,
      kind: 'facility',
      command: {
        type: 'BuildStorage',
        campaignId: '',
        location: { kind: 'domain', id: domainForStorage.id },
        tier: 'small',
      },
      actionKey: null,
      possibleNow,
      summary: `Lager (klein) bauen auf Domäne ${domainForStorage.id} (8 Gold).`,
    });
  }

  const cityForWorkshop = citiesByTier.find((c) => {
    if (c.mode !== 'production') return false;
    const usedSlots = countFacilitySlotsUsedAtCity(me.holdings, c.id);
    const maxSlots = cityFacilitySlotsMax(c.tier);
    if (usedSlots + 1 > maxSlots) return false;
    const usedUnits = countProductionUnitsUsedAtCity(me.holdings, c.id);
    return (
      usedUnits + tierUnits('small') <= productionCapacityUnitsMaxForCity(c.tier)
    );
  });
  if (cityForWorkshop) {
    const possibleNow = me.economy.gold >= 8;
    candidates.push({
      id: `facility.workshop.buildSmall.city.${cityForWorkshop.id}`,
      kind: 'facility',
      command: {
        type: 'BuildWorkshop',
        campaignId: '',
        location: { kind: 'cityProperty', id: cityForWorkshop.id },
        tier: 'small',
      },
      actionKey: null,
      possibleNow,
      summary: `Werkstatt (klein) bauen in Stadtbesitz ${cityForWorkshop.id} (8 Gold).`,
    });
  }

  const cityForStorage = citiesByTier.find((c) => {
    if (c.mode !== 'production') return false;
    const usedSlots = countFacilitySlotsUsedAtCity(me.holdings, c.id);
    const maxSlots = cityFacilitySlotsMax(c.tier);
    if (usedSlots + 1 > maxSlots) return false;
    const usedUnits = countProductionUnitsUsedAtCity(me.holdings, c.id);
    return (
      usedUnits + tierUnits('small') <= productionCapacityUnitsMaxForCity(c.tier)
    );
  });
  if (cityForStorage) {
    const possibleNow = me.economy.gold >= 8;
    candidates.push({
      id: `facility.storage.buildSmall.city.${cityForStorage.id}`,
      kind: 'facility',
      command: {
        type: 'BuildStorage',
        campaignId: '',
        location: { kind: 'cityProperty', id: cityForStorage.id },
        tier: 'small',
      },
      actionKey: null,
      possibleNow,
      summary: `Lager (klein) bauen in Stadtbesitz ${cityForStorage.id} (8 Gold).`,
    });
  }

  const workshopToUpgrade = me.holdings.workshops.find(
    (w) => w.tier !== 'large'
  );
  if (workshopToUpgrade) {
    const toTier = workshopToUpgrade.tier === 'small' ? 'medium' : 'large';
    const requires = toTier === 'large' ? 'experienced' : 'simple';
    const hasSpecialist = hasWorkshopSpecialist(me, requires);
    let possibleCityCapacity = true;
    if (workshopToUpgrade.location.kind === 'cityProperty') {
      const city = me.holdings.cityProperties.find(
        (c) => c.id === workshopToUpgrade.location.id
      );
      if (city && city.mode === 'production') {
        const usedUnits = countProductionUnitsUsedAtCity(me.holdings, city.id);
        const maxUnits = productionCapacityUnitsMaxForCity(city.tier);
        const deltaUnits = tierUnits(toTier) - tierUnits(workshopToUpgrade.tier);
        possibleCityCapacity = usedUnits + deltaUnits <= maxUnits;
      } else {
        possibleCityCapacity = false;
      }
    }
    const goldCost =
      toTier === 'medium'
        ? 8
        : toTier === 'large'
          ? 24
          : 0;
    const possibleNow =
      hasSpecialist &&
      possibleCityCapacity &&
      me.economy.gold >= buffered(goldCost, bufferFactor);
    candidates.push({
      id: `facility.workshop.upgrade.${workshopToUpgrade.id}.${toTier}`,
      kind: 'facility',
      command: {
        type: 'UpgradeWorkshop',
        campaignId: '',
        workshopId: workshopToUpgrade.id,
        toTier,
      },
      actionKey: null,
      possibleNow,
      summary: `Werkstatt ${workshopToUpgrade.id} auf ${toTier} upgraden (ca. ${goldCost} Gold).`,
    });
  }

  const storageToUpgrade = me.holdings.storages.find((s) => s.tier !== 'large');
  if (storageToUpgrade) {
    const toTier = storageToUpgrade.tier === 'small' ? 'medium' : 'large';
    let possibleCityCapacity = true;
    if (storageToUpgrade.location.kind === 'cityProperty') {
      const city = me.holdings.cityProperties.find(
        (c) => c.id === storageToUpgrade.location.id
      );
      if (city && city.mode === 'production') {
        const usedUnits = countProductionUnitsUsedAtCity(me.holdings, city.id);
        const maxUnits = productionCapacityUnitsMaxForCity(city.tier);
        const deltaUnits = tierUnits(toTier) - tierUnits(storageToUpgrade.tier);
        possibleCityCapacity = usedUnits + deltaUnits <= maxUnits;
      } else {
        possibleCityCapacity = false;
      }
    }
    const goldCost =
      toTier === 'medium'
        ? 8
        : toTier === 'large'
          ? 24
          : 0;
    const possibleNow =
      possibleCityCapacity && me.economy.gold >= buffered(goldCost, bufferFactor);
    candidates.push({
      id: `facility.storage.upgrade.${storageToUpgrade.id}.${toTier}`,
      kind: 'facility',
      command: {
        type: 'UpgradeStorage',
        campaignId: '',
        storageId: storageToUpgrade.id,
        toTier,
      },
      actionKey: null,
      possibleNow,
      summary: `Lager ${storageToUpgrade.id} auf ${toTier} upgraden (ca. ${goldCost} Gold).`,
    });
  }

  return dedupeCandidates(candidates);
}

function formatPlayerState(state: { me: PlayerState; round: number }): string {
  const me = state.me;
  const rawTotal = sumStock(me.economy.inventory.raw);
  const specialTotal = sumStock(me.economy.inventory.special);

  const domains = me.holdings.domains.map((d) => d.tier).join(', ') || '-';
  const cities =
    me.holdings.cityProperties.map((c) => `${c.tier}/${c.mode}`).join(', ') ||
    '-';
  const offices =
    me.holdings.offices.map((o) => `${o.tier}/${o.yieldMode}`).join(', ') ||
    '-';
  const orgs =
    me.holdings.organizations.map((o) => `${o.kind}/${o.tier}`).join(', ') ||
    '-';
  const trades =
    me.holdings.tradeEnterprises.map((t) => `${t.tier}/${t.mode}`).join(', ') ||
    '-';
  const checkBonus = roundCheckBonus(state.round);
  const infCheck = effectiveCheckValue(me.checks.influence, state.round);
  const moneyCheck = effectiveCheckValue(me.checks.money, state.round);
  const matCheck = effectiveCheckValue(me.checks.materials, state.round);

  return [
    `Runde: ${state.round}`,
    `Gold: ${me.economy.gold} (pending: ${me.economy.pending.gold})`,
    `RM: ${rawTotal}, SM: ${specialTotal}, Zauberkraft: ${me.economy.inventory.magicPower}`,
    `RM-Top: ${formatStockSummary(me.economy.inventory.raw)}`,
    `SM-Top: ${formatStockSummary(me.economy.inventory.special)}`,
    `Checks: influence=${me.checks.influence}+${checkBonus}=${infCheck}, money=${me.checks.money}+${checkBonus}=${moneyCheck}, materials=${me.checks.materials}+${checkBonus}=${matCheck}`,
    `AK verfügbar: ${me.turn.laborAvailable}, Einfluss verfügbar: ${me.turn.influenceAvailable}`,
    `Perm: Einfluss=${me.holdings.permanentInfluence}, AK=${me.holdings.permanentLabor}`,
    `Aktionen: used=${me.turn.actionsUsed}, keys=[${me.turn.actionKeysUsed.join(', ')}]`,
    `Domänen: ${domains}`,
    `Stadtbesitz: ${cities}`,
    `Ämter: ${offices}`,
    `Organisationen: ${orgs}`,
    `Handelsunternehmungen: ${trades}`,
    `Truppen: bodyguard=${me.holdings.troops.bodyguardLevels}, militia=${me.holdings.troops.militiaLevels}, merc=${me.holdings.troops.mercenaryLevels}, thug=${me.holdings.troops.thugLevels}`,
  ].join('\n');
}

function formatMarketSnapshot(
  me: PlayerState,
  market: CampaignMarketLike
): string[] {
  const instances = market.instances.filter(
    (inst) => !inst.ownerPlayerId || inst.ownerPlayerId === me.id
  );
  if (instances.length === 0) return ['(keine verfuegbaren Maerkte)'];

  const fmtMods = (mods: Record<string, number>) => {
    const entries = Object.entries(mods)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0) || a[0].localeCompare(b[0]))
      .slice(0, 2)
      .map(([group, mod]) => `${group}:${mod >= 0 ? '+' : ''}${mod}`);
    return entries.length > 0 ? entries.join(', ') : '-';
  };

  return instances.map((inst) => {
    const best = buildSellItems(me, inst, sellBuyInvestmentCap(me));
    const bestInv =
      best && best.topIds.length > 0
        ? `${best.topIds.join(', ')} (mod≈${best.topScore})`
        : '-';
    return `${inst.label}: raw[${fmtMods(inst.raw.modifiersByGroup)}] special[${fmtMods(
      inst.special.modifiersByGroup
    )}] invBest[${bestInv}]`;
  });
}

function formatActionCapacity(
  me: PlayerState,
  actionsPerRound: number
): string {
  const baseRemaining = Math.max(0, actionsPerRound - me.turn.actionsUsed);
  const influenceBonusRemaining = remainingInfluenceBonusSlots(me);
  const moneyBonusRemaining =
    bonusMoneySlots(me) > 0 && !hasUsedMarker(me, 'bonus.money.1') ? 1 : 0;
  const materialsBonusRemaining =
    bonusMaterialsSlots(me) > 0 && !hasUsedMarker(me, 'bonus.materials.1')
      ? 1
      : 0;

  return `Aktionen verbleibend: base=${baseRemaining}, bonusInfluence=${influenceBonusRemaining}, bonusMoney=${moneyBonusRemaining}, bonusMaterials=${materialsBonusRemaining}`;
}

function formatStrategyCard(card: StrategyCard): string[] {
  const lines: string[] = [];
  lines.push(`Titel: ${card.title}`);
  if (card.risk) lines.push(`Risiko: ${card.risk}`);
  if (card.primary.length > 0)
    lines.push(`Primaer: ${card.primary.join('; ')}`);
  if (card.secondary && card.secondary.length > 0)
    lines.push(`Sekundaer: ${card.secondary.join('; ')}`);
  if (card.avoid && card.avoid.length > 0)
    lines.push(`Vermeiden: ${card.avoid.join('; ')}`);
  if (card.guardrails && card.guardrails.length > 0)
    lines.push(`Guardrails: ${card.guardrails.join('; ')}`);
  return lines;
}

function filterActionCandidates(
  me: PlayerState,
  candidates: Candidate[]
): Candidate[] {
  return candidates.filter((c) => {
    if (!c.possibleNow) return false;
    if (!c.actionKey) return true;
    const used = hasUsedCanonicalAction(me, c.actionKey);
    if (!used) return true;
    if (c.actionKey === 'influence') return hasRemainingInfluenceBonus(me);
    if (
      c.actionKey.startsWith('money.') &&
      bonusMoneySlots(me) > 0 &&
      !hasUsedMarker(me, 'bonus.money.1')
    ) {
      return true;
    }
    if (
      c.actionKey.startsWith('materials.') &&
      bonusMaterialsSlots(me) > 0 &&
      !hasUsedMarker(me, 'bonus.materials.1')
    ) {
      return true;
    }
    return false;
  });
}

function buildSellItems(
  me: PlayerState,
  inst: CampaignMarketLike['instances'][number],
  budget: number
): {
  items: Array<
    | { kind: 'raw'; materialId: string; count: number }
    | { kind: 'special'; materialId: string; count: number }
  >;
  topIds: string[];
  topScore: number;
} | null {
  type Lot = {
    kind: 'raw' | 'special';
    materialId: string;
    investments: number;
    score: number;
  };
  const lots: Lot[] = [];

  for (const [materialId, count] of Object.entries(me.economy.inventory.raw)) {
    const inv = Math.floor((count ?? 0) / 6);
    if (inv <= 0) continue;
    const mat = getMaterialOrThrow(materialId);
    const mod = Math.trunc(inst.raw.modifiersByGroup[mat.marketGroup] ?? 0);
    lots.push({
      kind: 'raw',
      materialId,
      investments: inv,
      score: mod + (mat.saleBonusGold ?? 0),
    });
  }
  for (const [materialId, count] of Object.entries(
    me.economy.inventory.special
  )) {
    const inv = Math.floor(count ?? 0);
    if (inv <= 0) continue;
    const mat = getMaterialOrThrow(materialId);
    const mod = Math.trunc(inst.special.modifiersByGroup[mat.marketGroup] ?? 0);
    lots.push({
      kind: 'special',
      materialId,
      investments: inv,
      score: mod + (mat.saleBonusGold ?? 0),
    });
  }

  if (lots.length === 0) return null;
  lots.sort(
    (a, b) => b.score - a.score || a.materialId.localeCompare(b.materialId)
  );
  const topScore = lots[0]?.score ?? 0;

  let remaining = budget;
  const rawCounts: Record<string, number> = {};
  const specialCounts: Record<string, number> = {};
  const topIds: string[] = [];

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.investments, remaining);
    remaining -= take;
    if (topIds.length < 2 && !topIds.includes(lot.materialId)) {
      topIds.push(lot.materialId);
    }
    if (lot.kind === 'raw')
      rawCounts[lot.materialId] = (rawCounts[lot.materialId] ?? 0) + take * 6;
    else
      specialCounts[lot.materialId] =
        (specialCounts[lot.materialId] ?? 0) + take;
  }

  const items: Array<
    | { kind: 'raw'; materialId: string; count: number }
    | { kind: 'special'; materialId: string; count: number }
  > = [];
  for (const [materialId, count] of Object.entries(rawCounts))
    items.push({ kind: 'raw', materialId, count });
  for (const [materialId, count] of Object.entries(specialCounts))
    items.push({ kind: 'special', materialId, count });

  if (items.length === 0) return null;
  return { items, topIds, topScore };
}

function buildMoneySellCandidates(
  state: { me: PlayerState; market: CampaignMarketLike },
  maxInvestments?: number
): Candidate[] {
  const me = state.me;
  const cap = sellBuyInvestmentCap(me);
  const budgetMax = Math.max(
    0,
    Math.min(cap, Math.trunc(maxInvestments ?? cap))
  );
  if (budgetMax <= 0) return [];

  const budgets = pickBudgetOptions(budgetMax);

  const instances = state.market.instances.filter(
    (inst) => !inst.ownerPlayerId || inst.ownerPlayerId === state.me.id
  );
  if (instances.length === 0) return [];

  const candidates: Candidate[] = [];
  for (const inst of instances) {
    for (const budget of budgets) {
      const built = buildSellItems(me, inst, budget);
      if (!built) continue;
      const itemsLabel =
        built.topIds.length > 0 ? `, top: ${built.topIds.join(', ')}` : '';
      const scoreLabel =
        built.topScore !== 0 ? `, bestMod≈${built.topScore}` : '';
      candidates.push({
        id: `action.money.sell.${inst.id}.best.${budget}`,
        kind: 'action',
        command: {
          type: 'MoneySell',
          campaignId: '',
          marketInstanceId: inst.id,
          items: built.items,
        },
        actionKey: 'money.sell',
        possibleNow: true,
        summary: `Verkauf (bestes Paket, ~${budget} Investments) auf ${inst.label}${itemsLabel}${scoreLabel}.`,
      });
    }
  }

  return candidates;
}

type CampaignMarketLike = {
  instances: Array<{
    id: string;
    label: string;
    ownerPlayerId?: string;
    raw: { modifiersByGroup: Record<string, number> };
    special: { modifiersByGroup: Record<string, number> };
  }>;
};

function buildActionCandidates(options: {
  round: number;
  me: PlayerState;
  state: { market: CampaignMarketLike };
  bufferFactor: number;
}): Candidate[] {
  const { me } = options;
  const bufferFactor = options.bufferFactor;
  const candidates: Candidate[] = [];
  const domainsByTier = [...me.holdings.domains].sort(
    (a, b) => domainTierRank(b.tier) - domainTierRank(a.tier)
  );
  const citiesByTier = [...me.holdings.cityProperties].sort(
    (a, b) => postTierRank(b.tier) - postTierRank(a.tier)
  );

  // Materialgewinn (Domain) – max.
  {
    const domain = domainsByTier[0];
    if (domain) {
      const rank = domain.tier === 'starter' ? 1 : postTierRank(domain.tier);
      const cap = 4 * rank;
      const maxInvestments = Math.min(cap, me.turn.laborAvailable);
      for (const investments of pickBudgetOptions(maxInvestments)) {
        candidates.push({
          id: `action.materials.domain.${domain.id}.${investments}`,
          kind: 'action',
          command: {
            type: 'GainMaterials',
            campaignId: '',
            mode: 'domainAdministration',
            investments,
            targetId: domain.id,
          },
          actionKey: 'materials.domain',
          possibleNow: true,
          summary: `Materialgewinn Domäne (${domain.id}) inv=${investments}/${cap} (Kosten: ${investments} AK).`,
        });
      }
    }
  }

  // Materialgewinn (Werkstatt) – max.
  {
    const workshop = me.holdings.workshops[0];
    if (workshop) {
      const cap = 2 * postTierRank(workshop.tier);
      const maxInvestments = Math.min(cap, me.turn.laborAvailable);
      for (const investments of pickBudgetOptions(maxInvestments)) {
        candidates.push({
          id: `action.materials.workshop.${workshop.id}.${investments}`,
          kind: 'action',
          command: {
            type: 'GainMaterials',
            campaignId: '',
            mode: 'workshopOversight',
            investments,
            targetId: workshop.id,
          },
          actionKey: 'materials.workshop',
          possibleNow: true,
          summary: `Materialgewinn Werkstatt (${workshop.id}) inv=${investments}/${cap} (Kosten: ${investments} AK).`,
        });
      }
    }
  }

  // Einflussgewinn (temp/permanent) – 1/mid/max
  {
    const hasAnySmall =
      me.holdings.offices.some((o) => o.tier === 'small') ||
      me.holdings.organizations.some((o) => o.tier === 'small');
    const hasAnyMedium =
      me.holdings.offices.some((o) => o.tier === 'medium') ||
      me.holdings.organizations.some((o) => o.tier === 'medium');
    const hasAnyLarge =
      me.holdings.offices.some((o) => o.tier === 'large') ||
      me.holdings.organizations.some((o) => o.tier === 'large');

    const tempCap = hasAnyLarge ? 12 : hasAnyMedium ? 8 : hasAnySmall ? 6 : 4;
    const tempMax = Math.min(tempCap, me.economy.gold);
    for (const inv of pickBudgetOptions(tempMax)) {
      candidates.push({
        id: `action.influence.temp.${inv}`,
        kind: 'action',
        command: {
          type: 'GainInfluence',
          campaignId: '',
          kind: 'temporary',
          investments: inv,
        },
        actionKey: 'influence',
        possibleNow: true,
        summary: `Einflussgewinn (temp), Inv=${inv} (Kosten: ${inv} Gold).`,
      });
    }

    const permCap =
      2 +
      me.holdings.offices.reduce((sum, o) => sum + postTierRank(o.tier), 0) +
      me.holdings.organizations.reduce(
        (sum, o) => sum + postTierRank(o.tier),
        0
      );
    const permMax = Math.min(permCap, Math.floor(me.economy.gold / 2));
    for (const inv of pickBudgetOptions(permMax)) {
      candidates.push({
        id: `action.influence.perm.${inv}`,
        kind: 'action',
        command: {
          type: 'GainInfluence',
          campaignId: '',
          kind: 'permanent',
          investments: inv,
        },
        actionKey: 'influence',
        possibleNow: true,
        summary: `Einflussgewinn (perm), Inv=${inv} (Kosten: ${inv * 2} Gold).`,
      });
    }
  }

  // Geldverleih – 1..cap (begrenzt auf 4 Optionen zur Prompt-Größe)
  {
    const maxTradeTier = Math.max(
      0,
      ...me.holdings.tradeEnterprises.map((t) => postTierRank(t.tier))
    );
    const cap =
      maxTradeTier === 0
        ? 2
        : maxTradeTier === 1
          ? 4
          : maxTradeTier === 2
            ? 6
            : 10;
    const maxAffordable = Math.floor(me.economy.gold / 2);
    const max = Math.min(cap, maxAffordable);
    for (const inv of pickBudgetOptions(max)) {
      candidates.push({
        id: `action.money.lend.${inv}`,
        kind: 'action',
        command: { type: 'MoneyLend', campaignId: '', investments: inv },
        actionKey: 'money.lend',
        possibleNow: inv * 2 <= me.economy.gold,
        summary: `Geldverleih, Inv=${inv} (Kosten: ${inv * 2} Gold; Auszahlung nächste Runde).`,
      });
    }
  }

  // Verkauf (best effort)
  {
    const sells = buildMoneySellCandidates(
      { me, market: options.state.market },
      sellBuyInvestmentCap(me)
    );
    candidates.push(...sells);
  }

  // Amt (klein)
  {
    const goldFirst = { gold: 8, influence: 2 };
    const goldFirstNow =
      me.economy.gold >= buffered(goldFirst.gold, bufferFactor) &&
      me.turn.influenceAvailable >= buffered(goldFirst.influence, bufferFactor);
    candidates.push({
      id: 'action.office.small.payGoldFirst',
      kind: 'action',
      command: {
        type: 'AcquireOffice',
        campaignId: '',
        tier: 'small',
        payment: 'goldFirst',
      },
      actionKey: 'acquire.office',
      possibleNow: goldFirstNow,
      summary: `Kleines Amt erlangen (Basis: ${goldFirst.gold} Gold, ${goldFirst.influence} Einfluss; +10% Puffer empfohlen).`,
    });
  }
  {
    const infFirst = { gold: 4, influence: 8 };
    const infFirstNow =
      me.economy.gold >= buffered(infFirst.gold, bufferFactor) &&
      me.turn.influenceAvailable >= buffered(infFirst.influence, bufferFactor);
    candidates.push({
      id: 'action.office.small.payInfluenceFirst',
      kind: 'action',
      command: {
        type: 'AcquireOffice',
        campaignId: '',
        tier: 'small',
        payment: 'influenceFirst',
      },
      actionKey: 'acquire.office',
      possibleNow: infFirstNow,
      summary: `Kleines Amt erlangen (Basis: ${infFirst.gold} Gold, ${infFirst.influence} Einfluss; +10% Puffer empfohlen).`,
    });
  }

  // Amt (mittel)
  {
    const smallCount = me.holdings.offices.filter(
      (o) => o.tier === 'small'
    ).length;
    if (smallCount >= 2) {
      const goldFirst = { gold: 18, influence: 8 };
      const goldFirstNow =
        me.economy.gold >= buffered(goldFirst.gold, bufferFactor) &&
        me.turn.influenceAvailable >= buffered(goldFirst.influence, bufferFactor);
      candidates.push({
        id: 'action.office.medium.payGoldFirst',
        kind: 'action',
        command: {
          type: 'AcquireOffice',
          campaignId: '',
          tier: 'medium',
          payment: 'goldFirst',
        },
        actionKey: 'acquire.office',
        possibleNow: goldFirstNow,
        summary: `Mittleres Amt erlangen (Basis: ${goldFirst.gold} Gold, ${goldFirst.influence} Einfluss; +10% Puffer empfohlen).`,
      });
      const infFirst = { gold: 10, influence: 18 };
      const infFirstNow =
        me.economy.gold >= buffered(infFirst.gold, bufferFactor) &&
        me.turn.influenceAvailable >= buffered(infFirst.influence, bufferFactor);
      candidates.push({
        id: 'action.office.medium.payInfluenceFirst',
        kind: 'action',
        command: {
          type: 'AcquireOffice',
          campaignId: '',
          tier: 'medium',
          payment: 'influenceFirst',
        },
        actionKey: 'acquire.office',
        possibleNow: infFirstNow,
        summary: `Mittleres Amt erlangen (Basis: ${infFirst.gold} Gold, ${infFirst.influence} Einfluss; +10% Puffer empfohlen).`,
      });
    }
  }

  // Amt (gross)
  {
    const mediumCount = me.holdings.offices.filter(
      (o) => o.tier === 'medium'
    ).length;
    if (mediumCount >= 2) {
      const goldFirst = { gold: 70, influence: 20 };
      const goldFirstNow =
        me.economy.gold >= buffered(goldFirst.gold, bufferFactor) &&
        me.turn.influenceAvailable >= buffered(goldFirst.influence, bufferFactor);
      candidates.push({
        id: 'action.office.large.payGoldFirst',
        kind: 'action',
        command: {
          type: 'AcquireOffice',
          campaignId: '',
          tier: 'large',
          payment: 'goldFirst',
        },
        actionKey: 'acquire.office',
        possibleNow: goldFirstNow,
        summary: `Grosses Amt erlangen (Basis: ${goldFirst.gold} Gold, ${goldFirst.influence} Einfluss; +10% Puffer empfohlen).`,
      });
      const infFirst = { gold: 24, influence: 70 };
      const infFirstNow =
        me.economy.gold >= buffered(infFirst.gold, bufferFactor) &&
        me.turn.influenceAvailable >= buffered(infFirst.influence, bufferFactor);
      candidates.push({
        id: 'action.office.large.payInfluenceFirst',
        kind: 'action',
        command: {
          type: 'AcquireOffice',
          campaignId: '',
          tier: 'large',
          payment: 'influenceFirst',
        },
        actionKey: 'acquire.office',
        possibleNow: infFirstNow,
        summary: `Grosses Amt erlangen (Basis: ${infFirst.gold} Gold, ${infFirst.influence} Einfluss; +10% Puffer empfohlen).`,
      });
    }
  }

  // Handelsunternehmung (klein)
  candidates.push({
    id: 'action.tradeEnterprise.small',
    kind: 'action',
    command: { type: 'AcquireTradeEnterprise', campaignId: '', tier: 'small' },
    actionKey: 'acquire.trade',
    possibleNow: me.economy.gold >= buffered(20, bufferFactor),
    summary:
      'Handelsunternehmung (klein) erwerben (Basis: 20 Gold; +10% Puffer empfohlen).',
  });
  candidates.push({
    id: 'action.tradeEnterprise.medium',
    kind: 'action',
    command: {
      type: 'AcquireTradeEnterprise',
      campaignId: '',
      tier: 'medium',
    },
    actionKey: 'acquire.trade',
    possibleNow: me.economy.gold >= buffered(40, bufferFactor),
    summary:
      'Handelsunternehmung (mittel) erwerben (Basis: 40 Gold; +10% Puffer empfohlen).',
  });
  candidates.push({
    id: 'action.tradeEnterprise.large',
    kind: 'action',
    command: { type: 'AcquireTradeEnterprise', campaignId: '', tier: 'large' },
    actionKey: 'acquire.trade',
    possibleNow: me.economy.gold >= buffered(80, bufferFactor),
    summary:
      'Handelsunternehmung (gross) erwerben (Basis: 80 Gold; +10% Puffer empfohlen).',
  });

  // Stadtbesitz (alle Stufen)
  candidates.push({
    id: 'action.cityProperty.small',
    kind: 'action',
    command: { type: 'AcquireCityProperty', campaignId: '', tier: 'small' },
    actionKey: 'acquire.cityProperty',
    possibleNow: me.economy.gold >= buffered(15, bufferFactor),
    summary:
      'Stadtbesitz (klein) erwerben (Basis: 15 Gold; +10% Puffer empfohlen).',
  });
  candidates.push({
    id: 'action.cityProperty.medium',
    kind: 'action',
    command: { type: 'AcquireCityProperty', campaignId: '', tier: 'medium' },
    actionKey: 'acquire.cityProperty',
    possibleNow: me.economy.gold >= buffered(25, bufferFactor),
    summary: 'Stadtbesitz (mittel) erwerben (Basis: 25 Gold; +10% Puffer empfohlen).',
  });
  candidates.push({
    id: 'action.cityProperty.large',
    kind: 'action',
    command: { type: 'AcquireCityProperty', campaignId: '', tier: 'large' },
    actionKey: 'acquire.cityProperty',
    possibleNow: me.economy.gold >= buffered(50, bufferFactor),
    summary:
      'Stadtbesitz (gross) erwerben (Basis: 50 Gold; +10% Puffer empfohlen).',
  });

  // Domäne (alle Stufen)
  candidates.push({
    id: 'action.domain.small',
    kind: 'action',
    command: { type: 'AcquireDomain', campaignId: '', tier: 'small' },
    actionKey: 'acquire.domain',
    possibleNow: me.economy.gold >= buffered(35, bufferFactor),
    summary: 'Domäne (klein) erwerben (Basis: 35 Gold; +10% Puffer empfohlen).',
  });
  candidates.push({
    id: 'action.domain.medium',
    kind: 'action',
    command: { type: 'AcquireDomain', campaignId: '', tier: 'medium' },
    actionKey: 'acquire.domain',
    possibleNow: me.economy.gold >= buffered(80, bufferFactor),
    summary:
      'Domäne (mittel) erwerben (Basis: 80 Gold; +10% Puffer empfohlen).',
  });
  candidates.push({
    id: 'action.domain.large',
    kind: 'action',
    command: { type: 'AcquireDomain', campaignId: '', tier: 'large' },
    actionKey: 'acquire.domain',
    possibleNow: me.economy.gold >= buffered(120, bufferFactor),
    summary:
      'Domäne (gross) erwerben (Basis: 120 Gold; +10% Puffer empfohlen).',
  });

  // Organisationen (Unterwelt / Collegien)
  {
    const maxCityTier = Math.max(
      0,
      ...me.holdings.cityProperties.map((c) => postTierRank(c.tier))
    );
    const orgKinds: Array<
      'underworld' | 'collegiumTrade' | 'collegiumCraft' | 'cult' | 'spy'
    > = ['underworld', 'collegiumTrade', 'collegiumCraft', 'cult', 'spy'];

    for (const kind of orgKinds) {
      const existing = me.holdings.organizations.find((o) => o.kind === kind);
      if (existing && existing.tier === 'large') continue;
      const nextTier = !existing
        ? 'small'
        : existing.tier === 'small'
          ? 'medium'
          : 'large';
      const rank = postTierRank(nextTier);
      const base =
        kind === 'cult'
          ? { gold: 10, influence: 6 }
          : kind.startsWith('collegium')
            ? { gold: 20, influence: 2 }
            : { gold: 16, influence: 6 };
      const goldNeeded = buffered(base.gold * rank, bufferFactor);
      const influenceNeeded = buffered(base.influence * rank, bufferFactor);
      const hqOk = maxCityTier >= rank;
      const possibleNow =
        me.economy.gold >= goldNeeded &&
        me.turn.influenceAvailable >= influenceNeeded &&
        hqOk;

      candidates.push({
        id: `action.org.${kind}`,
        kind: 'action',
        command: { type: 'AcquireOrganization', campaignId: '', kind },
        actionKey: `acquire.org.${kind}`,
        possibleNow,
        summary: `${kind} ausbauen (Stufe ${nextTier}; Basis: ${base.gold * rank} Gold, ${base.influence * rank} Einfluss; HQ Stadtbesitz ≥ ${nextTier}).`,
      });
    }
  }

  // Pächter/Anhänger (1/mid/max)
  {
    const pushTenants = (options: {
      idPrefix: string;
      location: { kind: 'domain' | 'cityProperty' | 'organization'; id: string };
      current: number;
      max: number;
      goldPerLevel: number;
      influencePerLevel: number;
      label: string;
    }) => {
      const remaining = options.max - options.current;
      if (remaining <= 0) return;
      for (const levels of pickBudgetOptions(remaining)) {
        const goldNeeded = buffered(levels * options.goldPerLevel, bufferFactor);
        const influenceNeeded = buffered(
          levels * options.influencePerLevel,
          bufferFactor
        );
        const possibleNow =
          me.economy.gold >= goldNeeded &&
          me.turn.influenceAvailable >= influenceNeeded;
        candidates.push({
          id: `${options.idPrefix}.${options.location.id}.+${levels}`,
          kind: 'action',
          command: {
            type: 'AcquireTenants',
            campaignId: '',
            location: options.location,
            levels,
          },
          actionKey: 'acquire.tenants',
          possibleNow,
          summary: `${options.label} +${levels} (Basis: ${levels * options.goldPerLevel} Gold, ${levels * options.influencePerLevel} Einfluss; +10% Puffer empfohlen).`,
        });
      }
    };

    const city = citiesByTier.find((c) => {
      const cap = c.tier === 'small' ? 2 : c.tier === 'medium' ? 3 : 4;
      return c.tenants.levels < cap;
    });
    if (city) {
      const cap = city.tier === 'small' ? 2 : city.tier === 'medium' ? 3 : 4;
      pushTenants({
        idPrefix: 'action.tenants.city',
        location: { kind: 'cityProperty', id: city.id },
        current: city.tenants.levels,
        max: cap,
        goldPerLevel: 12,
        influencePerLevel: 4,
        label: `Pächter Stadtbesitz ${city.id}`,
      });
    }

    const domain = domainsByTier.find((d) => {
      if (d.tier === 'starter') return false;
      const cap = d.tier === 'small' ? 2 : d.tier === 'medium' ? 4 : 8;
      return d.tenants.levels < cap;
    });
    if (domain) {
      const cap = domain.tier === 'small' ? 2 : domain.tier === 'medium' ? 4 : 8;
      pushTenants({
        idPrefix: 'action.tenants.domain',
        location: { kind: 'domain', id: domain.id },
        current: domain.tenants.levels,
        max: cap,
        goldPerLevel: 12,
        influencePerLevel: 4,
        label: `Pächter Domäne ${domain.id}`,
      });
    }

    const org = me.holdings.organizations.find(
      (o) => o.kind !== 'spy' && o.followers.levels >= 0
    );
    if (org) {
      const rank = postTierRank(org.tier);
      let max = rank;
      let goldPerLevel = 12;
      let influencePerLevel = 4;
      if (org.kind === 'underworld') {
        max = 2 * rank;
        goldPerLevel = 12;
        influencePerLevel = 10;
      } else if (org.kind === 'cult') {
        max = rank === 1 ? 2 : rank === 2 ? 4 : 8;
        goldPerLevel = 8;
        influencePerLevel = 8;
      }
      if (org.followers.levels < max) {
        pushTenants({
          idPrefix: `action.followers.${org.kind}`,
          location: { kind: 'organization', id: org.id },
          current: org.followers.levels,
          max,
          goldPerLevel,
          influencePerLevel,
          label: `Anhaenger ${org.kind} ${org.id}`,
        });
      }
    }
  }

  return dedupeCandidates(candidates);
}

function ruleCheatSheet(): string {
  return [
    'Regelhinweise (v1, stark verkürzt):',
    '- Zielwertung: Gold + Inventarwert + Assets + Einfluss (grob).',
    '- Pro Runde: 2 Aktionen + 1 freie Einrichtungs-/Ausbauaktion (Sonderaktion).',
    '- Pro Runde je ActionKey nur 1x (Ausnahme: Einfluss-Bonusaktionen, falls verfügbar).',
    '- Rohmaterial/Sondermaterial wird am Rundenende auto-konvertiert (RM 4:1, SM 1:2), außer gelagert.',
    '- Verkauf: je 6 RM oder 1 SM = 1 Investment; Marktsystem kann Wert pro Investment verändern.',
    '- Fehlschlag bei Erwerb-Posten (Domäne/Stadt/Ämter/Circel/Truppen/Pächter): Aktion verbraucht, Ressourcen bleiben erhalten.',
    '- Check-Bonus skaliert: Basis +1 ab Runde 10, 20, 30 (effektiv = base + floor(Runde/10)).',
  ].join('\n');
}

function summarizeIds(ids: string[], limit = 20): string {
  const shown = ids.slice(0, limit);
  return ids.length <= limit
    ? shown.join(', ')
    : `${shown.join(', ')}, … (+${ids.length - limit})`;
}

export async function planFacilityWithLlm(options: {
  model: LanguageModel;
  agentName: string;
  me: PlayerState;
  round: number;
  publicLog: string[];
  systemPreamble?: string;
  strategyCard?: StrategyCard;
  recentSummaries?: string[];
  market: CampaignMarketLike;
}): Promise<LlmFacilityPlan> {
  const bufferFactor = bufferFactorForStrategy(
    options.strategyCard,
    options.systemPreamble
  );
  const facilityCandidates = buildFacilityCandidates(options.me, bufferFactor);
  const possibleFacilities = facilityCandidates.filter((c) => c.possibleNow);
  if (possibleFacilities.length === 0) {
    return { facility: null, note: null };
  }

  const system = [
    options.systemPreamble?.trim(),
    'Du bist ein Spieler-Agent im Myranor Aufbausystem.',
    'Du darfst nur Candidate-IDs aus der Liste auswählen (keine eigenen Commands erfinden).',
    'Ziel: Maximiere deinen Gesamt-Score (Gold + Assets + Einfluss).',
    'Wähle genau eine Facility-Candidate-ID oder null (Sonderaktion).',
    'Diese Sonderaktion wird nur einmal pro Runde abgefragt.',
    'Wähle ausschließlich IDs aus dieser Liste; kopiere sie exakt (keine eigenen Zahlen/Varianten).',
    'Bevorzuge Kandidaten mit [now]; wähle [later?] nur wenn keine [now] existieren.',
    'Antworte auf Deutsch, im JSON Format.',
    ruleCheatSheet(),
  ]
    .filter(Boolean)
    .join('\n\n');

  const promptLines: string[] = [];
  promptLines.push(`Spieler: ${options.agentName}`);
  promptLines.push(`Runde: ${options.round} (Phase: actions, Sonderaktion)`);
  if (options.systemPreamble) {
    promptLines.push(`Strategie: ${options.systemPreamble}`);
  }
  promptLines.push('Ziel: Maximiere Gesamt-Score (Strategie beachten).');
  promptLines.push('');

  if (options.strategyCard) {
    promptLines.push('Strategie-Card:');
    for (const line of formatStrategyCard(options.strategyCard)) {
      promptLines.push(`- ${line}`);
    }
    promptLines.push('');
  }

  if (options.recentSummaries && options.recentSummaries.length > 0) {
    promptLines.push('Letzte Runden (Kurz):');
    for (const line of options.recentSummaries) {
      promptLines.push(`- ${line}`);
    }
    promptLines.push('');
  }
  promptLines.push('Dein Zustand:');
  promptLines.push(formatPlayerState({ me: options.me, round: options.round }));
  promptLines.push('');

  const marketLines = formatMarketSnapshot(options.me, options.market);
  promptLines.push('Markt (deine Optionen):');
  for (const line of marketLines) {
    promptLines.push(`- ${line}`);
  }
  promptLines.push('');

  if (options.publicLog.length > 0) {
    promptLines.push('Öffentliches Log (neu):');
    for (const line of options.publicLog.slice(-12)) {
      promptLines.push(`- ${line}`);
    }
    promptLines.push('');
  }

  promptLines.push('Facility-Candidates:');
  for (const c of possibleFacilities) {
    const possible = c.possibleNow ? 'now' : 'later?';
    promptLines.push(`- ${c.id} [${possible}]: ${c.summary}`);
  }

  const maxPlanAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxPlanAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      llmEnv.MYRANOR_LLM_TIMEOUT_MS
    );
    let raw: z.infer<typeof facilityDecisionSchema>;
    try {
      const attemptPrompt = [
        ...promptLines,
        attempt > 1 && lastError
          ? `\nACHTUNG: Deine letzte Antwort war ungültig: ${lastError.message}\nAntworte erneut mit korrekter Facility-ID (nur [now]) oder null.`
          : null,
      ]
        .filter(Boolean)
        .join('\n');

      const res = await generateText({
        model: options.model,
        output: Output.object({ schema: facilityDecisionSchema }),
        system,
        prompt: attemptPrompt,
        providerOptions: {
          google: {
            thinkingConfig: {
              // thinkingLevel: 'high',
              thinkingBudget: 0,
              includeThoughts: false,
            },
          } satisfies GoogleGenerativeAIProviderOptions,
        },
        maxRetries: 2,
        abortSignal: controller.signal,
      });

      raw = res.output as z.infer<typeof facilityDecisionSchema>;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(
        `[LLM] ${options.agentName} R${options.round} facility: ${err.message}`
      );
    } finally {
      clearTimeout(timeout);
    }

    try {
      const facilityId = raw.facilityCandidateId;
      if (
        facilityId != null &&
        !facilityCandidates.some((c) => c.id === facilityId)
      ) {
        throw new Error(
          `unknown facilityCandidateId "${facilityId}". Valid: ${summarizeIds(
            facilityCandidates.map((c) => c.id)
          )}`
        );
      }
      if (
        facilityId != null &&
        !facilityCandidates.find((c) => c.id === facilityId)?.possibleNow
      ) {
        throw new Error(`facilityCandidateId "${facilityId}" is not [now]`);
      }

      const facility =
        facilityId == null
          ? null
          : (facilityCandidates.find((c) => c.id === facilityId)?.command ??
              null);

      return {
        facility,
        note: raw.note?.trim() ? raw.note.trim() : null,
        debug: llmEnv.MYRANOR_LLM_DEBUG
          ? {
              facilityCandidates,
              rawModelOutput: raw,
            }
          : undefined,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxPlanAttempts) {
        throw new Error(
          `[LLM] ${options.agentName} R${options.round} facility: ${lastError.message}`
        );
      }
    }
  }

  throw new Error(
    `[LLM] ${options.agentName} R${options.round} facility: unable to produce a valid plan.`
  );
}

export async function planActionWithLlm(options: {
  model: LanguageModel;
  agentName: string;
  me: PlayerState;
  round: number;
  actionSlot: number;
  actionsPerRound: number;
  publicLog: string[];
  systemPreamble?: string;
  strategyCard?: StrategyCard;
  recentSummaries?: string[];
  market: CampaignMarketLike;
  roundActionLog: string[];
  facilityLog?: string | null;
}): Promise<LlmActionPlan> {
  const bufferFactor = bufferFactorForStrategy(
    options.strategyCard,
    options.systemPreamble
  );
  const actionCandidates = buildActionCandidates({
    round: options.round,
    me: options.me,
    state: { market: options.market },
    bufferFactor,
  });
  const allowedCandidates = filterActionCandidates(
    options.me,
    actionCandidates
  );
  if (allowedCandidates.length === 0) {
    return { action: null, note: null };
  }

  const heuristicTempInfluence = pickTempInfluenceForOffice({
    me: options.me,
    actionsPerRound: options.actionsPerRound,
    candidates: allowedCandidates,
    strategyCard: options.strategyCard,
    systemPreamble: options.systemPreamble,
    bufferFactor,
  });
  if (heuristicTempInfluence) {
    return {
      action: heuristicTempInfluence.command,
      note: 'heuristic: temp influence to unlock office',
      debug: llmEnv.MYRANOR_LLM_DEBUG
        ? { actionCandidates: allowedCandidates, rawModelOutput: null }
        : undefined,
    };
  }

  const system = [
    options.systemPreamble?.trim(),
    'Du bist ein Spieler-Agent im Myranor Aufbausystem.',
    'Du darfst nur Candidate-IDs aus der Liste auswählen (keine eigenen Commands erfinden).',
    'Ziel: Maximiere deinen Gesamt-Score (Gold + Assets + Einfluss).',
    'Wähle genau eine Action-Candidate-ID aus der Liste.',
    'Du planst sequentiell: Nach jeder Aktion wirst du erneut gefragt. Wähle nur die beste nächste Aktion.',
    'Wähle ausschließlich IDs aus dieser Liste; kopiere sie exakt (keine eigenen Zahlen/Varianten).',
    'Antworte auf Deutsch, im JSON Format.',
    ruleCheatSheet(),
  ]
    .filter(Boolean)
    .join('\n\n');

  const promptLines: string[] = [];
  promptLines.push(`Spieler: ${options.agentName}`);
  promptLines.push(`Runde: ${options.round} (Phase: actions)`);
  promptLines.push(`Action-Slot: ${options.actionSlot}`);
  if (options.systemPreamble) {
    promptLines.push(`Strategie: ${options.systemPreamble}`);
  }
  promptLines.push('Ziel: Maximiere Gesamt-Score (Strategie beachten).');
  promptLines.push('');
  if (options.strategyCard) {
    promptLines.push('Strategie-Card:');
    for (const line of formatStrategyCard(options.strategyCard)) {
      promptLines.push(`- ${line}`);
    }
    promptLines.push('');
  }

  if (options.recentSummaries && options.recentSummaries.length > 0) {
    promptLines.push('Letzte Runden (Kurz):');
    for (const line of options.recentSummaries) {
      promptLines.push(`- ${line}`);
    }
    promptLines.push('');
  }
  promptLines.push('Dein Zustand:');
  promptLines.push(formatPlayerState({ me: options.me, round: options.round }));
  promptLines.push(formatActionCapacity(options.me, options.actionsPerRound));
  promptLines.push('');

  const marketLines = formatMarketSnapshot(options.me, options.market);
  promptLines.push('Markt (deine Optionen):');
  for (const line of marketLines) {
    promptLines.push(`- ${line}`);
  }
  promptLines.push('');

  if (options.facilityLog) {
    promptLines.push(`Sonderaktion diese Runde: ${options.facilityLog}`);
    promptLines.push('');
  }

  if (options.roundActionLog.length > 0) {
    promptLines.push('Deine Aktionen diese Runde (bisher):');
    for (const line of options.roundActionLog.slice(-6)) {
      promptLines.push(`- ${line}`);
    }
    promptLines.push('');
  }

  if (options.publicLog.length > 0) {
    promptLines.push('Öffentliches Log (neu):');
    for (const line of options.publicLog.slice(-12)) {
      promptLines.push(`- ${line}`);
    }
    promptLines.push('');
  }

  promptLines.push('Action-Candidates:');
  for (const c of allowedCandidates) {
    promptLines.push(`- ${c.id} [now]: ${c.summary}`);
  }

  const maxPlanAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxPlanAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      llmEnv.MYRANOR_LLM_TIMEOUT_MS
    );
    let raw: z.infer<typeof actionDecisionSchema>;
    try {
      const attemptPrompt = [
        ...promptLines,
        attempt > 1 && lastError
          ? `\nACHTUNG: Deine letzte Antwort war ungültig: ${lastError.message}\nAntworte erneut mit einer gültigen Action-ID (nur [now]).`
          : null,
      ]
        .filter(Boolean)
        .join('\n');

      const res = await generateText({
        model: options.model,
        output: Output.object({ schema: actionDecisionSchema }),
        system,
        prompt: attemptPrompt,
        providerOptions: {
          google: {
            thinkingConfig: {
              // thinkingLevel: 'high',
              thinkingBudget: 0,
              includeThoughts: false,
            },
          } satisfies GoogleGenerativeAIProviderOptions,
        },
        maxRetries: 2,
        abortSignal: controller.signal,
      });

      raw = res.output as z.infer<typeof actionDecisionSchema>;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(
        `[LLM] ${options.agentName} R${options.round} A${options.actionSlot}: ${err.message}`
      );
    } finally {
      clearTimeout(timeout);
    }

    try {
      const actionId = raw.actionCandidateId;
      const actionCandidate = allowedCandidates.find((c) => c.id === actionId);
      if (!actionCandidate) {
        throw new Error(
          `unknown actionCandidateId "${actionId}". Valid: ${summarizeIds(
            allowedCandidates.map((c) => c.id)
          )}`
        );
      }

      return {
        action: actionCandidate.command,
        note: raw.note?.trim() ? raw.note.trim() : null,
        debug: llmEnv.MYRANOR_LLM_DEBUG
          ? {
              actionCandidates: allowedCandidates,
              rawModelOutput: raw,
            }
          : undefined,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxPlanAttempts) {
        throw new Error(
          `[LLM] ${options.agentName} R${options.round} A${options.actionSlot}: ${lastError.message}`
        );
      }
    }
  }

  throw new Error(
    `[LLM] ${options.agentName} R${options.round} A${options.actionSlot}: unable to produce a valid plan.`
  );
}

export function toGameCommand(command: AgentCommand, campaignId: string) {
  return { ...command, campaignId } as GameCommand;
}

export function actionKeyOf(command: AgentCommand): string | null {
  return expectedActionKey(command);
}

function expectedActionKey(command: AgentCommand): string | null {
  switch (command.type) {
    case 'GainMaterials':
      return command.mode === 'domainAdministration'
        ? 'materials.domain'
        : 'materials.workshop';
    case 'GainInfluence':
      return 'influence';
    case 'MoneyLend':
      return 'money.lend';
    case 'MoneySell':
      return 'money.sell';
    case 'MoneyBuy':
      return 'money.buy';
    case 'AcquireDomain':
      return 'acquire.domain';
    case 'AcquireCityProperty':
      return 'acquire.cityProperty';
    case 'AcquireOffice':
      return 'acquire.office';
    case 'AcquireOrganization':
      return `acquire.org.${command.kind}`;
    case 'AcquireTradeEnterprise':
      return 'acquire.trade';
    case 'AcquireTenants':
      return 'acquire.tenants';
    case 'RecruitTroops':
      return `troops.${command.troopKind}`;
    default:
      return null;
  }
}
