import {
  type ActorContext,
  type CampaignState,
  type GameCommand,
  type GameEvent,
  GameRuleError,
  type PlayerChecks,
  type PlayerState,
  asUserId,
  createSeededRng,
  decide,
  reduceEvents,
} from '../core';

import { createLLM } from '../llm';

import {
  type AgentCommand,
  planActionWithLlm,
  planFacilityWithLlm,
  toGameCommand,
} from './llmAgent';
import { getScenario, listScenarioNames } from './scenarios';
import type { StrategyCard } from './types';
import {
  bonusInfluenceSlots,
  bonusMaterialsSlots,
  bonusMoneySlots,
  hasAnyActionCapacity,
} from './turnRules';
import {
  computeNetWorth,
  FULL_NET_WORTH_WEIGHTS,
  type NetWorthBreakdown,
} from './plannerScore';

type CliArgs = {
  rounds: number;
  seed: number;
  scenario: string;
  players: number | null;
  model: string | null;
  out: string | null;
  mdOut: string | null;
  json: boolean;
  pretty: boolean;
  listScenarios: boolean;
  help: boolean;
};

type PlayerProfile = {
  userId: string;
  playerId: string;
  displayName: string;
  checks: PlayerChecks;
  systemPreamble?: string;
  strategyCard?: StrategyCard;
  lastPublicLogIndex: number;
  roundSummaries: RoundSummary[];
};

type RoundSnapshot = {
  gold: number;
  pendingGold: number;
  rawTotal: number;
  specialTotal: number;
  influence: number;
  labor: number;
};

type RoundSummary = {
  round: number;
  actions: string[];
  facility: string | null;
  start: RoundSnapshot;
  end: RoundSnapshot;
  delta: RoundSnapshot;
};

type StepLog = {
  round: number;
  playerId: string;
  playerName: string;
  kind: 'facility' | 'action';
  command: AgentCommand;
  ok: boolean;
  error?: { message: string; code?: string };
  outcome?: { actionKey: string; tier: string };
};

type LlmPlayReport = {
  generatedAt: string;
  config: Pick<CliArgs, 'rounds' | 'seed' | 'scenario' | 'players' | 'model'>;
  players: Array<
    Pick<PlayerProfile, 'userId' | 'playerId' | 'displayName'> & {
      strategyTitle?: string;
    }
  >;
  steps: StepLog[];
  rounds: RoundReport[];
  final: {
    round: number;
    phase: string;
    byPlayer: Array<{
      playerId: string;
      displayName: string;
      gold: number;
      rawTotal: number;
      specialTotal: number;
      scoreTotal: number;
      scoreBreakdown: NetWorthBreakdown;
      ledger: PlayerLedger;
      holdings: {
        domains: Array<{ id: string; tier: string }>;
        cityProperties: Array<{ id: string; tier: string; mode: string }>;
        offices: Array<{ id: string; tier: string; yieldMode: string }>;
        organizations: Array<{ id: string; kind: string; tier: string }>;
        tradeEnterprises: Array<{ id: string; tier: string; mode: string }>;
        workshops: Array<{ id: string; tier: string }>;
        storages: Array<{ id: string; tier: string }>;
      };
    }>;
  };
};

type ActionStats = {
  moneySell: number;
  moneyLend: number;
  gainMaterialsDomain: number;
  gainMaterialsWorkshop: number;
  gainInfluenceTemp: number;
  gainInfluencePerm: number;
  acquireDomain: number;
  acquireCity: number;
  acquireOffice: number;
  acquireTrade: number;
  acquireOrg: number;
  acquireOrgUnderworld: number;
  buildWorkshop: number;
  buildStorage: number;
  upgradeStarterDomain: number;
  setCityMode: number;
  setOfficeMode: number;
  setTradeMode: number;
};

type LedgerTotals = {
  total: number;
  byType: Record<string, number>;
};

type MaterialLedger = {
  rawGained: LedgerTotals;
  specialGained: LedgerTotals;
  rawSpent: LedgerTotals;
  specialSpent: LedgerTotals;
  rawSold: LedgerTotals;
  specialSold: LedgerTotals;
  rawBought: LedgerTotals;
  specialBought: LedgerTotals;
  rawConvertedToGold: LedgerTotals;
  specialConvertedToGold: LedgerTotals;
  rawStored: LedgerTotals;
  specialStored: LedgerTotals;
  rawLost: LedgerTotals;
  specialLost: LedgerTotals;
  rawConsumedByWorkshop: LedgerTotals;
  specialProducedByWorkshop: LedgerTotals;
};

type PlayerLedger = {
  goldGained: LedgerTotals;
  goldSpent: LedgerTotals;
  influenceGained: LedgerTotals;
  influenceSpent: LedgerTotals;
  laborSpent: LedgerTotals;
  materials: MaterialLedger;
};

type RoundReport = {
  round: number;
  byPlayer: Array<{
    playerId: string;
    displayName: string;
    start: RoundSnapshot;
    end: RoundSnapshot;
    actions: string[];
    facility: string | null;
    ledger: PlayerLedger;
  }>;
};

function emptyLedgerTotals(): LedgerTotals {
  return { total: 0, byType: {} };
}

function emptyMaterialLedger(): MaterialLedger {
  return {
    rawGained: emptyLedgerTotals(),
    specialGained: emptyLedgerTotals(),
    rawSpent: emptyLedgerTotals(),
    specialSpent: emptyLedgerTotals(),
    rawSold: emptyLedgerTotals(),
    specialSold: emptyLedgerTotals(),
    rawBought: emptyLedgerTotals(),
    specialBought: emptyLedgerTotals(),
    rawConvertedToGold: emptyLedgerTotals(),
    specialConvertedToGold: emptyLedgerTotals(),
    rawStored: emptyLedgerTotals(),
    specialStored: emptyLedgerTotals(),
    rawLost: emptyLedgerTotals(),
    specialLost: emptyLedgerTotals(),
    rawConsumedByWorkshop: emptyLedgerTotals(),
    specialProducedByWorkshop: emptyLedgerTotals(),
  };
}

function emptyLedger(): PlayerLedger {
  return {
    goldGained: emptyLedgerTotals(),
    goldSpent: emptyLedgerTotals(),
    influenceGained: emptyLedgerTotals(),
    influenceSpent: emptyLedgerTotals(),
    laborSpent: emptyLedgerTotals(),
    materials: emptyMaterialLedger(),
  };
}

function addLedgerAmount(
  totals: LedgerTotals,
  key: string,
  amount: number
): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  totals.total += amount;
  totals.byType[key] = (totals.byType[key] ?? 0) + amount;
}

function sumStockSafe(stock: Record<string, number>): number {
  let sum = 0;
  for (const v of Object.values(stock)) sum += v ?? 0;
  return sum;
}

function addStockTotals(
  totals: LedgerTotals,
  key: string,
  stock: Record<string, number>
): void {
  addLedgerAmount(totals, key, sumStockSafe(stock));
}

function applyEventsToLedger(
  events: GameEvent[],
  ledgerByPlayerId: Map<string, PlayerLedger>
): void {
  const getLedger = (playerId: string) => {
    let ledger = ledgerByPlayerId.get(playerId);
    if (!ledger) {
      ledger = emptyLedger();
      ledgerByPlayerId.set(playerId, ledger);
    }
    return ledger;
  };

  for (const event of events) {
    if (!('playerId' in event)) continue;
    const playerId = (event as { playerId: string }).playerId;
    const ledger = getLedger(playerId);

    switch (event.type) {
      case 'PlayerIncomeApplied': {
        const e = event as Extract<GameEvent, { type: 'PlayerIncomeApplied' }>;
        addLedgerAmount(ledger.goldGained, 'income', e.produced.gold);
        addLedgerAmount(ledger.goldSpent, 'upkeep', e.upkeepPaid.gold);
        addLedgerAmount(
          ledger.goldSpent,
          'eventTaxes',
          e.eventTaxesPaid.gold + e.eventTaxesPaid.oneTimeOfficeTaxGold
        );
        addLedgerAmount(
          ledger.influenceGained,
          'income',
          e.produced.influence
        );
        addStockTotals(ledger.materials.rawSpent, 'upkeep', e.upkeepPaid.raw);
        addStockTotals(
          ledger.materials.specialSpent,
          'upkeep',
          e.upkeepPaid.special
        );
        addStockTotals(ledger.materials.rawGained, 'income', e.produced.raw);
        addStockTotals(
          ledger.materials.specialGained,
          'income',
          e.produced.special
        );
        break;
      }
      case 'PlayerPendingApplied': {
        const e = event as Extract<GameEvent, { type: 'PlayerPendingApplied' }>;
        addLedgerAmount(ledger.goldGained, 'pending', e.goldApplied);
        addStockTotals(ledger.materials.rawGained, 'pending', e.rawApplied);
        addStockTotals(
          ledger.materials.specialGained,
          'pending',
          e.specialApplied
        );
        break;
      }
      case 'PlayerMaterialsConverted': {
        const e = event as Extract<
          GameEvent,
          { type: 'PlayerMaterialsConverted' }
        >;
        addLedgerAmount(
          ledger.goldGained,
          'conversion',
          e.convertedToGold.goldGained
        );
        addStockTotals(
          ledger.materials.rawConvertedToGold,
          'conversion',
          e.convertedToGold.rawByType
        );
        addStockTotals(
          ledger.materials.specialConvertedToGold,
          'conversion',
          e.convertedToGold.specialByType
        );
        addStockTotals(
          ledger.materials.rawStored,
          'storage',
          e.stored.rawStored
        );
        addStockTotals(
          ledger.materials.specialStored,
          'storage',
          e.stored.specialStored
        );
        addStockTotals(ledger.materials.rawLost, 'lost', e.lost.rawLost);
        addStockTotals(
          ledger.materials.specialLost,
          'lost',
          e.lost.specialLost
        );
        addStockTotals(
          ledger.materials.rawConsumedByWorkshop,
          'workshop',
          e.workshop.rawConsumed
        );
        addStockTotals(
          ledger.materials.specialProducedByWorkshop,
          'workshop',
          e.workshop.specialProduced
        );
        break;
      }
      case 'PlayerInfluenceGained': {
        const e = event as Extract<GameEvent, { type: 'PlayerInfluenceGained' }>;
        addLedgerAmount(
          ledger.goldSpent,
          `gain.influence.${e.kind}`,
          e.goldSpent
        );
        addLedgerAmount(
          ledger.influenceGained,
          `gain.influence.${e.kind}`,
          e.influenceGained
        );
        break;
      }
      case 'PlayerMoneyLent': {
        const e = event as Extract<GameEvent, { type: 'PlayerMoneyLent' }>;
        addLedgerAmount(ledger.goldSpent, 'money.lend', e.goldSpent);
        break;
      }
      case 'PlayerMoneySold': {
        const e = event as Extract<GameEvent, { type: 'PlayerMoneySold' }>;
        addLedgerAmount(ledger.goldGained, 'money.sell', e.goldGained);
        let rawSold = 0;
        let specialSold = 0;
        for (const item of e.sold) {
          if (item.kind === 'raw') rawSold += item.count;
          else if (item.kind === 'special') specialSold += item.count;
        }
        addLedgerAmount(ledger.materials.rawSold, 'money.sell', rawSold);
        addLedgerAmount(
          ledger.materials.specialSold,
          'money.sell',
          specialSold
        );
        break;
      }
      case 'PlayerMoneyBought': {
        const e = event as Extract<GameEvent, { type: 'PlayerMoneyBought' }>;
        addLedgerAmount(ledger.goldSpent, 'money.buy', e.goldSpent);
        let rawBought = 0;
        let specialBought = 0;
        for (const item of e.bought) {
          if (item.kind === 'raw') rawBought += item.count;
          else if (item.kind === 'special') specialBought += item.count;
        }
        addLedgerAmount(ledger.materials.rawBought, 'money.buy', rawBought);
        addLedgerAmount(
          ledger.materials.specialBought,
          'money.buy',
          specialBought
        );
        break;
      }
      case 'PlayerMaterialsGained': {
        const e = event as Extract<GameEvent, { type: 'PlayerMaterialsGained' }>;
        addLedgerAmount(
          ledger.laborSpent,
          `materials.${e.mode}`,
          e.laborSpent
        );
        addStockTotals(
          ledger.materials.rawGained,
          `action.${e.mode}`,
          e.rawGained
        );
        addStockTotals(
          ledger.materials.specialGained,
          `action.${e.mode}`,
          e.specialGained
        );
        break;
      }
      case 'PlayerDomainAcquired': {
        const e = event as Extract<GameEvent, { type: 'PlayerDomainAcquired' }>;
        addLedgerAmount(ledger.goldSpent, 'acquire.domain', e.goldSpent);
        break;
      }
      case 'PlayerCityPropertyAcquired': {
        const e = event as Extract<
          GameEvent,
          { type: 'PlayerCityPropertyAcquired' }
        >;
        addLedgerAmount(ledger.goldSpent, 'acquire.city', e.goldSpent);
        break;
      }
      case 'PlayerOfficeAcquired': {
        const e = event as Extract<GameEvent, { type: 'PlayerOfficeAcquired' }>;
        addLedgerAmount(ledger.goldSpent, 'acquire.office', e.goldSpent);
        addLedgerAmount(
          ledger.influenceSpent,
          'acquire.office',
          e.influenceSpent
        );
        break;
      }
      case 'PlayerOrganizationAcquired': {
        const e = event as Extract<
          GameEvent,
          { type: 'PlayerOrganizationAcquired' }
        >;
        addLedgerAmount(ledger.goldSpent, 'acquire.org', e.goldSpent);
        addLedgerAmount(
          ledger.influenceSpent,
          'acquire.org',
          e.influenceSpent
        );
        break;
      }
      case 'PlayerTradeEnterpriseAcquired': {
        const e = event as Extract<
          GameEvent,
          { type: 'PlayerTradeEnterpriseAcquired' }
        >;
        addLedgerAmount(ledger.goldSpent, 'acquire.trade', e.goldSpent);
        break;
      }
      case 'PlayerTenantsAcquired': {
        const e = event as Extract<GameEvent, { type: 'PlayerTenantsAcquired' }>;
        addLedgerAmount(ledger.goldSpent, 'acquire.tenants', e.goldSpent);
        addLedgerAmount(
          ledger.influenceSpent,
          'acquire.tenants',
          e.influenceSpent
        );
        break;
      }
      case 'PlayerTroopsRecruited': {
        const e = event as Extract<GameEvent, { type: 'PlayerTroopsRecruited' }>;
        addLedgerAmount(ledger.goldSpent, 'recruit.troops', e.goldSpent);
        addLedgerAmount(
          ledger.influenceSpent,
          'recruit.troops',
          e.influenceSpent
        );
        addStockTotals(
          ledger.materials.rawSpent,
          'recruit.troops',
          e.rawSpent
        );
        addStockTotals(
          ledger.materials.specialSpent,
          'recruit.troops',
          e.specialSpent
        );
        break;
      }
      case 'PlayerWorkshopBuilt': {
        const e = event as Extract<GameEvent, { type: 'PlayerWorkshopBuilt' }>;
        addLedgerAmount(ledger.goldSpent, 'build.workshop', e.goldSpent);
        break;
      }
      case 'PlayerWorkshopUpgraded': {
        const e = event as Extract<GameEvent, { type: 'PlayerWorkshopUpgraded' }>;
        addLedgerAmount(ledger.goldSpent, 'upgrade.workshop', e.goldSpent);
        break;
      }
      case 'PlayerStorageBuilt': {
        const e = event as Extract<GameEvent, { type: 'PlayerStorageBuilt' }>;
        addLedgerAmount(ledger.goldSpent, 'build.storage', e.goldSpent);
        break;
      }
      case 'PlayerStorageUpgraded': {
        const e = event as Extract<GameEvent, { type: 'PlayerStorageUpgraded' }>;
        addLedgerAmount(ledger.goldSpent, 'upgrade.storage', e.goldSpent);
        break;
      }
      case 'PlayerFacilityBuilt': {
        const e = event as Extract<GameEvent, { type: 'PlayerFacilityBuilt' }>;
        addLedgerAmount(ledger.goldSpent, 'build.facility', e.goldSpent);
        addLedgerAmount(
          ledger.influenceSpent,
          'build.facility',
          e.influenceSpent
        );
        addLedgerAmount(ledger.laborSpent, 'build.facility', e.laborSpent);
        addStockTotals(
          ledger.materials.rawSpent,
          'build.facility',
          e.rawSpent
        );
        addStockTotals(
          ledger.materials.specialSpent,
          'build.facility',
          e.specialSpent
        );
        break;
      }
      case 'PlayerDomainSpecializationSet': {
        const e = event as Extract<
          GameEvent,
          { type: 'PlayerDomainSpecializationSet' }
        >;
        addLedgerAmount(ledger.goldSpent, 'domain.specialization', e.goldSpent);
        addStockTotals(
          ledger.materials.rawSpent,
          'domain.specialization',
          e.rawSpent
        );
        break;
      }
      case 'PlayerStarterDomainUpgraded': {
        const e = event as Extract<
          GameEvent,
          { type: 'PlayerStarterDomainUpgraded' }
        >;
        addLedgerAmount(ledger.goldSpent, 'upgrade.starter', e.goldSpent);
        addLedgerAmount(ledger.laborSpent, 'upgrade.starter', e.laborSpent);
        break;
      }
      case 'PlayerSpecialistHired': {
        const e = event as Extract<GameEvent, { type: 'PlayerSpecialistHired' }>;
        addLedgerAmount(ledger.goldSpent, 'hire.specialist', e.goldSpent);
        break;
      }
      default:
        break;
    }
  }
}

function actionStatsForPlayer(steps: StepLog[], playerId: string): ActionStats {
  const stats: ActionStats = {
    moneySell: 0,
    moneyLend: 0,
    gainMaterialsDomain: 0,
    gainMaterialsWorkshop: 0,
    gainInfluenceTemp: 0,
    gainInfluencePerm: 0,
    acquireDomain: 0,
    acquireCity: 0,
    acquireOffice: 0,
    acquireTrade: 0,
    acquireOrg: 0,
    acquireOrgUnderworld: 0,
    buildWorkshop: 0,
    buildStorage: 0,
    upgradeStarterDomain: 0,
    setCityMode: 0,
    setOfficeMode: 0,
    setTradeMode: 0,
  };

  for (const step of steps) {
    if (step.playerId !== playerId || !step.ok) continue;
    const cmd = step.command;
    switch (cmd.type) {
      case 'MoneySell':
        stats.moneySell += 1;
        break;
      case 'MoneyLend':
        stats.moneyLend += 1;
        break;
      case 'GainMaterials':
        if (cmd.mode === 'domainAdministration') stats.gainMaterialsDomain += 1;
        else stats.gainMaterialsWorkshop += 1;
        break;
      case 'GainInfluence':
        if (cmd.kind === 'permanent') stats.gainInfluencePerm += 1;
        else stats.gainInfluenceTemp += 1;
        break;
      case 'AcquireDomain':
        stats.acquireDomain += 1;
        break;
      case 'AcquireCityProperty':
        stats.acquireCity += 1;
        break;
      case 'AcquireOffice':
        stats.acquireOffice += 1;
        break;
      case 'AcquireTradeEnterprise':
        stats.acquireTrade += 1;
        break;
      case 'AcquireOrganization':
        stats.acquireOrg += 1;
        if (cmd.kind === 'underworld') stats.acquireOrgUnderworld += 1;
        break;
      case 'BuildWorkshop':
        stats.buildWorkshop += 1;
        break;
      case 'BuildStorage':
        stats.buildStorage += 1;
        break;
      case 'UpgradeStarterDomain':
        stats.upgradeStarterDomain += 1;
        break;
      case 'SetCityPropertyMode':
        stats.setCityMode += 1;
        break;
      case 'SetOfficeYieldMode':
        stats.setOfficeMode += 1;
        break;
      case 'SetTradeEnterpriseMode':
        stats.setTradeMode += 1;
        break;
      default:
        break;
    }
  }

  return stats;
}

function strategyKeyFor(
  title: string | undefined,
  fallback: string
): 'office' | 'trade' | 'city' | 'workshop' | 'domain' | 'unknown' {
  const text = `${title ?? ''} ${fallback}`.toLowerCase();
  if (text.includes('amt')) return 'office';
  if (text.includes('handel') || text.includes('geld')) return 'trade';
  if (text.includes('stadt') || text.includes('unterwelt')) return 'city';
  if (text.includes('werkstatt')) return 'workshop';
  if (text.includes('domaen') || text.includes('domain')) return 'domain';
  return 'unknown';
}

function summarizeStrategy(options: {
  player: LlmPlayReport['final']['byPlayer'][number];
  stats: ActionStats;
  key: ReturnType<typeof strategyKeyFor>;
}): { good: string[]; weak: string[] } {
  const { player, stats, key } = options;
  const good: string[] = [];
  const weak: string[] = [];
  const offices = player.holdings.offices.length;
  const cities = player.holdings.cityProperties.length;
  const trades = player.holdings.tradeEnterprises.length;
  const workshops = player.holdings.workshops.length;
  const storages = player.holdings.storages.length;
  const orgs = player.holdings.organizations.length;
  const underworld = player.holdings.organizations.find(
    (o) => o.kind === 'underworld'
  );
  const nonStarterDomains = player.holdings.domains.filter(
    (d) => d.tier !== 'starter'
  ).length;
  const hasProductionCity = player.holdings.cityProperties.some(
    (c) => c.mode === 'production'
  );
  const influenceTotal =
    player.scoreBreakdown.influence + player.scoreBreakdown.permanentInfluence;

  switch (key) {
    case 'office':
      if (offices > 0) good.push(`Aemter aufgebaut: ${offices}`);
      else weak.push('Keine Aemter aufgebaut.');
      if (influenceTotal >= 6)
        good.push(`Einfluss aufgebaut: ${Math.round(influenceTotal)}`);
      else weak.push(`Einfluss niedrig: ${Math.round(influenceTotal)}`);
      if (cities > 0)
        good.push(`Staedtischer Besitz vorhanden: ${cities}`);
      else weak.push('Kein Stadtbesitz fuer Einfluss/Gold.');
      break;
    case 'trade':
      if (stats.moneySell + stats.moneyLend > 0) {
        good.push(
          `Geldaktionen: Sell=${stats.moneySell}, Lend=${stats.moneyLend}`
        );
      } else {
        weak.push('Keine Geldgewinnaktionen genutzt.');
      }
      if (trades > 0) good.push(`Handelsunternehmungen: ${trades}`);
      else weak.push('Keine Handelsunternehmung aufgebaut.');
      if (storages > 0) good.push(`Lager aufgebaut: ${storages}`);
      break;
    case 'city':
      if (cities > 0) good.push(`Staedtischer Besitz: ${cities}`);
      else weak.push('Kein Stadtbesitz aufgebaut.');
      if (underworld)
        good.push(`Unterwelt-Organisation: ${underworld.tier}`);
      else weak.push('Keine Unterwelt-Organisation.');
      if (stats.acquireOrg > 0 && orgs > 0)
        good.push(`Organisationen aufgebaut: ${orgs}`);
      break;
    case 'workshop':
      if (workshops > 0) good.push(`Werkstaetten: ${workshops}`);
      else weak.push('Keine Werkstaetten gebaut.');
      if (hasProductionCity)
        good.push('Produktion im Stadtbesitz aktiv.');
      else weak.push('Kein Stadtbesitz in Produktion.');
      if (stats.gainMaterialsWorkshop > 0)
        good.push(
          `Werkstattaufsicht genutzt: ${stats.gainMaterialsWorkshop}x`
        );
      else weak.push('Werkstattaufsicht nicht genutzt.');
      break;
    case 'domain':
      if (nonStarterDomains > 0)
        good.push(`Domaenen ausgebaut: ${nonStarterDomains}`);
      else weak.push('Keine ausgebaute Domaene.');
      if (stats.gainMaterialsDomain > 0)
        good.push(`Domaenenverwaltung genutzt: ${stats.gainMaterialsDomain}x`);
      else weak.push('Domaenenverwaltung nicht genutzt.');
      if (stats.moneySell > 0)
        good.push(`Verkauf genutzt: ${stats.moneySell}x`);
      else weak.push('Kein Verkauf von RM/SM.');
      break;
    default:
      if (player.scoreTotal > 0)
        good.push(`Score aufgebaut: ${Math.round(player.scoreTotal)}`);
      if (stats.moneySell + stats.moneyLend === 0)
        weak.push('Keine Geldgewinnaktionen genutzt.');
      break;
  }

  if (good.length === 0)
    good.push('Keine klaren Staerken erkannt (kleine Stichprobe).');
  if (weak.length === 0)
    weak.push('Keine klaren Schwaechen erkannt (kleine Stichprobe).');

  return { good, weak };
}

function usage(): string {
  return [
    'LLM Runner (Myranor Aufbausystem, v1)',
    '',
    'Usage:',
    '  bun src/playtest/llm.ts [options]',
    '',
    'Options:',
    '  --rounds <n>        Runden spielen (default: 10)',
    '  --seed <n>          RNG-Seed für Engine (default: 1)',
    '  --scenario <name>   Szenario-Name (default: core-v1-all5)',
    '  --players <n>       Statt Szenario: N generische Spieler (Checks +5)',
    '  --model <id>        Model-ID überschreiben (default via MYRANOR_ANTHROPIC_MODEL)',
    '  --out <file>        Report als JSON schreiben',
    '  --md-out <file>     Report als Markdown schreiben',
    '  --json              Report als JSON nach stdout',
    '  --pretty            JSON pretty-print (Indent=2)',
    '  --list-scenarios    Szenarien auflisten',
    '  --help              Hilfe anzeigen',
    '',
    'Env:',
    '  ANTHROPIC_API_KEY              (required)',
    '  MYRANOR_ANTHROPIC_MODEL        (default: claude-opus-4-5)',
    '',
    'Example:',
    '  bun src/playtest/llm.ts --rounds 20 --seed 42 --scenario core-v1-strategies --out llm-run.json --pretty',
  ].join('\n');
}

function parseIntArg(value: string | undefined, name: string): number {
  if (!value) throw new Error(`Missing value for ${name}`);
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${name}: ${value}`);
  return parsed;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    rounds: 10,
    seed: 1,
    scenario: 'core-v1-all5',
    players: null,
    model: null,
    out: null,
    mdOut: null,
    json: false,
    pretty: false,
    listScenarios: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;

    const [flag, inline] =
      token.startsWith('--') && token.includes('=')
        ? token.split('=', 2)
        : [token, undefined];

    switch (flag) {
      case '--rounds':
        args.rounds = parseIntArg(inline ?? argv[++i], '--rounds');
        break;
      case '--seed':
        args.seed = parseIntArg(inline ?? argv[++i], '--seed');
        break;
      case '--scenario':
        args.scenario = inline ?? argv[++i] ?? args.scenario;
        break;
      case '--players':
        args.players = parseIntArg(inline ?? argv[++i], '--players');
        break;
      case '--model':
        args.model = inline ?? argv[++i] ?? null;
        break;
      case '--out':
        args.out = inline ?? argv[++i] ?? null;
        break;
      case '--md-out':
        args.mdOut = inline ?? argv[++i] ?? null;
        break;
      case '--json':
        args.json = true;
        break;
      case '--pretty':
        args.pretty = true;
        break;
      case '--list-scenarios':
        args.listScenarios = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        if (flag.startsWith('--')) throw new Error(`Unknown flag: ${flag}`);
        break;
    }
  }

  return args;
}

function execute(
  state: CampaignState | null,
  command: GameCommand,
  actor: ActorContext,
  rng: ReturnType<typeof createSeededRng>
): { state: CampaignState | null; events: GameEvent[]; error: Error | null } {
  try {
    const events = decide(state, command, { actor, rng });
    const next = reduceEvents(state, events);
    return { state: next, events, error: null };
  } catch (error) {
    return {
      state,
      events: [],
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

function getPlayerByUserId(state: CampaignState, userId: string) {
  const playerId = state.playerIdByUserId[asUserId(userId)];
  return state.players[playerId];
}

function sumStock(stock: Record<string, number>): number {
  let sum = 0;
  for (const v of Object.values(stock)) sum += v;
  return sum;
}

function snapshotPlayer(me: PlayerState): RoundSnapshot {
  return {
    gold: me.economy.gold,
    pendingGold: me.economy.pending.gold,
    rawTotal: sumStock(me.economy.inventory.raw),
    specialTotal: sumStock(me.economy.inventory.special),
    influence: me.turn.influenceAvailable,
    labor: me.turn.laborAvailable,
  };
}

function diffSnapshot(start: RoundSnapshot, end: RoundSnapshot): RoundSnapshot {
  return {
    gold: end.gold - start.gold,
    pendingGold: end.pendingGold - start.pendingGold,
    rawTotal: end.rawTotal - start.rawTotal,
    specialTotal: end.specialTotal - start.specialTotal,
    influence: end.influence - start.influence,
    labor: end.labor - start.labor,
  };
}

function formatRoundSummary(summary: RoundSummary): string {
  const actions = summary.actions.length > 0 ? summary.actions.join(', ') : 'keine';
  const facility = summary.facility ? `facility=${summary.facility}` : 'facility=none';
  const s = summary.start;
  const e = summary.end;
  return [
    `R${summary.round}: ${facility}; actions=[${actions}]`,
    `gold ${s.gold}->${e.gold}, inv ${s.rawTotal}/${s.specialTotal}->${e.rawTotal}/${e.specialTotal}, inf ${s.influence}->${e.influence}, ak ${s.labor}->${e.labor}`,
  ].join(' | ');
}

function recentSummaryLines(profile: PlayerProfile, limit = 2): string[] {
  return profile.roundSummaries.slice(-limit).map(formatRoundSummary);
}


function extractOutcome(
  events: GameEvent[]
): { actionKey: string; tier: string } | null {
  for (const e of events) {
    switch (e.type) {
      case 'PlayerMaterialsGained':
        return { actionKey: e.actionKey, tier: e.tier };
      case 'PlayerInfluenceGained':
        return { actionKey: e.actionKey, tier: e.tier };
      case 'PlayerMoneyLent':
        return { actionKey: e.actionKey, tier: e.tier };
      case 'PlayerMoneySold':
        return { actionKey: e.actionKey, tier: e.tier };
      case 'PlayerMoneyBought':
        return { actionKey: e.actionKey, tier: e.tier };
      case 'PlayerDomainAcquired':
      case 'PlayerCityPropertyAcquired':
      case 'PlayerOfficeAcquired':
      case 'PlayerOrganizationAcquired':
      case 'PlayerTradeEnterpriseAcquired':
      case 'PlayerTenantsAcquired':
      case 'PlayerTroopsRecruited':
        return { actionKey: e.actionKey, tier: e.tierResult };
      default:
        break;
    }
  }
  return null;
}

function formatMarkdown(report: LlmPlayReport): string {
  const lines: string[] = [];
  const fmt = (value: number) =>
    Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  const fmtTotals = (
    totals: LedgerTotals,
    limit = 6,
    multiline = false
  ) => {
    const entries = Object.entries(totals.byType)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([key, value]) => `${key}=${fmt(value)}`);
    const detail =
      entries.length > 0
        ? ` [${entries.join(multiline ? '<br>' : ', ')}]`
        : '';
    return `${fmt(totals.total)}${detail}`;
  };
  const fmtTotalsCell = (totals: LedgerTotals, limit = 4) =>
    fmtTotals(totals, limit, true);
  const joinLines = (items: string[]) =>
    items.filter((item) => item.trim().length > 0).join('<br>');
  const escapeCell = (value: string) => value.replace(/\|/g, '\\|');
  const pushTable = (headers: string[], rows: string[][]) => {
    lines.push(`| ${headers.map(escapeCell).join(' | ')} |`);
    lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
    for (const row of rows) {
      lines.push(`| ${row.map(escapeCell).join(' | ')} |`);
    }
  };
  lines.push(`# LLM-Play Report — ${report.config.scenario}`);
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(
    `Config: rounds=${report.config.rounds}, seed=${report.config.seed}, model=${report.config.model ?? '(default)'}`
  );
  lines.push('');

  lines.push('## Finale Uebersicht');
  {
    const rows = report.final.byPlayer.map((p) => {
      const offices = p.holdings.offices.length;
      const orgs = p.holdings.organizations.length;
      const domains = p.holdings.domains.length;
      const cities = p.holdings.cityProperties.length;
      const trades = p.holdings.tradeEnterprises.length;
      const workshops = p.holdings.workshops.length;
      const storages = p.holdings.storages.length;
      const holdings = `dom=${domains} city=${cities} office=${offices} org=${orgs} trade=${trades} ws=${workshops} store=${storages}`;
      return [
        p.displayName,
        `${fmt(p.scoreTotal)}`,
        `${p.gold}`,
        `${fmt(p.scoreBreakdown.inventoryGoldEq)}`,
        `${p.scoreBreakdown.influence} (perm ${p.scoreBreakdown.permanentInfluence})`,
        `${fmt(p.scoreBreakdown.assetsGoldEq)}`,
        holdings,
      ];
    });
    pushTable(
      [
        'Strategie',
        'Score',
        'Gold',
        'Inv≈',
        'Einfluss (perm)',
        'Assets≈',
        'Holdings',
      ],
      rows
    );
  }
  lines.push('');

  lines.push('## Gesamt-Oekonomie');
  {
    const rows = report.final.byPlayer.map((p) => [
      p.displayName,
      fmtTotalsCell(p.ledger.goldGained),
      fmtTotalsCell(p.ledger.goldSpent),
      fmtTotalsCell(p.ledger.influenceGained),
      fmtTotalsCell(p.ledger.influenceSpent),
      fmtTotalsCell(p.ledger.laborSpent),
    ]);
    pushTable(
      [
        'Strategie',
        'Gold +',
        'Gold -',
        'Einfluss +',
        'Einfluss -',
        'AK -',
      ],
      rows
    );
  }
  lines.push('');

  lines.push('## Materialfluss (Gesamt)');
  {
    const rows = report.final.byPlayer.map((p) => {
      const m = p.ledger.materials;
      return [
        p.displayName,
        fmtTotalsCell(m.rawGained),
        fmtTotalsCell(m.rawSold),
        fmtTotalsCell(m.rawConvertedToGold),
        fmtTotalsCell(m.rawStored),
        fmtTotalsCell(m.rawLost),
        fmtTotalsCell(m.specialGained),
        fmtTotalsCell(m.specialSold),
        fmtTotalsCell(m.specialConvertedToGold),
        fmtTotalsCell(m.specialStored),
        fmtTotalsCell(m.specialLost),
      ];
    });
    pushTable(
      [
        'Strategie',
        'RM +',
        'RM sold',
        'RM auto',
        'RM stored',
        'RM lost',
        'SM +',
        'SM sold',
        'SM auto',
        'SM stored',
        'SM lost',
      ],
      rows
    );
  }
  lines.push('');

  lines.push('## Strategie-Auswertung');
  const strategyByPlayerId = new Map(
    report.players.map((p) => [p.playerId, p.strategyTitle])
  );
  for (const p of report.final.byPlayer) {
    const stats = actionStatsForPlayer(report.steps, p.playerId);
    const strategyTitle =
      strategyByPlayerId.get(p.playerId) ?? p.displayName;
    const key = strategyKeyFor(strategyTitle, p.displayName);
    const summary = summarizeStrategy({ player: p, stats, key });
    lines.push(`### ${p.displayName}`);
    lines.push(`- Gut: ${summary.good.join(' | ')}`);
    lines.push(`- Weniger gut: ${summary.weak.join(' | ')}`);
  }
  lines.push('');

  lines.push('## Rundenprotokoll pro Strategie');
  const roundsByPlayerId = new Map<
    string,
    Array<RoundReport['byPlayer'][number] & { round: number }>
  >();
  for (const round of report.rounds) {
    for (const p of round.byPlayer) {
      const list = roundsByPlayerId.get(p.playerId) ?? [];
      list.push({ ...p, round: round.round });
      roundsByPlayerId.set(p.playerId, list);
    }
  }

  for (const p of report.final.byPlayer) {
    const strategyTitle = strategyByPlayerId.get(p.playerId);
    lines.push(`### ${p.displayName}`);
    if (strategyTitle) lines.push(`Strategie: ${strategyTitle}`);
    lines.push('');
    pushTable(
      [
        'Runde',
        'Facility',
        'Aktionen',
        'State',
        'Gold +',
        'Gold -',
        'Einfluss +',
        'Einfluss -',
        'AK -',
        'RM Fluss',
        'SM Fluss',
      ],
      (roundsByPlayerId.get(p.playerId) ?? []).map((r) => {
        const actions = r.actions.length > 0 ? joinLines(r.actions) : '-';
        const facility = r.facility ?? '-';
        const stateCell = joinLines([
          `Gold ${r.start.gold}->${r.end.gold} (pending ${r.start.pendingGold}->${r.end.pendingGold})`,
          `RM ${r.start.rawTotal}->${r.end.rawTotal}`,
          `SM ${r.start.specialTotal}->${r.end.specialTotal}`,
          `Inf ${r.start.influence}->${r.end.influence}`,
          `AK ${r.start.labor}->${r.end.labor}`,
        ]);
        const m = r.ledger.materials;
        const rmFlow = joinLines([
          `+${fmtTotalsCell(m.rawGained)}`,
          `spent=${fmtTotalsCell(m.rawSpent)}`,
          `sold=${fmtTotalsCell(m.rawSold)}`,
          `wk=${fmtTotalsCell(m.rawConsumedByWorkshop)}`,
          `auto=${fmtTotalsCell(m.rawConvertedToGold)}`,
          `stored=${fmtTotalsCell(m.rawStored)}`,
          `lost=${fmtTotalsCell(m.rawLost)}`,
        ]);
        const smFlow = joinLines([
          `+${fmtTotalsCell(m.specialGained)}`,
          `spent=${fmtTotalsCell(m.specialSpent)}`,
          `prod=${fmtTotalsCell(m.specialProducedByWorkshop)}`,
          `sold=${fmtTotalsCell(m.specialSold)}`,
          `auto=${fmtTotalsCell(m.specialConvertedToGold)}`,
          `stored=${fmtTotalsCell(m.specialStored)}`,
          `lost=${fmtTotalsCell(m.specialLost)}`,
        ]);
        return [
          `${r.round}`,
          facility,
          actions,
          stateCell,
          fmtTotalsCell(r.ledger.goldGained),
          fmtTotalsCell(r.ledger.goldSpent),
          fmtTotalsCell(r.ledger.influenceGained),
          fmtTotalsCell(r.ledger.influenceSpent),
          fmtTotalsCell(r.ledger.laborSpent),
          rmFlow,
          smFlow,
        ];
      })
    );
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(usage());
    process.exitCode = 0;
    return;
  }

  if (args.listScenarios) {
    for (const name of listScenarioNames()) console.log(name);
    return;
  }

  const scenario = args.players ? null : getScenario(args.scenario);
  if (!args.players && !scenario) {
    throw new Error(
      `Unknown scenario "${args.scenario}". Available: ${listScenarioNames().join(', ')}`
    );
  }

  const model = createLLM();
  const rng = createSeededRng(args.seed);
  const campaignId = `llm-${args.seed}`;
  const gm: ActorContext = { role: 'gm', userId: 'gm' };

  const profiles: PlayerProfile[] = args.players
    ? Array.from({ length: args.players }, (_, i) => ({
        userId: `u-${i + 1}`,
        playerId: `p-${i + 1}`,
        displayName: `Spieler ${i + 1}`,
        checks: { influence: 3, money: 3, materials: 3 },
        systemPreamble: undefined,
        strategyCard: undefined,
        lastPublicLogIndex: 0,
        roundSummaries: [],
      }))
    : scenario!.players.map((p) => ({
        userId: p.userId,
        playerId: p.playerId,
        displayName: p.displayName,
        checks: p.checks,
        systemPreamble: p.llmPreamble,
        strategyCard: p.strategyCard,
        lastPublicLogIndex: 0,
        roundSummaries: [],
      }));

  const publicLog: string[] = [];
  const steps: StepLog[] = [];
  const ledgerByPlayerId = new Map<string, PlayerLedger>();
  const roundReports: RoundReport[] = [];

  let state: CampaignState | null = null;
  ({ state } = execute(
    state,
    { type: 'CreateCampaign', campaignId, name: args.scenario },
    gm,
    rng
  ));
  if (!state) throw new Error('Campaign create failed');

  for (const p of profiles) {
    const res = execute(
      state,
      {
        type: 'JoinCampaign',
        campaignId,
        playerId: p.playerId,
        displayName: p.displayName,
        checks: p.checks,
      },
      { role: 'player', userId: p.userId },
      rng
    );
    state = res.state;
    if (!state) throw new Error('Join failed');
    for (const e of res.events) {
      if (e.type === 'PublicLogEntryAdded') publicLog.push(e.message);
    }
  }

  for (let round = 1; round <= args.rounds; round += 1) {
    if (!state) break;
    if (state.phase !== 'maintenance')
      throw new Error(
        `Expected maintenance at round ${round}, got ${state.phase}`
      );

    const roundLedgerByPlayerId = new Map<string, PlayerLedger>();
    const applyRoundEvents = (events: GameEvent[]) => {
      applyEventsToLedger(events, ledgerByPlayerId);
      applyEventsToLedger(events, roundLedgerByPlayerId);
    };

    // maintenance -> actions
    {
      const res = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng);
      state = res.state;
      applyRoundEvents(res.events);
      for (const e of res.events) {
        if (e.type === 'PublicLogEntryAdded') publicLog.push(e.message);
      }
    }
    if (!state) break;

    const roundStartSnapshots = new Map<string, RoundSnapshot>();
    const roundActionLogs = new Map<
      string,
      { actions: string[]; facility: string | null }
    >();
    for (const profile of profiles) {
      const me = getPlayerByUserId(state, profile.userId);
      roundStartSnapshots.set(profile.userId, snapshotPlayer(me));
      roundActionLogs.set(profile.userId, { actions: [], facility: null });
    }

    for (const profile of profiles) {
      if (!state) break;
      const actor: ActorContext = { role: 'player', userId: profile.userId };

      const me = getPlayerByUserId(state, profile.userId);
      const newPublicLog = publicLog.slice(profile.lastPublicLogIndex);
      profile.lastPublicLogIndex = publicLog.length;

      const roundLog = roundActionLogs.get(profile.userId) ?? {
        actions: [],
        facility: null,
      };
      roundActionLogs.set(profile.userId, roundLog);
      const roundActionLog = roundLog.actions;
      const recentSummaries = recentSummaryLines(profile);

      const facilityPlan = await planFacilityWithLlm({
        model,
        agentName: profile.displayName,
        me,
        round: state.round,
        publicLog: newPublicLog,
        systemPreamble: profile.systemPreamble,
        strategyCard: profile.strategyCard,
        recentSummaries,
        market: state.market,
      });

      if (facilityPlan.facility) {
        const cmd = toGameCommand(facilityPlan.facility, campaignId);
        const res = execute(state, cmd, actor, rng);
        state = res.state;
        applyRoundEvents(res.events);
        const outcome = extractOutcome(res.events);
        steps.push({
          round,
          playerId: profile.playerId,
          playerName: profile.displayName,
          kind: 'facility',
          command: cmd,
          ok: !res.error,
          error: res.error
            ? {
                message: res.error.message,
                code:
                  res.error instanceof GameRuleError
                    ? res.error.code
                    : undefined,
              }
            : undefined,
          outcome: outcome ?? undefined,
        });
        const outcomeLabel = outcome
          ? `${outcome.actionKey}/${outcome.tier}`
          : '';
        const errorLabel = res.error
          ? ` ERR(${res.error instanceof GameRuleError ? res.error.code : 'ERR'})`
          : '';
        roundLog.facility = `${cmd.type}${outcomeLabel ? ` -> ${outcomeLabel}` : ''}${errorLabel}`;
      }

      const actionsPerRound = state.rules.actionsPerRound;
      let slot = 0;
      let guard = 0;

      while (state) {
        const meNow = getPlayerByUserId(state, profile.userId);
        if (!hasAnyActionCapacity(meNow, actionsPerRound)) break;

        const maxSlotsThisRound =
          actionsPerRound +
          bonusInfluenceSlots(meNow) +
          bonusMoneySlots(meNow) +
          bonusMaterialsSlots(meNow) +
          4;
        if (guard >= maxSlotsThisRound) break;
        guard += 1;
        slot += 1;

        const actionPlan = await planActionWithLlm({
          model,
          agentName: profile.displayName,
          me: meNow,
          round: state.round,
          actionSlot: slot,
          actionsPerRound,
          publicLog: newPublicLog,
          systemPreamble: profile.systemPreamble,
          strategyCard: profile.strategyCard,
          recentSummaries,
          market: state.market,
          roundActionLog,
          facilityLog: roundLog.facility,
        });

        if (!actionPlan.action) break;

        const cmd = toGameCommand(actionPlan.action, campaignId);
        const res = execute(state, cmd, actor, rng);
        state = res.state;
        applyRoundEvents(res.events);

        const outcome = extractOutcome(res.events);
        steps.push({
          round,
          playerId: profile.playerId,
          playerName: profile.displayName,
          kind: 'action',
          command: cmd,
          ok: !res.error,
          error: res.error
            ? {
                message: res.error.message,
                code:
                  res.error instanceof GameRuleError
                    ? res.error.code
                    : undefined,
              }
            : undefined,
          outcome: outcome ?? undefined,
        });

        const outcomeLabel = outcome
          ? `${outcome.actionKey}/${outcome.tier}`
          : '';
        const errorLabel = res.error
          ? ` ERR(${res.error instanceof GameRuleError ? res.error.code : 'ERR'})`
          : '';
        roundActionLog.push(
          `${cmd.type}${outcomeLabel ? ` -> ${outcomeLabel}` : ''}${errorLabel}`
        );
      }
    }

    // actions -> conversion
    {
      const res = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng);
      state = res.state;
      applyRoundEvents(res.events);
    }
    if (!state) break;

    // conversion -> reset
    {
      const res = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng);
      state = res.state;
      applyRoundEvents(res.events);
    }
    if (!state) break;

    // reset -> maintenance
    {
      const res = execute(state, { type: 'AdvancePhase', campaignId }, gm, rng);
      state = res.state;
      applyRoundEvents(res.events);
    }
    if (!state) break;

    const roundReport: RoundReport = { round, byPlayer: [] };
    for (const profile of profiles) {
      const start = roundStartSnapshots.get(profile.userId);
      if (!start) continue;
      const end = snapshotPlayer(getPlayerByUserId(state, profile.userId));
      const log = roundActionLogs.get(profile.userId);
      profile.roundSummaries.push({
        round,
        actions: log?.actions ?? [],
        facility: log?.facility ?? null,
        start,
        end,
        delta: diffSnapshot(start, end),
      });
      if (profile.roundSummaries.length > 3) {
        profile.roundSummaries.splice(0, profile.roundSummaries.length - 3);
      }

      roundReport.byPlayer.push({
        playerId: profile.playerId,
        displayName: profile.displayName,
        start,
        end,
        actions: log?.actions ?? [],
        facility: log?.facility ?? null,
        ledger: roundLedgerByPlayerId.get(profile.playerId) ?? emptyLedger(),
      });
    }

    roundReports.push(roundReport);
  }

  if (!state) throw new Error('Simulation ended without state');

  const report: LlmPlayReport = {
    generatedAt: new Date().toISOString(),
    config: {
      rounds: args.rounds,
      seed: args.seed,
      scenario: args.scenario,
      players: args.players,
      model: args.model,
    },
    players: profiles.map((p) => ({
      userId: p.userId,
      playerId: p.playerId,
      displayName: p.displayName,
      strategyTitle: p.strategyCard?.title,
    })),
    steps,
    rounds: roundReports,
    final: {
      round: state.round,
      phase: state.phase,
      byPlayer: profiles.map((p) => {
        const me = getPlayerByUserId(state!, p.userId);
        const scoreBreakdown = computeNetWorth(
          state!,
          me,
          FULL_NET_WORTH_WEIGHTS
        );
        const ledger = ledgerByPlayerId.get(p.playerId) ?? emptyLedger();
        return {
          playerId: p.playerId,
          displayName: p.displayName,
          gold: me.economy.gold,
          rawTotal: sumStock(me.economy.inventory.raw),
          specialTotal: sumStock(me.economy.inventory.special),
          scoreTotal: scoreBreakdown.score,
          scoreBreakdown,
          ledger,
          holdings: {
            domains: me.holdings.domains.map((d) => ({
              id: d.id,
              tier: d.tier,
            })),
            cityProperties: me.holdings.cityProperties.map((c) => ({
              id: c.id,
              tier: c.tier,
              mode: c.mode,
            })),
            offices: me.holdings.offices.map((o) => ({
              id: o.id,
              tier: o.tier,
              yieldMode: o.yieldMode,
            })),
            organizations: me.holdings.organizations.map((o) => ({
              id: o.id,
              kind: o.kind,
              tier: o.tier,
            })),
            tradeEnterprises: me.holdings.tradeEnterprises.map((t) => ({
              id: t.id,
              tier: t.tier,
              mode: t.mode,
            })),
            workshops: me.holdings.workshops.map((w) => ({
              id: w.id,
              tier: w.tier,
            })),
            storages: me.holdings.storages.map((s) => ({
              id: s.id,
              tier: s.tier,
            })),
          },
        };
      }),
    },
  };

  if (args.out) {
    const json = JSON.stringify(report, null, args.pretty ? 2 : 0);
    await Bun.write(args.out, json);
  }

  if (args.mdOut) {
    await Bun.write(args.mdOut, formatMarkdown(report));
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, args.pretty ? 2 : 0));
    return;
  }

  console.log(formatMarkdown(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.log('');
  console.log(usage());
  process.exitCode = 1;
});
