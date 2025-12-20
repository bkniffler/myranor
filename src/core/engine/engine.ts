import {
  asCampaignId,
  asPlayerId,
  asUserId,
  type PlayerId,
} from '../domain/ids';
import type { Phase } from '../domain/phase';
import { resolveSuccessTier } from '../domain/success';
import type {
  CampaignRules,
  CampaignState,
  CityPropertyMode,
  CityPropertyTier,
  DomainTier,
  MaterialKind,
  MaterialStock,
  PlayerChecks,
  PlayerHoldings,
  PlayerState,
  PlayerTurn,
  PostTier,
  StorageTier,
  WorkshopTier,
} from '../domain/types';
import type { GameCommand } from '../commands/types';
import type { GameEvent } from '../events/types';
import {
  DEFAULT_CAMPAIGN_RULES,
  RULES_VERSION,
  baseInfluencePerRound,
  baseLaborTotal,
  officesIncomePerRound,
  startingMarketState,
  startingPlayerChecks,
  startingPlayerEconomy,
  startingPlayerHoldings,
  startingPlayerTurn,
  domainRawPerRound,
  storageCapacity,
  storageUpkeep,
  workshopCapacity,
  workshopUpkeep,
} from '../rules/v1';
import { getMaterialOrThrow } from '../rules/materials_v1';
import { rollSectionEvents, isSectionStartRound } from '../rules/events_v1';
import { marketStateFromRoll, rollMarketInstances } from '../rules/market_v1';
import {
  moneyActionMods,
  isDeneraRiotTriggered,
  officeIncomeMods as computeOfficeIncomeMods,
  rawAutoConvertDivisor,
  marketDeltaPerInvestment,
  saleBonusGoldForAction,
  taxGoldPerRound,
  workshopUpkeepMods as computeWorkshopUpkeepMods,
} from '../rules/eventModifiers_v1';
import { rollDice, rollD20 } from '../util/dice';
import type { Rng } from '../util/rng';
import { GameRuleError } from './errors';

export type ActorContext =
  | { role: 'gm'; userId: string }
  | { role: 'player'; userId: string };

export type EngineContext = {
  actor: ActorContext;
  rng: Rng;
  // Optional: allow simulations to suppress noisy PublicLogEntry events.
  emitPublicLogs?: boolean;
};

function assertPhase(state: CampaignState, phase: Phase): void {
  if (state.phase !== phase) {
    throw new GameRuleError(
      'PHASE',
      `Aktion nur in Phase "${phase}" möglich (aktuell: "${state.phase}").`,
    );
  }
}

function assertGm(state: CampaignState, actor: ActorContext): void {
  if (actor.role !== 'gm') throw new GameRuleError('AUTH', 'GM erforderlich.');
  if (asUserId(actor.userId) !== state.gmUserId) {
    throw new GameRuleError('AUTH', 'Nur der GM darf diese Aktion ausführen.');
  }
}

function getActingPlayerIdOrThrow(
  state: CampaignState,
  actor: ActorContext,
): PlayerId {
  const userId = asUserId(actor.userId);
  const playerId = state.playerIdByUserId[userId];
  if (!playerId) {
    throw new GameRuleError('AUTH', 'Spieler ist nicht Teil dieser Kampagne.');
  }
  return playerId;
}

function nextPhase(phase: Phase): Phase {
  switch (phase) {
    case 'maintenance':
      return 'actions';
    case 'actions':
      return 'conversion';
    case 'conversion':
      return 'reset';
    case 'reset':
      return 'maintenance';
  }
}

function roundAfterPhaseAdvance(round: number, from: Phase, to: Phase): number {
  if (from === 'reset' && to === 'maintenance') return round + 1;
  return round;
}

function normalizeChecks(input: PlayerChecks): PlayerChecks {
  const checks: PlayerChecks = {
    influence: Math.trunc(input.influence),
    money: Math.trunc(input.money),
    materials: Math.trunc(input.materials),
  };
  for (const [key, value] of Object.entries(checks)) {
    if (!Number.isFinite(value) || value < -5 || value > 15) {
      throw new GameRuleError('INPUT', `Ungültiger Check-Bonus für ${key}.`);
    }
  }
  return checks;
}

function investmentDcModifier(investments: number): number {
  if (investments >= 8) return 8;
  if (investments >= 4) return 4;
  return 0;
}

function roundCheckBonus(round: number): number {
  return Math.floor(Math.max(1, round) / 10);
}

function effectiveCheck(base: number, round: number): number {
  return base + roundCheckBonus(round);
}

function addStock(target: MaterialStock, add: MaterialStock): MaterialStock {
  const next: MaterialStock = { ...target };
  for (const [k, v] of Object.entries(add)) {
    if (!v) continue;
    next[k] = (next[k] ?? 0) + v;
    if (next[k] <= 0) delete next[k];
  }
  return next;
}

function subtractStock(target: MaterialStock, sub: MaterialStock): MaterialStock {
  const next: MaterialStock = { ...target };
  for (const [k, v] of Object.entries(sub)) {
    if (!v) continue;
    next[k] = (next[k] ?? 0) - v;
    if (next[k] <= 0) delete next[k];
  }
  return next;
}

function sumStock(stock: MaterialStock): number {
  let sum = 0;
  for (const value of Object.values(stock)) sum += value;
  return sum;
}

function materialTierRank(tier: string): number {
  switch (tier) {
    case 'cheap':
      return 1;
    case 'basic':
      return 2;
    case 'expensive':
      return 3;
    default:
      return 2;
  }
}

function takeFromStock(
  stock: MaterialStock,
  amount: number,
  materialIdOrder: (ids: string[]) => string[],
): { taken: MaterialStock; remaining: MaterialStock } {
  let remainingToTake = Math.max(0, Math.trunc(amount));
  if (remainingToTake <= 0) return { taken: {}, remaining: stock };

  const remaining: MaterialStock = { ...stock };
  const taken: MaterialStock = {};
  const ids = materialIdOrder(Object.keys(stock));

  for (const materialId of ids) {
    if (remainingToTake <= 0) break;
    const available = remaining[materialId] ?? 0;
    if (available <= 0) continue;
    const take = Math.min(available, remainingToTake);
    remainingToTake -= take;
    taken[materialId] = (taken[materialId] ?? 0) + take;
    remaining[materialId] = available - take;
    if (remaining[materialId] <= 0) delete remaining[materialId];
  }

  return { taken, remaining };
}

export function applyEvent(
  state: CampaignState | null,
  event: GameEvent,
): CampaignState {
  switch (event.type) {
    case 'CampaignCreated': {
      return {
        id: event.campaignId,
        name: event.name,
        rulesVersion: event.rulesVersion,
        rules: event.rules,
        round: event.round,
        phase: event.phase,
        gmUserId: event.gmUserId,
        market: startingMarketState(event.round),
        globalEvents: [],
        players: {},
        playerIdByUserId: {},
      };
    }
    default: {
      if (!state) throw new Error(`Cannot apply ${event.type} without state`);
    }
  }

  switch (event.type) {
    case 'PlayerJoined': {
      const existing = state.playerIdByUserId[event.userId];
      if (existing) return state;
      const player: PlayerState = {
        id: event.playerId,
        userId: event.userId,
        displayName: event.displayName,
        checks: startingPlayerChecks(),
        holdings: startingPlayerHoldings(),
        economy: startingPlayerEconomy(),
        turn: startingPlayerTurn(startingPlayerHoldings(), state.rules),
        privateNotes: [],
      };
      return {
        ...state,
        players: { ...state.players, [event.playerId]: player },
        playerIdByUserId: { ...state.playerIdByUserId, [event.userId]: event.playerId },
      };
    }
    case 'PlayerInitialized': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            checks: event.checks,
            holdings: event.holdings,
            economy: event.economy,
            turn: event.turn,
          },
        },
      };
    }
    case 'PhaseAdvanced': {
      return { ...state, phase: event.to, round: event.round };
    }
    case 'MarketRolled': {
      return {
        ...state,
        market: {
          round: event.round,
          instances: event.instances.map((i) => ({
            id: i.id,
            label: i.label,
            ownerPlayerId: i.ownerPlayerId,
            raw: {
              tableRollTotal: i.raw.tableRoll.total,
              categoryLabel: i.raw.categoryLabel,
              demandLabel: i.raw.demandLabel,
              modifiersByGroup: i.raw.modifiersByGroup,
            },
            special: {
              tableRollTotal: i.special.tableRoll.total,
              categoryLabel: i.special.categoryLabel,
              demandLabel: i.special.demandLabel,
              modifiersByGroup: i.special.modifiersByGroup,
            },
          })),
        },
      };
    }
    case 'SectionEventsRolled': {
      return {
        ...state,
        globalEvents: event.events.map((e) => ({
          startsAtRound: event.startsAtRound,
          endsAtRound: event.endsAtRound,
          tableRollTotal: e.tableRoll.total,
          name: e.name,
          effectsText: e.effectsText,
          meta: e.meta,
        })),
      };
    }
    case 'PlayerPendingApplied': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold + event.goldApplied,
              pending: {
                gold: Math.max(0, player.economy.pending.gold - event.goldApplied),
                raw: subtractStock(player.economy.pending.raw, event.rawApplied),
                special: subtractStock(player.economy.pending.special, event.specialApplied),
                magicPower: Math.max(0, player.economy.pending.magicPower - event.magicPowerApplied),
              },
              inventory: {
                raw: addStock(player.economy.inventory.raw, event.rawApplied),
                special: addStock(player.economy.inventory.special, event.specialApplied),
                magicPower: player.economy.inventory.magicPower + event.magicPowerApplied,
              },
            },
          },
        },
      };
    }
    case 'PlayerIncomeApplied': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const goldDelta = event.produced.gold - event.upkeepPaid.gold - event.eventTaxesPaid.gold - event.eventTaxesPaid.oneTimeOfficeTaxGold;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold + goldDelta,
              inventory: {
                raw: subtractStock(addStock(player.economy.inventory.raw, event.produced.raw), event.upkeepPaid.raw),
                special: subtractStock(addStock(player.economy.inventory.special, event.produced.special), event.upkeepPaid.special),
                magicPower: player.economy.inventory.magicPower + event.produced.magicPower - event.upkeepPaid.magicPower,
              },
            },
            turn: {
              ...player.turn,
              laborAvailable: Math.max(0, player.turn.laborAvailable + event.produced.labor - event.upkeepPaid.labor),
              influenceAvailable: Math.max(0, player.turn.influenceAvailable + event.produced.influence - event.upkeepPaid.influence),
              upkeep: event.upkeep,
            },
          },
        },
      };
    }
    case 'PlayerMaterialsConverted': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold + event.convertedToGold.goldGained,
              inventory: {
                raw: subtractStock(
                  subtractStock(player.economy.inventory.raw, event.workshop.rawConsumed),
                  addStock(event.convertedToGold.rawByType, event.lost.rawLost),
                ),
                special: subtractStock(
                  subtractStock(addStock(player.economy.inventory.special, event.workshop.specialProduced), event.convertedToGold.specialByType),
                  event.lost.specialLost,
                ),
                magicPower: player.economy.inventory.magicPower,
              },
            },
          },
        },
      };
    }
    case 'PlayerTurnReset': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            turn: {
              laborAvailable: event.laborAvailable,
              influenceAvailable: event.influenceAvailable,
              actionsUsed: event.actionsUsed,
              actionKeysUsed: event.actionKeysUsed,
              facilityActionUsed: event.facilityActionUsed,
              upkeep: event.upkeep,
            },
          },
        },
      };
    }
    case 'PlayerInfluenceGained': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: { ...player.economy, gold: player.economy.gold - event.goldSpent },
            holdings: {
              ...player.holdings,
              permanentInfluence: player.holdings.permanentInfluence + event.permanentInfluenceIncreasedBy,
            },
            turn: {
              ...player.turn,
              influenceAvailable: player.turn.influenceAvailable + event.influenceGained,
              actionsUsed: player.turn.actionsUsed + event.actionCost,
              actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
            },
          },
        },
      };
    }
    case 'PlayerMoneyLent': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
              pending: { ...player.economy.pending, gold: player.economy.pending.gold + event.goldScheduled },
            },
            turn: {
              ...player.turn,
              actionsUsed: player.turn.actionsUsed + event.actionCost,
              actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
            },
          },
        },
      };
    }
    case 'PlayerMoneySold': {
      const player = state.players[event.playerId];
      if (!player) return state;
      let invRaw = player.economy.inventory.raw;
      let invSpecial = player.economy.inventory.special;
      let permanentLabor = player.holdings.permanentLabor;
      for (const item of event.sold) {
        if (item.kind === 'raw') {
          invRaw = subtractStock(invRaw, { [item.materialId]: item.count });
        } else if (item.kind === 'special') {
          invSpecial = subtractStock(invSpecial, { [item.materialId]: item.count });
        } else if (item.kind === 'labor') {
          permanentLabor = Math.max(0, permanentLabor - item.count);
        }
      }
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold + event.goldGained,
              inventory: { ...player.economy.inventory, raw: invRaw, special: invSpecial },
            },
            holdings: { ...player.holdings, permanentLabor },
            turn: {
              ...player.turn,
              actionsUsed: player.turn.actionsUsed + event.actionCost,
              actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
            },
          },
        },
      };
    }
    case 'PlayerMoneyBought': {
      const player = state.players[event.playerId];
      if (!player) return state;
      let invRaw = player.economy.inventory.raw;
      let invSpecial = player.economy.inventory.special;
      let permanentLabor = player.holdings.permanentLabor;
      for (const item of event.bought) {
        if (item.kind === 'raw') {
          invRaw = addStock(invRaw, { [item.materialId]: item.count });
        } else if (item.kind === 'special') {
          invSpecial = addStock(invSpecial, { [item.materialId]: item.count });
        } else if (item.kind === 'labor') {
          permanentLabor += item.count;
        }
      }
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
              inventory: { ...player.economy.inventory, raw: invRaw, special: invSpecial },
            },
            holdings: { ...player.holdings, permanentLabor },
            turn: {
              ...player.turn,
              actionsUsed: player.turn.actionsUsed + event.actionCost,
              actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
            },
          },
        },
      };
    }
    case 'PlayerMaterialsGained': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              inventory: {
                ...player.economy.inventory,
                raw: addStock(player.economy.inventory.raw, event.rawGained),
                special: addStock(player.economy.inventory.special, event.specialGained),
              },
            },
            turn: {
              ...player.turn,
              laborAvailable: Math.max(0, player.turn.laborAvailable - event.laborSpent),
              actionsUsed: player.turn.actionsUsed + event.actionCost,
              actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
            },
          },
        },
      };
    }
    case 'PlayerDomainAcquired': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const nextTurn = {
        ...player.turn,
        actionsUsed: player.turn.actionsUsed + event.actionCost,
        actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
      };
      if (event.tierResult === 'fail') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              turn: nextTurn,
            },
          },
        };
      }
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: { ...player.economy, gold: player.economy.gold - event.goldSpent },
            holdings: {
              ...player.holdings,
              domains: [
                ...player.holdings.domains,
                {
                  id: event.domainId,
                  tier: event.tier,
                  facilities: [],
                  tenants: { levels: 0, loyalty: 5, inUnrest: false },
                },
              ],
            },
            turn: nextTurn,
          },
        },
      };
    }
    case 'PlayerCityPropertyAcquired': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const nextTurn = {
        ...player.turn,
        actionsUsed: player.turn.actionsUsed + event.actionCost,
        actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
      };
      if (event.tierResult === 'fail') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              turn: nextTurn,
            },
          },
        };
      }
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: { ...player.economy, gold: player.economy.gold - event.goldSpent },
            holdings: {
              ...player.holdings,
              cityProperties: [
                ...player.holdings.cityProperties,
                {
                  id: event.cityPropertyId,
                  tier: event.tier,
                  mode: 'leased',
                  facilities: [],
                  tenants: { levels: 0, loyalty: 5, inUnrest: false },
                },
              ],
            },
            turn: nextTurn,
          },
        },
      };
    }
    case 'PlayerCityPropertyModeSet': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              cityProperties: player.holdings.cityProperties.map((c) =>
                c.id === event.cityPropertyId ? { ...c, mode: event.mode } : c,
              ),
            },
          },
        },
      };
    }
    case 'PlayerOfficeAcquired': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const nextTurn = {
        ...player.turn,
        influenceAvailable: Math.max(0, player.turn.influenceAvailable - event.influenceSpent),
        actionsUsed: player.turn.actionsUsed + event.actionCost,
        actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
      };
      if (event.tierResult === 'fail') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              economy: { ...player.economy, gold: player.economy.gold - event.goldSpent },
              turn: nextTurn,
            },
          },
        };
      }
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: { ...player.economy, gold: player.economy.gold - event.goldSpent },
            turn: nextTurn,
            holdings: {
              ...player.holdings,
              offices: [
                ...player.holdings.offices,
                {
                  id: event.officeId,
                  tier: event.tier,
                  yieldMode: 'influence',
                  facilities: [],
                },
              ],
            },
          },
        },
      };
    }
    case 'PlayerOfficeYieldModeSet': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              offices: player.holdings.offices.map((o) =>
                o.id === event.officeId ? { ...o, yieldMode: event.mode } : o,
              ),
            },
          },
        },
      };
    }
    case 'PlayerOrganizationAcquired': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const nextTurn = {
        ...player.turn,
        influenceAvailable: Math.max(0, player.turn.influenceAvailable - event.influenceSpent),
        actionsUsed: player.turn.actionsUsed + event.actionCost,
        actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
      };
      if (event.tierResult === 'fail') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              economy: { ...player.economy, gold: player.economy.gold - event.goldSpent },
              turn: nextTurn,
            },
          },
        };
      }
      const permInfFor = (kind: string, tier: PostTier) => {
        if (kind === 'spy') return tier === 'medium' ? 1 : tier === 'large' ? 2 : 0;
        if (kind === 'cult') return tier === 'medium' ? 2 : tier === 'large' ? 4 : 0;
        return 0;
      };
      const permanentInfluenceDelta =
        permInfFor(event.kind, event.toTier) - permInfFor(event.kind, event.fromTier);
      const existing = player.holdings.organizations.find((o) => o.id === event.organizationId);
      const nextOrgs = existing
        ? player.holdings.organizations.map((o) =>
            o.id === event.organizationId ? { ...o, tier: event.toTier } : o,
          )
        : [
            ...player.holdings.organizations,
            {
              id: event.organizationId,
              kind: event.kind,
              tier: event.toTier,
              facilities: [],
              followers: { levels: 0, loyalty: 5, inUnrest: false },
            },
          ];
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: { ...player.economy, gold: player.economy.gold - event.goldSpent },
            turn: nextTurn,
            holdings: {
              ...player.holdings,
              permanentInfluence: player.holdings.permanentInfluence + permanentInfluenceDelta,
              organizations: nextOrgs,
            },
          },
        },
      };
    }
    case 'PlayerTradeEnterpriseAcquired': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const nextTurn = {
        ...player.turn,
        actionsUsed: player.turn.actionsUsed + event.actionCost,
        actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
      };
      if (event.tierResult === 'fail') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              turn: nextTurn,
            },
          },
        };
      }
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: { ...player.economy, gold: player.economy.gold - event.goldSpent },
            holdings: {
              ...player.holdings,
              tradeEnterprises: [
                ...player.holdings.tradeEnterprises,
                { id: event.tradeEnterpriseId, tier: event.tier, mode: 'produce', facilities: [] },
              ],
            },
            turn: nextTurn,
          },
        },
      };
    }
    case 'PlayerTradeEnterpriseModeSet': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              tradeEnterprises: player.holdings.tradeEnterprises.map((t) =>
                t.id === event.tradeEnterpriseId ? { ...t, mode: event.mode } : t,
              ),
            },
          },
        },
      };
    }
    case 'PlayerTenantsAcquired': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const nextTurn = {
        ...player.turn,
        influenceAvailable: Math.max(0, player.turn.influenceAvailable - event.influenceSpent),
        actionsUsed: player.turn.actionsUsed + event.actionCost,
        actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
      };
      if (event.tierResult === 'fail') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              economy: { ...player.economy, gold: player.economy.gold - event.goldSpent },
              turn: nextTurn,
            },
          },
        };
      }
      const withAddedLevels = (current: { levels: number; loyalty: number; inUnrest: boolean }, add: number) => {
        const levels = Math.max(0, current.levels + Math.max(0, Math.trunc(add)));
        const loyalty = current.loyalty;
        const inUnrest = levels > 0 && loyalty <= 2;
        return { ...current, levels, inUnrest };
      };
      const updateDomains =
        event.location.kind === 'domain'
          ? player.holdings.domains.map((d) =>
              d.id === event.location.id
                ? { ...d, tenants: withAddedLevels(d.tenants, event.levels) }
                : d,
            )
          : player.holdings.domains;
      const updateCities =
        event.location.kind === 'cityProperty'
          ? player.holdings.cityProperties.map((c) =>
              c.id === event.location.id
                ? { ...c, tenants: withAddedLevels(c.tenants, event.levels) }
                : c,
            )
          : player.holdings.cityProperties;
      const updateOrgs =
        event.location.kind === 'organization'
          ? player.holdings.organizations.map((o) =>
              o.id === event.location.id
                ? { ...o, followers: withAddedLevels(o.followers, event.levels) }
                : o,
            )
          : player.holdings.organizations;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: { ...player.economy, gold: player.economy.gold - event.goldSpent },
            turn: nextTurn,
            holdings: {
              ...player.holdings,
              domains: updateDomains,
              cityProperties: updateCities,
              organizations: updateOrgs,
            },
          },
        },
      };
    }
    case 'PlayerTroopsRecruited': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const nextTurn = {
        ...player.turn,
        influenceAvailable: Math.max(0, player.turn.influenceAvailable - event.influenceSpent),
        actionsUsed: player.turn.actionsUsed + event.actionCost,
        actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
      };
      if (event.tierResult === 'fail') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              economy: {
                ...player.economy,
                gold: player.economy.gold - event.goldSpent,
                inventory: {
                  ...player.economy.inventory,
                  raw: subtractStock(player.economy.inventory.raw, event.rawSpent),
                  special: subtractStock(player.economy.inventory.special, event.specialSpent),
                },
              },
              turn: nextTurn,
            },
          },
        };
      }
      const troops = { ...player.holdings.troops };
      switch (event.troopKind) {
        case 'bodyguard':
          troops.bodyguardLevels += event.levels;
          break;
        case 'militia':
          troops.militiaLevels += event.levels;
          break;
        case 'mercenary':
          troops.mercenaryLevels += event.levels;
          break;
        case 'thug':
          troops.thugLevels += event.levels;
          break;
      }
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
              inventory: {
                ...player.economy.inventory,
                raw: subtractStock(player.economy.inventory.raw, event.rawSpent),
                special: subtractStock(player.economy.inventory.special, event.specialSpent),
              },
            },
            turn: nextTurn,
            holdings: { ...player.holdings, troops },
          },
        },
      };
    }
    case 'PlayerWorkshopBuilt': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            holdings: {
              ...player.holdings,
              workshops: [
                ...player.holdings.workshops,
                {
                  id: event.workshopId,
                  tier: event.tier,
                  location: { ...event.location },
                  facilities: [],
                },
              ],
            },
            turn: {
              ...player.turn,
              facilityActionUsed: player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed: player.turn.actionsUsed + (event.usedFreeFacilityBuild ? 0 : 1),
            },
          },
        },
      };
    }
    case 'PlayerWorkshopUpgraded': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            holdings: {
              ...player.holdings,
              workshops: player.holdings.workshops.map((w) =>
                w.id === event.workshopId ? { ...w, tier: event.toTier } : w,
              ),
            },
            turn: {
              ...player.turn,
              facilityActionUsed: player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed: player.turn.actionsUsed + (event.usedFreeFacilityBuild ? 0 : 1),
            },
          },
        },
      };
    }
    case 'PlayerStorageBuilt': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            holdings: {
              ...player.holdings,
              storages: [
                ...player.holdings.storages,
                {
                  id: event.storageId,
                  tier: event.tier,
                  location: { ...event.location },
                  facilities: [],
                },
              ],
            },
            turn: {
              ...player.turn,
              facilityActionUsed: player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed: player.turn.actionsUsed + (event.usedFreeFacilityBuild ? 0 : 1),
            },
          },
        },
      };
    }
    case 'PlayerStorageUpgraded': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            holdings: {
              ...player.holdings,
              storages: player.holdings.storages.map((s) =>
                s.id === event.storageId ? { ...s, tier: event.toTier } : s,
              ),
            },
            turn: {
              ...player.turn,
              facilityActionUsed: player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed: player.turn.actionsUsed + (event.usedFreeFacilityBuild ? 0 : 1),
            },
          },
        },
      };
    }
    case 'PlayerFacilityBuilt': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const spend = {
        gold: event.goldSpent,
        influence: event.influenceSpent,
        labor: event.laborSpent,
      };
      let domains = player.holdings.domains;
      let cityProperties = player.holdings.cityProperties;
      let organizations = player.holdings.organizations;
      let offices = player.holdings.offices;
      let tradeEnterprises = player.holdings.tradeEnterprises;
      let troops = player.holdings.troops;
      const facility = {
        id: event.facilityInstanceId,
        key: event.facilityKey,
        builtAtRound: state.round,
      };

      if (event.location.kind === 'domain') {
        const id = event.location.id;
        domains = domains.map((d) =>
          d.id === id
            ? { ...d, facilities: [...d.facilities, facility] }
            : d,
        );
      } else if (event.location.kind === 'cityProperty') {
        const id = event.location.id;
        cityProperties = cityProperties.map((c) =>
          c.id === id
            ? { ...c, facilities: [...c.facilities, facility] }
            : c,
        );
      } else if (event.location.kind === 'organization') {
        const id = event.location.id;
        organizations = organizations.map((o) =>
          o.id === id
            ? { ...o, facilities: [...o.facilities, facility] }
            : o,
        );
      } else if (event.location.kind === 'office') {
        const id = event.location.id;
        offices = offices.map((o) =>
          o.id === id
            ? { ...o, facilities: [...o.facilities, facility] }
            : o,
        );
      } else if (event.location.kind === 'tradeEnterprise') {
        const id = event.location.id;
        tradeEnterprises = tradeEnterprises.map((t) =>
          t.id === id
            ? { ...t, facilities: [...t.facilities, facility] }
            : t,
        );
      } else if (event.location.kind === 'troops') {
        troops = {
          ...troops,
          facilities: [...troops.facilities, facility],
        };
      }

      const nextHoldings: PlayerHoldings = {
        ...player.holdings,
        domains,
        cityProperties,
        organizations,
        offices,
        tradeEnterprises,
        troops,
      };
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - spend.gold,
              inventory: {
                ...player.economy.inventory,
                raw: subtractStock(player.economy.inventory.raw, event.rawSpent),
                special: subtractStock(player.economy.inventory.special, event.specialSpent),
                magicPower: player.economy.inventory.magicPower - event.magicPowerSpent,
              },
            },
            holdings: nextHoldings,
            turn: {
              ...player.turn,
              laborAvailable: Math.max(0, player.turn.laborAvailable - spend.labor),
              influenceAvailable: Math.max(0, player.turn.influenceAvailable - spend.influence),
              facilityActionUsed: player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed: player.turn.actionsUsed + (event.usedFreeFacilityBuild ? 0 : 1),
            },
          },
        },
      };
    }
    case 'PlayerFacilityDamaged': {
      const player = state.players[event.playerId];
      if (!player) return state;

      const damage = {
        damagedAtRound: state.round,
        repairCostGold: Math.max(0, Math.trunc(event.repairCostGold)),
        reason: event.reason,
      };

      const patchFacilities = (facilities: Array<{ id: string; damage?: unknown }>) =>
        facilities.map((f) => (f.id === event.facilityInstanceId ? { ...f, damage } : f));

      if (event.location.kind === 'domain') {
        const domainId = event.location.id;
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              holdings: {
                ...player.holdings,
                domains: player.holdings.domains.map((d) =>
                  d.id === domainId ? { ...d, facilities: patchFacilities(d.facilities) as any } : d,
                ),
              },
            },
          },
        };
      }
      if (event.location.kind === 'cityProperty') {
        const cityPropertyId = event.location.id;
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              holdings: {
                ...player.holdings,
                cityProperties: player.holdings.cityProperties.map((c) =>
                  c.id === cityPropertyId ? { ...c, facilities: patchFacilities(c.facilities) as any } : c,
                ),
              },
            },
          },
        };
      }
      if (event.location.kind === 'organization') {
        const organizationId = event.location.id;
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              holdings: {
                ...player.holdings,
                organizations: player.holdings.organizations.map((o) =>
                  o.id === organizationId ? { ...o, facilities: patchFacilities(o.facilities) as any } : o,
                ),
              },
            },
          },
        };
      }
      if (event.location.kind === 'office') {
        const officeId = event.location.id;
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              holdings: {
                ...player.holdings,
                offices: player.holdings.offices.map((o) =>
                  o.id === officeId ? { ...o, facilities: patchFacilities(o.facilities) as any } : o,
                ),
              },
            },
          },
        };
      }
      if (event.location.kind === 'tradeEnterprise') {
        const tradeEnterpriseId = event.location.id;
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              holdings: {
                ...player.holdings,
                tradeEnterprises: player.holdings.tradeEnterprises.map((t) =>
                  t.id === tradeEnterpriseId ? { ...t, facilities: patchFacilities(t.facilities) as any } : t,
                ),
              },
            },
          },
        };
      }
      if (event.location.kind === 'troops') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              holdings: {
                ...player.holdings,
                troops: { ...player.holdings.troops, facilities: patchFacilities(player.holdings.troops.facilities) as any },
              },
            },
          },
        };
      }

      return state;
    }
    case 'PlayerWorkshopDamaged': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const damage = {
        damagedAtRound: state.round,
        repairCostGold: Math.max(0, Math.trunc(event.repairCostGold)),
        reason: event.reason,
      };
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              workshops: player.holdings.workshops.map((w) => (w.id === event.workshopId ? { ...w, damage } : w)),
            },
          },
        },
      };
    }
    case 'PlayerStorageDamaged': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const damage = {
        damagedAtRound: state.round,
        repairCostGold: Math.max(0, Math.trunc(event.repairCostGold)),
        reason: event.reason,
      };
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              storages: player.holdings.storages.map((s) => (s.id === event.storageId ? { ...s, damage } : s)),
            },
          },
        },
      };
    }
    case 'PlayerFollowersAdjusted': {
      const player = state.players[event.playerId];
      if (!player) return state;

      const applyDelta = (current: { levels: number; loyalty: number; inUnrest: boolean }, delta: { levelsDelta?: number; loyaltyDelta?: number }) => {
        const levels = Math.max(0, current.levels + (delta.levelsDelta ?? 0));
        const loyalty = Math.max(0, Math.min(10, current.loyalty + (delta.loyaltyDelta ?? 0)));
        const inUnrest = levels > 0 && loyalty <= 2;
        return { ...current, levels, loyalty, inUnrest };
      };

      let domains = player.holdings.domains;
      let cityProperties = player.holdings.cityProperties;
      let organizations = player.holdings.organizations;

      for (const change of event.changes) {
        if (change.location.kind === 'domain') {
          domains = domains.map((d) =>
            d.id === change.location.id ? { ...d, tenants: applyDelta(d.tenants, change) } : d,
          );
        } else if (change.location.kind === 'cityProperty') {
          cityProperties = cityProperties.map((c) =>
            c.id === change.location.id ? { ...c, tenants: applyDelta(c.tenants, change) } : c,
          );
        } else if (change.location.kind === 'organization') {
          organizations = organizations.map((o) =>
            o.id === change.location.id ? { ...o, followers: applyDelta(o.followers, change) } : o,
          );
        }
      }

      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: { ...player.holdings, domains, cityProperties, organizations },
          },
        },
      };
    }
    case 'PlayerDomainSpecializationSet': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
              inventory: { ...player.economy.inventory, raw: subtractStock(player.economy.inventory.raw, event.rawSpent) },
            },
            holdings: {
              ...player.holdings,
              domains: player.holdings.domains.map((d) =>
                d.id === event.domainId
                  ? {
                      ...d,
                      specialization: {
                        kind: event.kind,
                        picks: event.picks,
                        facilities: [],
                      },
                    }
                  : d,
              ),
            },
            turn: {
              ...player.turn,
              facilityActionUsed: player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed: player.turn.actionsUsed + (event.usedFreeFacilityBuild ? 0 : 1),
            },
          },
        },
      };
    }
    case 'PlayerStarterDomainUpgraded': {
      const player = state.players[event.playerId];
      if (!player) return state;

      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: { ...player.economy, gold: player.economy.gold - event.goldSpent },
            holdings: {
              ...player.holdings,
              domains: player.holdings.domains.map((d) =>
                d.id === event.domainId ? { ...d, tier: 'small' } : d,
              ),
            },
            turn: {
              ...player.turn,
              laborAvailable: Math.max(0, player.turn.laborAvailable - event.laborSpent),
              facilityActionUsed: player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed: player.turn.actionsUsed + (event.usedFreeFacilityBuild ? 0 : 1),
              actionKeysUsed: [...player.turn.actionKeysUsed, `facility.upgradeStarterDomain.${event.domainId}`],
            },
          },
        },
      };
    }
    case 'PlayerSpecialistHired': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: { ...player.economy, gold: player.economy.gold - event.goldSpent },
            holdings: {
              ...player.holdings,
              specialists: [
                ...player.holdings.specialists,
                {
                  id: event.specialistId,
                  kind: event.kind,
                  tier: event.tier,
                  loyalty: event.loyaltyFinal,
                  traits: event.traits.map((t) => ({ ...t })),
                },
              ],
            },
          },
        },
      };
    }
    case 'PlayerPrivateNoteAdded': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            privateNotes: [...player.privateNotes, event.note],
          },
        },
      };
    }
    case 'PublicLogEntryAdded': {
      return state;
    }
  }
}

export function reduceEvents(
  initial: CampaignState | null,
  events: GameEvent[],
): CampaignState | null {
  let state = initial;
  for (const event of events) state = applyEvent(state, event);
  return state;
}

function ensureActionAvailable(player: PlayerState, rules: CampaignRules, actionKey: string, actionCost: number) {
  const canonical = canonicalActionKey(actionKey);
  if (player.turn.actionKeysUsed.some((k) => canonicalActionKey(k) === canonical)) {
    throw new GameRuleError('ACTION', `Aktion bereits genutzt: ${canonical}`);
  }
  if (actionCost <= 0) return;
  const max = rules.actionsPerRound;
  if (player.turn.actionsUsed + actionCost > max) {
    throw new GameRuleError('ACTION', 'Keine Aktionen mehr verfügbar.');
  }
}

function consumeFacilityOrAction(player: PlayerState, rules: CampaignRules): { usedFree: boolean; actionCost: number } {
  if (!player.turn.facilityActionUsed && rules.freeFacilityBuildsPerRound > 0) {
    return { usedFree: true, actionCost: 0 };
  }
  const max = rules.actionsPerRound;
  if (player.turn.actionsUsed + 1 > max) {
    throw new GameRuleError('ACTION', 'Keine Aktionen mehr verfügbar.');
  }
  return { usedFree: false, actionCost: 1 };
}

function canonicalActionKey(actionKey: string): string {
  const idx = actionKey.indexOf('@');
  if (idx === -1) return actionKey;
  return actionKey.slice(0, idx);
}

function actionKeyHasMarker(actionKey: string, marker: string): boolean {
  const idx = actionKey.indexOf('@');
  if (idx === -1) return false;
  const markers = actionKey
    .slice(idx + 1)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return markers.includes(marker);
}

function hasUsedCanonicalAction(player: PlayerState, canonical: string): boolean {
  return player.turn.actionKeysUsed.some((k) => canonicalActionKey(k) === canonical);
}

function hasUsedBonusMarker(player: PlayerState, marker: string): boolean {
  return player.turn.actionKeysUsed.some((k) => actionKeyHasMarker(k, marker));
}

function bonusInfluenceSlots(player: PlayerState): number {
  const largeOffices = player.holdings.offices.filter((o) => o.tier === 'large').length;
  const hasLargeCult = player.holdings.organizations.some(
    (o) => o.kind === 'cult' && o.tier === 'large' && !o.followers.inUnrest,
  );
  return largeOffices + (hasLargeCult ? 1 : 0);
}

function bonusMoneySlots(player: PlayerState): number {
  const hasLargeTradeCollegium = player.holdings.organizations.some(
    (o) => o.kind === 'collegiumTrade' && o.tier === 'large' && !o.followers.inUnrest,
  );
  return hasLargeTradeCollegium ? 1 : 0;
}

function bonusMaterialsSlots(player: PlayerState): number {
  const hasLargeCraftCollegium = player.holdings.organizations.some(
    (o) => o.kind === 'collegiumCraft' && o.tier === 'large' && !o.followers.inUnrest,
  );
  return hasLargeCraftCollegium ? 1 : 0;
}

function canEmitPublicLogs(ctx: EngineContext): boolean {
  return ctx.emitPublicLogs !== false;
}

function openCombatPower(troops: PlayerHoldings['troops']): number {
  // Ableitung aus Aufbausystem.md (Truppen):
  // - Leibgarde: +2 offene Kampfkraft / Stufe
  // - Miliz: +1 offene Kampfkraft / Stufe
  // - Söldner: +2 offene Kampfkraft / Stufe
  // - Protectoren/Schläger: +1 offene Kampfkraft pro 50 (≈ 2 Stufen)
  const thugOpen = Math.floor(troops.thugLevels / 2);
  return troops.bodyguardLevels * 2 + troops.militiaLevels + troops.mercenaryLevels * 2 + thugOpen;
}

function defenseRollModifier(player: PlayerState): number {
  // 🧩 Interpretation: Verteidigungsproben nutzen einen abstrahierten Modifikator aus "offener Kampfkraft".
  // Halbe offene Kampfkraft (abgerundet) erzeugt eine sinnvolle Skalierung ohne sofortige Autowins.
  return Math.floor(openCombatPower(player.holdings.troops) / 2);
}

function generateId(prefix: string, existing: Array<{ id: string }>): string {
  const n = existing.length + 1;
  return `${prefix}-${n}`;
}

function generateFacilityInstanceId(
  location: { kind: string; id?: string },
  existingFacilities: Array<{ id: string }>,
): string {
  const n = existingFacilities.length + 1;
  const loc = location.kind === 'troops' ? 'troops' : location.id ?? 'unknown';
  return `${location.kind}-${loc}-facility-${n}`;
}

function tierUnits(tier: PostTier): number {
  return tier === 'small' ? 1 : tier === 'medium' ? 2 : 4;
}

function domainFacilitySlotsMax(tier: DomainTier): number {
  if (tier === 'starter') return 0;
  return 2 * postTierRank(tier);
}

function cityFacilitySlotsMax(tier: CityPropertyTier): number {
  return tier === 'small' ? 2 : tier === 'medium' ? 3 : 4;
}

function productionCapacityUnitsMaxForCity(tier: CityPropertyTier): number {
  // Small: 2 small OR 1 medium; Medium: 2 medium OR 1 large; Large: 2 large.
  return 2 * tierUnits(tier);
}

function countFacilitySlotsUsedAtDomain(holdings: PlayerHoldings, domainId: string): number {
  const domain = holdings.domains.find((d) => d.id === domainId);
  if (!domain) return 0;
  const workshopSlots = holdings.workshops.filter((w) => w.location.kind === 'domain' && w.location.id === domainId && w.id !== 'workshop-starter').length;
  const storageSlots = holdings.storages.filter((s) => s.location.kind === 'domain' && s.location.id === domainId).length;
  const specSlots = domain.specialization?.facilities?.length ?? 0;
  return domain.facilities.length + specSlots + workshopSlots + storageSlots;
}

function countFacilitySlotsUsedAtCity(holdings: PlayerHoldings, cityPropertyId: string): number {
  const city = holdings.cityProperties.find((c) => c.id === cityPropertyId);
  if (!city) return 0;
  const workshopSlots = holdings.workshops.filter((w) => w.location.kind === 'cityProperty' && w.location.id === cityPropertyId).length;
  const storageSlots = holdings.storages.filter((s) => s.location.kind === 'cityProperty' && s.location.id === cityPropertyId).length;
  const specSlots = city.specialization?.facilities?.length ?? 0;
  return city.facilities.length + specSlots + workshopSlots + storageSlots;
}

function countProductionUnitsUsedAtCity(holdings: PlayerHoldings, cityPropertyId: string): number {
  const workshopUnits = holdings.workshops
    .filter((w) => w.location.kind === 'cityProperty' && w.location.id === cityPropertyId)
    .reduce((sum, w) => sum + tierUnits(w.tier), 0);
  const storageUnits = holdings.storages
    .filter((s) => s.location.kind === 'cityProperty' && s.location.id === cityPropertyId)
    .reduce((sum, s) => sum + tierUnits(s.tier), 0);
  return workshopUnits + storageUnits;
}

function actionDcForAcquire(baseDc: number, tier: PostTier): number {
  const mod = tier === 'medium' ? 4 : tier === 'large' ? 8 : 0;
  return baseDc + mod;
}

function marketInstanceStateOrThrow(state: CampaignState, instanceId: string) {
  const inst = state.market.instances.find((i) => i.id === instanceId);
  if (!inst) throw new GameRuleError('STATE', `Unbekannter Markt: ${instanceId}`);
  return inst;
}

function tradeMarketInstanceId(
  playerId: PlayerId,
  tradeEnterpriseId: string,
  index: number
): string {
  return `trade-${playerId}-${tradeEnterpriseId}-${index}`;
}

function marketUsedForPlayerOrThrow(
  state: CampaignState,
  playerId: PlayerId,
  marketInstanceId?: string,
): { instanceId: string; label: string } {
  const preferred = marketInstanceId ?? 'local';
  const inst =
    state.market.instances.find((i) => i.id === preferred) ?? state.market.instances[0];
  if (!inst) throw new Error('No market instance');
  if (inst.ownerPlayerId && inst.ownerPlayerId !== playerId) {
    throw new GameRuleError('AUTH', 'Dieser Markt gehört einem anderen Spieler.');
  }
  return { instanceId: inst.id, label: inst.label };
}

function marketModifierPerInvestment(
  state: CampaignState,
  marketInstanceId: string,
  materialId: string,
): number {
  const material = getMaterialOrThrow(materialId);
  const inst = marketInstanceStateOrThrow(state, marketInstanceId);
  const mods = material.kind === 'raw' ? inst.raw.modifiersByGroup : inst.special.modifiersByGroup;
  return Math.trunc(mods[material.marketGroup] ?? 0);
}

export function decide(
  state: CampaignState | null,
  command: GameCommand,
  ctx: EngineContext,
): GameEvent[] {
  switch (command.type) {
    case 'CreateCampaign': {
      if (state) throw new GameRuleError('STATE', 'Kampagne existiert bereits.');
      if (ctx.actor.role !== 'gm') throw new GameRuleError('AUTH', 'Nur GM kann Kampagnen erstellen.');
      const campaignId = asCampaignId(command.campaignId);
      return [
        {
          type: 'CampaignCreated',
          visibility: { scope: 'public' },
          campaignId,
          name: command.name,
          gmUserId: asUserId(ctx.actor.userId),
          rulesVersion: RULES_VERSION,
          rules: DEFAULT_CAMPAIGN_RULES,
          round: 1,
          phase: 'maintenance',
        },
        { type: 'PublicLogEntryAdded', visibility: { scope: 'public' }, message: `Kampagne "${command.name}" wurde erstellt.` },
      ];
    }

    case 'JoinCampaign': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'maintenance');

      const userId = asUserId(ctx.actor.userId);
      if (state.playerIdByUserId[userId]) {
        throw new GameRuleError('STATE', 'Du bist bereits beigetreten.');
      }

      const playerId = asPlayerId(command.playerId);
      const checks = normalizeChecks({ ...startingPlayerChecks(), ...command.checks });
      const holdings = startingPlayerHoldings();
      const economy = startingPlayerEconomy();
      const turn = startingPlayerTurn(holdings, state.rules);

      return [
        {
          type: 'PlayerJoined',
          visibility: { scope: 'public' },
          playerId,
          userId,
          displayName: command.displayName,
        },
        {
          type: 'PlayerInitialized',
          visibility: { scope: 'private', playerId },
          playerId,
          checks,
          holdings,
          economy,
          turn,
        },
        {
          type: 'PublicLogEntryAdded',
          visibility: { scope: 'public' },
          message: `${command.displayName} ist der Kampagne beigetreten.`,
          playerId,
        },
      ];
    }

    case 'AdvancePhase': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertGm(state, ctx.actor);

      const from = state.phase;
      const to = nextPhase(from);
      const nextRound = roundAfterPhaseAdvance(state.round, from, to);
      const events: GameEvent[] = [];
      let workingState = state;

      const push = (event: GameEvent) => {
        events.push(event);
        workingState = applyEvent(workingState, event);
      };

      if (from === 'maintenance' && to === 'actions') {
        const sectionStart = isSectionStartRound(state.round);

        // Market roll (local + trade markets)
        const marketInstances: Array<{ id: string; label: string; ownerPlayerId?: string }> = [
          { id: 'local', label: 'Lokaler Markt' },
        ];
        const playersSorted = (Object.values(workingState.players) as PlayerState[]).slice().sort((a, b) => a.id.localeCompare(b.id));
        for (const p of playersSorted) {
          const enterprises = [...p.holdings.tradeEnterprises].sort((a, b) => a.id.localeCompare(b.id));
          for (const te of enterprises) {
            const markets = postTierRank(te.tier);
            for (let i = 1; i <= markets; i += 1) {
              marketInstances.push({
                id: tradeMarketInstanceId(p.id, te.id, i),
                label: `Handelsmarkt (${p.displayName}) ${te.tier} ${i}/${markets}`,
                ownerPlayerId: p.id,
              });
            }
          }
        }

        const marketRoll = rollMarketInstances(state.round, marketInstances, ctx.rng);
        push({
          type: 'MarketRolled',
          visibility: { scope: 'public' },
          round: state.round,
          instances: marketRoll.instances.map((i) => ({
            id: i.id,
            label: i.label,
            ownerPlayerId: i.ownerPlayerId as any,
            raw: i.raw,
            special: i.special,
          })),
        } as any);

        if (sectionStart) {
          const rolled = rollSectionEvents(state.round, ctx.rng);
          push({
            type: 'SectionEventsRolled',
            visibility: { scope: 'public' },
            startsAtRound: rolled.startsAtRound,
            endsAtRound: rolled.endsAtRound,
            events: rolled.events,
          } as any);
        }

        const playerIds = Object.keys(workingState.players) as PlayerId[];
        for (const playerId of playerIds) {
          let player = workingState.players[playerId];
          let eventGoldDelta = 0;
          let eventInfluenceDelta = 0;
          let eventLaborDelta = 0;
          let eventMagicPowerDelta = 0;
          const eventSpecialDelta: MaterialStock = {};

          // Einmalige Abschnittseffekte (werden beim Start des Abschnitts angewandt, nicht jede Runde kumulativ).
          if (sectionStart) {
            const startEvents = workingState.globalEvents.filter((e) => state.round === e.startsAtRound);
            const has11 = startEvents.some((e) => e.tableRollTotal === 11); // Gute Ernte: Pächter-LO +1
            const has24 = startEvents.some((e) => e.tableRollTotal === 24); // Religiöse Feiertage: LO +1
            const has28 = startEvents.some((e) => e.tableRollTotal === 28); // Unheilvolle Konstellationen: Kult +1, sonst -1
            const has40 = startEvents.some((e) => e.tableRollTotal === 40); // Sehr gutes Jahr: Domänen-Pächter +1 Stufe, LO +2
            const has5 = startEvents.some((e) => e.tableRollTotal === 5); // Aufstand: Loyalitätsprobe (Klienten/Anhänger)
            const has6 = startEvents.some((e) => e.tableRollTotal === 6); // Kultüberprüfung
            const has20 = startEvents.some((e) => e.tableRollTotal === 20); // Alchemistischer Unfall (max 1 Schaden)
            const event34 = startEvents.find((e) => e.tableRollTotal === 34); // Erbe der Achäer (Ruinenfunde)

            if (has11 || has24 || has28 || has40) {
              const changes: Array<{
                location: { kind: 'domain' | 'cityProperty' | 'organization'; id: string };
                levelsDelta?: number;
                loyaltyDelta?: number;
              }> = [];

              for (const d of player.holdings.domains) {
                if (d.tier === 'starter' && has40) continue;
                const cap = d.tier === 'small' ? 2 : d.tier === 'medium' ? 4 : d.tier === 'large' ? 8 : 0;
                const addLevel = has40 && cap > 0 && d.tenants.levels < cap ? 1 : 0;

                const hasGroup = d.tenants.levels > 0 || addLevel > 0;
                const loyaltyDelta = hasGroup ? (has11 ? 1 : 0) + (has24 ? 1 : 0) + (has40 ? 2 : 0) + (has28 ? -1 : 0) : 0;

                if (addLevel || loyaltyDelta) {
                  changes.push({
                    location: { kind: 'domain', id: d.id },
                    levelsDelta: addLevel || undefined,
                    loyaltyDelta: loyaltyDelta || undefined,
                  });
                }
              }

              for (const c of player.holdings.cityProperties) {
                if (c.tenants.levels <= 0) continue;
                const loyaltyDelta =
                  (has11 ? 1 : 0) + (has24 ? 1 : 0) + (has40 ? 2 : 0) + (has28 ? -1 : 0);
                if (loyaltyDelta) {
                  changes.push({
                    location: { kind: 'cityProperty', id: c.id },
                    loyaltyDelta,
                  });
                }
              }

              for (const o of player.holdings.organizations) {
                if (o.followers.levels <= 0) continue;
                const loyaltyDelta =
                  (has11 ? 1 : 0) +
                  (has24 ? 1 : 0) +
                  (has40 ? 2 : 0) +
                  (has28 ? (o.kind === 'cult' ? 1 : -1) : 0);
                if (loyaltyDelta) {
                  changes.push({
                    location: { kind: 'organization', id: o.id },
                    loyaltyDelta,
                  });
                }
              }

              if (changes.length) {
                push({
                  type: 'PlayerFollowersAdjusted',
                  visibility: { scope: 'private', playerId: player.id },
                  playerId: player.id,
                  changes,
                  reason: `Abschnittseffekte (Ereignisse: ${startEvents.map((e) => e.tableRollTotal).join(', ')})`,
                });
                player = workingState.players[playerId];
              }
            }

            // Event 5: Aufstand in Nachbarprovinz – Loyalitätsprobe für städtische Klienten/Anhänger (einmalig beim Start).
            if (has5) {
              const changes: Array<{
                location: { kind: 'domain' | 'cityProperty' | 'organization'; id: string };
                loyaltyDelta?: number;
              }> = [];
              for (const c of player.holdings.cityProperties) {
                if (c.tenants.levels <= 0) continue;
                const roll = rollD20(ctx.rng);
                const mod = c.tenants.loyalty - 5; // v1: LO 5 => +0
                const total = roll.total + mod;
                const passed = total >= 10;
                if (!passed) changes.push({ location: { kind: 'cityProperty', id: c.id }, loyaltyDelta: -1 });
              }
              if (changes.length) {
                push({
                  type: 'PlayerFollowersAdjusted',
                  visibility: { scope: 'private', playerId: player.id },
                  playerId: player.id,
                  changes,
                  reason: 'Aufstand in Nachbarprovinz: Loyalitätsprobe misslungen',
                });
                player = workingState.players[playerId];
              }
            }

            // Event 34: Erbe der Achäer – Aufruhr auf dem Land (einmalig beim Start): LO-Probe oder Aufruhr der Pächter.
            if (event34) {
              const changes: Array<{
                location: { kind: 'domain' | 'cityProperty' | 'organization'; id: string };
                loyaltyDelta?: number;
              }> = [];
              for (const d of player.holdings.domains) {
                if (d.tenants.levels <= 0) continue;
                const roll = rollD20(ctx.rng);
                const mod = d.tenants.loyalty - 5; // v1: LO 5 => +0
                const total = roll.total + mod;
                const passed = total >= 10;
                if (!passed) changes.push({ location: { kind: 'domain', id: d.id }, loyaltyDelta: -2 });
              }
              if (changes.length) {
                push({
                  type: 'PlayerFollowersAdjusted',
                  visibility: { scope: 'private', playerId: player.id },
                  playerId: player.id,
                  changes,
                  reason: 'Erbe der Achäer: Aufruhr auf dem Land (Loyalitätsprobe misslungen)',
                });
                player = workingState.players[playerId];
              }

              // Magische Sondermaterialien (bei 1-10; Abschnitts-Roll ist im Event-Meta gespeichert).
              if ((event34.meta as any)?.achaerMagicSpecialTriggered === true) {
                eventSpecialDelta['special.highMagicOres'] = (eventSpecialDelta['special.highMagicOres'] ?? 0) + 4;
              }
            }

            // Event 6: Kultüberprüfung (einmalig beim Start): Trigger 1-5 auf w20, dann Verbergen-Check (DC 14).
            if (has6) {
              for (const cult of player.holdings.organizations.filter((o) => o.kind === 'cult')) {
                const trigger = rollD20(ctx.rng);
                if (trigger.total > 5) continue;
                const hide = rollD20(ctx.rng);
                const total = hide.total + effectiveCheck(player.checks.influence, state.round);
                const passed = total >= 14;
                if (passed) continue;

                const loss = rollDice('1d6', ctx.rng);
                eventInfluenceDelta -= loss.total;

                push({
                  type: 'PlayerFollowersAdjusted',
                  visibility: { scope: 'private', playerId: player.id },
                  playerId: player.id,
                  changes: [{ location: { kind: 'organization', id: cult.id }, levelsDelta: -1 }],
                  reason: 'Kultüberprüfung: Verbergen misslungen (Anhänger verloren)',
                });
                player = workingState.players[playerId];
              }
            }

            // Event 20: Alchemistischer Unfall – Beschädigung im städtischen Besitz (einmalig beim Start, max. 1).
            if (has20) {
              const roll = rollD20(ctx.rng);
              if (roll.total <= 5) {
                const targets: Array<
                  | { kind: 'workshop'; id: string }
                  | { kind: 'storage'; id: string }
                  | { kind: 'cityTenants'; id: string }
                  | { kind: 'facility'; location: { kind: 'cityProperty'; id: string }; id: string }
                > = [];

                for (const c of player.holdings.cityProperties) {
                  if (c.tenants.levels > 0) targets.push({ kind: 'cityTenants', id: c.id });
                  for (const f of c.facilities) if (!f.damage) targets.push({ kind: 'facility', location: { kind: 'cityProperty', id: c.id }, id: f.id });
                }
                for (const w of player.holdings.workshops) {
                  if (w.location.kind === 'cityProperty' && !w.damage) targets.push({ kind: 'workshop', id: w.id });
                }
                for (const s of player.holdings.storages) {
                  if (s.location.kind === 'cityProperty' && !s.damage) targets.push({ kind: 'storage', id: s.id });
                }

                if (targets.length) {
                  const pick = targets[ctx.rng.nextIntInclusive(0, targets.length - 1)];
                  const repair = rollDice('1d6', ctx.rng);

                  if (pick.kind === 'workshop') {
                    push({
                      type: 'PlayerWorkshopDamaged',
                      visibility: { scope: 'private', playerId: player.id },
                      playerId: player.id,
                      workshopId: pick.id,
                      repairCostGold: repair.total,
                      reason: 'Alchemistischer Unfall',
                    });
                    player = workingState.players[playerId];
                  } else if (pick.kind === 'storage') {
                    push({
                      type: 'PlayerStorageDamaged',
                      visibility: { scope: 'private', playerId: player.id },
                      playerId: player.id,
                      storageId: pick.id,
                      repairCostGold: repair.total,
                      reason: 'Alchemistischer Unfall',
                    });
                    player = workingState.players[playerId];
                  } else if (pick.kind === 'cityTenants') {
                    push({
                      type: 'PlayerFollowersAdjusted',
                      visibility: { scope: 'private', playerId: player.id },
                      playerId: player.id,
                      changes: [{ location: { kind: 'cityProperty', id: pick.id }, levelsDelta: -1 }],
                      reason: 'Alchemistischer Unfall: Anhängerstufe beschädigt',
                    });
                    player = workingState.players[playerId];
                  } else {
                    push({
                      type: 'PlayerFacilityDamaged',
                      visibility: { scope: 'private', playerId: player.id },
                      playerId: player.id,
                      location: pick.location,
                      facilityInstanceId: pick.id,
                      repairCostGold: repair.total,
                      reason: 'Alchemistischer Unfall',
                    });
                    player = workingState.players[playerId];
                  }
                }
              }
            }
          }

          // Abwanderung: Bei sehr niedriger Loyalität können Pächter/Anhänger abwandern.
          // 🧩 Der Regeltext nennt Abwanderung, aber keine konkrete Tick-Mechanik → v1-Interpretation:
          // Solange die Gruppe in Aufruhr ist (LO <= 2), verliert sie pro Runde 1 Stufe.
          {
            const changes: Array<{
              location: { kind: 'domain' | 'cityProperty' | 'organization'; id: string };
              levelsDelta?: number;
            }> = [];

            for (const d of player.holdings.domains) {
              if (d.tenants.levels > 0 && d.tenants.loyalty <= 2) {
                changes.push({ location: { kind: 'domain', id: d.id }, levelsDelta: -1 });
              }
            }
            for (const c of player.holdings.cityProperties) {
              if (c.tenants.levels > 0 && c.tenants.loyalty <= 2) {
                changes.push({ location: { kind: 'cityProperty', id: c.id }, levelsDelta: -1 });
              }
            }
            for (const o of player.holdings.organizations) {
              if (o.followers.levels > 0 && o.followers.loyalty <= 2) {
                changes.push({ location: { kind: 'organization', id: o.id }, levelsDelta: -1 });
              }
            }

            if (changes.length) {
              push({
                type: 'PlayerFollowersAdjusted',
                visibility: { scope: 'private', playerId: player.id },
                playerId: player.id,
                changes,
                reason: 'Abwanderung wegen niedriger Loyalität',
              });
              player = workingState.players[playerId];
            }
          }

          // Apply pending (gold/materials/magic power)
          const pending = player.economy.pending;
          const pendingGold = pending.gold;
          const pendingRaw = pending.raw;
          const pendingSpecial = pending.special;
          const pendingMagic = pending.magicPower;
          if (pendingGold || Object.keys(pendingRaw).length || Object.keys(pendingSpecial).length || pendingMagic) {
            push({
              type: 'PlayerPendingApplied',
              visibility: { scope: 'private', playerId: player.id },
              playerId: player.id,
              goldApplied: pendingGold,
              rawApplied: pendingRaw,
              specialApplied: pendingSpecial,
              magicPowerApplied: pendingMagic,
            });
            player = workingState.players[playerId];
          }

          // Ereignis-Nebeneffekte: Zufalls-Schäden an Einrichtungen (vereinfachte Abbildung).
          const activeEventsNow = workingState.globalEvents.filter(
            (e) => state.round >= e.startsAtRound && state.round <= e.endsAtRound,
          );

          const damageRandomTarget = (reason: string, repairCostGold: number) => {
            const targets: Array<
              | { kind: 'workshop'; id: string }
              | { kind: 'storage'; id: string }
              | {
                  kind: 'facility';
                  location:
                    | { kind: 'domain'; id: string }
                    | { kind: 'cityProperty'; id: string }
                    | { kind: 'organization'; id: string }
                    | { kind: 'office'; id: string }
                    | { kind: 'tradeEnterprise'; id: string }
                    | { kind: 'troops' };
                  id: string;
                }
            > = [];

            for (const w of player.holdings.workshops) {
              if (!w.damage) targets.push({ kind: 'workshop', id: w.id });
            }
            for (const s of player.holdings.storages) {
              if (!s.damage) targets.push({ kind: 'storage', id: s.id });
            }
            for (const d of player.holdings.domains) {
              for (const f of d.facilities) if (!f.damage) targets.push({ kind: 'facility', location: { kind: 'domain', id: d.id }, id: f.id });
            }
            for (const c of player.holdings.cityProperties) {
              for (const f of c.facilities) if (!f.damage) targets.push({ kind: 'facility', location: { kind: 'cityProperty', id: c.id }, id: f.id });
            }
            for (const o of player.holdings.organizations) {
              for (const f of o.facilities) if (!f.damage) targets.push({ kind: 'facility', location: { kind: 'organization', id: o.id }, id: f.id });
            }
            for (const o of player.holdings.offices) {
              for (const f of o.facilities) if (!f.damage) targets.push({ kind: 'facility', location: { kind: 'office', id: o.id }, id: f.id });
            }
            for (const t of player.holdings.tradeEnterprises) {
              for (const f of t.facilities) if (!f.damage) targets.push({ kind: 'facility', location: { kind: 'tradeEnterprise', id: t.id }, id: f.id });
            }
            for (const f of player.holdings.troops.facilities) if (!f.damage) targets.push({ kind: 'facility', location: { kind: 'troops' }, id: f.id });

            if (!targets.length) return;
            const pick = targets[ctx.rng.nextIntInclusive(0, targets.length - 1)];

            if (pick.kind === 'workshop') {
              push({
                type: 'PlayerWorkshopDamaged',
                visibility: { scope: 'private', playerId: player.id },
                playerId: player.id,
                workshopId: pick.id,
                repairCostGold,
                reason,
              });
            } else if (pick.kind === 'storage') {
              push({
                type: 'PlayerStorageDamaged',
                visibility: { scope: 'private', playerId: player.id },
                playerId: player.id,
                storageId: pick.id,
                repairCostGold,
                reason,
              });
            } else {
              push({
                type: 'PlayerFacilityDamaged',
                visibility: { scope: 'private', playerId: player.id },
                playerId: player.id,
                location: pick.location,
                facilityInstanceId: pick.id,
                repairCostGold,
                reason,
              });
            }

            player = workingState.players[playerId];
          };

          const maybeDamage = (opts: {
            tableRollTotal: number;
            thresholdD20: number;
            costDice: string;
            reason: string;
            onlyStartRound?: boolean;
          }) => {
            const active = activeEventsNow.some((e) =>
              e.tableRollTotal === opts.tableRollTotal &&
              (!opts.onlyStartRound || state.round === e.startsAtRound),
            );
            if (!active) return;
            const roll = rollDice('1d20', ctx.rng);
            if (roll.total > opts.thresholdD20) return;
            const repair = rollDice(opts.costDice, ctx.rng);
            damageRandomTarget(opts.reason, repair.total);
          };

          maybeDamage({
            tableRollTotal: 8,
            thresholdD20: 5,
            costDice: '1d6',
            reason: 'Dürresommer: Brandgefahr',
            onlyStartRound: true,
          });
          maybeDamage({
            tableRollTotal: 14,
            thresholdD20: 5,
            costDice: '1d6',
            reason: 'Magischer Unfall',
          });
          maybeDamage({
            tableRollTotal: 15,
            thresholdD20: 5,
            costDice: '1d6',
            reason: 'Starke Unwetter und Stürme',
          });
          maybeDamage({
            tableRollTotal: 27,
            thresholdD20: 5,
            costDice: '1d6',
            reason: 'Aufruhr in Denera',
          });
          maybeDamage({
            tableRollTotal: 30,
            thresholdD20: 5,
            costDice: '1d6',
            reason: 'Große Feuersbrunst in der Stadt',
          });

          // Income + upkeep
          const officeMods = computeOfficeIncomeMods(workingState.globalEvents, state.round);
          const perRoundTaxGold = taxGoldPerRound(workingState.globalEvents, state.round);

          const cityGold = player.holdings.cityProperties.reduce(
            (sum, c) =>
              c.tenants.inUnrest
                ? sum
                : sum + (c.mode === 'leased' ? (c.tier === 'small' ? 2 : c.tier === 'medium' ? 5 : 12) : 0),
            0,
          );

          let officeGoldBase = 0;
          let officeTierSumForBonus = 0;
          for (const o of player.holdings.offices) {
            const inc = officesIncomePerRound(o.tier, o.yieldMode, state.rules).gold;
            officeGoldBase += inc;
            if (inc > 0) officeTierSumForBonus += postTierRank(o.tier);
          }
          const officesGold = Math.floor(officeGoldBase * officeMods.goldMultiplier) + officeMods.goldBonusPerTier * officeTierSumForBonus;

          const tenantsGold =
            player.holdings.domains.reduce((sum, d) => (d.tenants.inUnrest ? sum : sum + d.tenants.levels), 0) +
            player.holdings.cityProperties.reduce((sum, c) => (c.tenants.inUnrest ? sum : sum + c.tenants.levels), 0) +
            player.holdings.organizations.reduce((sum, o) => (o.followers.inUnrest ? sum : sum + o.followers.levels), 0);

          let producedGold = cityGold + officesGold + tenantsGold;
          const producedSpecial: MaterialStock = {};

          // Unterweltcircel: Gold-Ertrag skaliert mit Circelstufe und Stadtbesitz-Stufe (vereinfachte Wahl: größter Stadtbesitz als HQ).
          const maxCityTier = Math.max(0, ...player.holdings.cityProperties.map((c) => postTierRank(c.tier)));
          for (const org of player.holdings.organizations) {
            if (org.kind !== 'underworld') continue;
            if (org.followers.inUnrest) continue;
            if (maxCityTier <= 0) continue;
            const rank = postTierRank(org.tier);
            const goldPer =
              rank === 1 ? 4 : rank === 2 ? 5 : 6;
            producedGold += goldPer * rank * maxCityTier;
          }

          const activeEvents = workingState.globalEvents.filter(
            (e) => state.round >= e.startsAtRound && state.round <= e.endsAtRound,
          );

          // Ereignis-Nebeneffekte (temporäre Modifikatoren auf Einfluss/AK/Gold/Magie)
          const deneraRiotActive = isDeneraRiotTriggered(workingState.globalEvents, state.round);

          // Turn-Pools an geänderte Holdings angleichen (z.B. Abschnitts-Starteffekte, Abwanderung, Ereignisse).
          // v1: wir modellieren Arbeitskraft/Einfluss als pro Runde verfügbare Pools; wenn Holdings vor der Aktionsphase
          // geändert werden, müssen diese Pools für die aktuelle Runde angepasst werden.
          eventLaborDelta += baseLaborTotal(player.holdings) - player.turn.laborAvailable;
          eventInfluenceDelta += baseInfluencePerRound(player.holdings) - player.turn.influenceAvailable;

          // Event 18: Korruptionsuntersuchung
          if (activeEvents.some((e) => e.tableRollTotal === 18)) {
            // Alle Ämter: Halbierter Einfluss (5 Runden) → wir reduzieren den bereits (im Reset) gewährten Einfluss um 50%.
            const officesInfluence = player.holdings.offices.reduce(
              (sum, o) => sum + officesIncomePerRound(o.tier, o.yieldMode, state.rules).influence,
              0,
            );
            eventInfluenceDelta -= Math.floor(officesInfluence / 2);

            // Unterweltcircel/Spionageringe/Kulte: +2 Einfluss pro Stufe (5 Runden)
            for (const o of player.holdings.organizations) {
              if (o.followers.inUnrest) continue;
              if (o.kind !== 'underworld' && o.kind !== 'spy' && o.kind !== 'cult') continue;
              eventInfluenceDelta += 2 * postTierRank(o.tier);
            }
          }

          // Event 27 / Aufruhr in Denera: Handwerkscollegien verlieren 1 AK pro Stufe (5 Runden).
          if (deneraRiotActive) {
            for (const o of player.holdings.organizations) {
              if (o.followers.inUnrest) continue;
              if (o.kind !== 'collegiumCraft') continue;
              eventLaborDelta -= postTierRank(o.tier);
            }
          }

          // Event 32: Landflucht – 1 Runde
          const landfluchtThisRound = activeEvents.some(
            (e) => e.tableRollTotal === 32 && state.round === e.startsAtRound,
          );
          if (landfluchtThisRound) {
            const tenantLevelsOnDomains = player.holdings.domains.reduce(
              (sum, d) => (d.tenants.inUnrest ? sum : sum + d.tenants.levels),
              0,
            );
            eventLaborDelta -= tenantLevelsOnDomains;

            for (const o of player.holdings.organizations) {
              if (o.followers.inUnrest) continue;
              if (o.kind === 'underworld' || o.kind === 'collegiumCraft') {
                eventLaborDelta += postTierRank(o.tier);
              }
            }
          }

          // Event 34: Erbe der Achäer – Magischer Einfluss (bei 1-10: -1 AK per 2 Pächtestufen)
          const e34Active = activeEvents.find((e) => e.tableRollTotal === 34);
          if ((e34Active?.meta as any)?.achaerMagicLaborTriggered === true) {
            const followerLevels =
              player.holdings.domains.reduce((sum, d) => sum + d.tenants.levels, 0) +
              player.holdings.cityProperties.reduce((sum, c) => sum + c.tenants.levels, 0) +
              player.holdings.organizations.reduce((sum, o) => sum + o.followers.levels, 0);
            eventLaborDelta -= Math.floor(followerLevels / 2);
          }
          if (e34Active) {
            // Cammern oder Kulte: +1 Zauberkraft per Stufe (5 Runden) → v1: nur Kult modelliert.
            for (const o of player.holdings.organizations) {
              if (o.followers.inUnrest) continue;
              if (o.kind !== 'cult') continue;
              eventMagicPowerDelta += postTierRank(o.tier);
            }
          }

          // Event 24: Opulente Religiöse Feiertage – Kulte erhalten +6 Einfluss (5 Runden).
          if (activeEvents.some((e) => e.tableRollTotal === 24)) {
            const hasCult = player.holdings.organizations.some((o) => o.kind === 'cult' && !o.followers.inUnrest);
            if (hasCult) eventInfluenceDelta += 6;
          }

          // Event 26: Konflikt mit Nachbarn – Spionageringe +4 Einfluss (5 Runden).
          if (activeEvents.some((e) => e.tableRollTotal === 26)) {
            const hasSpy = player.holdings.organizations.some((o) => o.kind === 'spy' && !o.followers.inUnrest);
            if (hasSpy) eventInfluenceDelta += 4;
          }

          // Event 35: Hedonistische Hysterie – Kulte +6 Einfluss pro Runde (5 Runden).
          if (activeEvents.some((e) => e.tableRollTotal === 35)) {
            const hasCult = player.holdings.organizations.some((o) => o.kind === 'cult' && !o.followers.inUnrest);
            if (hasCult) eventInfluenceDelta += 6;
          }

          // Event 37: Entlassene Söldnertruppe plündert – Söldnertruppen +6 Einfluss (5 Runden).
          if (activeEvents.some((e) => e.tableRollTotal === 37)) {
            if (player.holdings.troops.mercenaryLevels > 0) eventInfluenceDelta += 6;
          }

          // Event 38: Großes Wunder in Provinz – Bei Trigger: +6 Einfluss und +6 Gold per Kult-Stufe (5 Runden).
          const e38Active = activeEvents.find((e) => e.tableRollTotal === 38);
          if ((e38Active?.meta as any)?.greatWonderCultTriggered === true) {
            const cult = player.holdings.organizations.find((o) => o.kind === 'cult' && !o.followers.inUnrest);
            if (cult) {
              const tierRank = postTierRank(cult.tier);
              eventInfluenceDelta += 6 * tierRank;
              eventGoldDelta += 6 * tierRank;
            }
          }

          producedGold += eventGoldDelta;

          const droughtOneRound = activeEvents.some((e) => e.tableRollTotal === 8 && state.round === e.startsAtRound);
          const goodHarvestActive = activeEvents.some((e) => e.tableRollTotal === 11);
          const veryGoodYearActive = activeEvents.some((e) => e.tableRollTotal === 40);
          const veryGoodYearBurst = activeEvents.some((e) => e.tableRollTotal === 40 && state.round === e.startsAtRound);
          const magicalBeastsActive = activeEvents.some((e) => e.tableRollTotal === 29);
          const defenseDcBonus = activeEvents.some((e) => e.tableRollTotal === 26) ? 2 : 0;
          const defenseMod = defenseRollModifier(player);

          const producedRaw: MaterialStock = {};
          for (const domain of player.holdings.domains) {
            if (domain.tenants.inUnrest) continue;
            const baseCount = domainRawPerRound(domain.tier);
            const spec = domain.specialization?.kind;
            let count = baseCount;

            // Event 8: Dürresommer – Landwirtschaft/Tierzucht halbiert (1 Runde)
            if (droughtOneRound && (spec === 'agriculture' || spec === 'animalHusbandry')) {
              count = Math.floor(count / 2);
            }

            // Event 40: Sehr gutes Jahr – Landwirtschaft/Tierzucht/Forstwirtschaft +50% (1 Runde)
            if (veryGoodYearBurst && (spec === 'agriculture' || spec === 'animalHusbandry' || spec === 'forestry')) {
              count = Math.floor(count + count / 2);
            }

            // Event 29: Ausbruch Magischer Bestien – Verteidigungsprobe oder -4 RM Ertrag (5 Runden).
            if (magicalBeastsActive) {
              const defenseDc = 15 + defenseDcBonus;
              const roll = rollD20(ctx.rng);
              const total = roll.total + defenseMod;
              if (total < defenseDc) {
                count = Math.max(0, count - 4);
                if (canEmitPublicLogs(ctx)) {
                  push({
                    type: 'PublicLogEntryAdded',
                    visibility: { scope: 'public' },
                    message: `${player.displayName}: Magische Bestien beeinträchtigen Domäne (${domain.id}) – Verteidigung ${roll.total}+${defenseMod}=${total} < DC ${defenseDc} → -4 RM Ertrag.`,
                  });
                }
              }
            }

            const wood = Math.ceil(count / 2);
            const food = count - wood;
            producedRaw['raw.wood'] = (producedRaw['raw.wood'] ?? 0) + wood;
            producedRaw['raw.grainVeg'] = (producedRaw['raw.grainVeg'] ?? 0) + food;

            // Event 11/40: Zusätzliche Ernte für Landwirtschaft (vereinfachte Abbildung als Getreide/Gemüse)
            if (spec === 'agriculture' && goodHarvestActive) {
              producedRaw['raw.grainVeg'] = (producedRaw['raw.grainVeg'] ?? 0) + 8;
            }
            // Event 40: "+8 RM pro Runde ... (4 Runden)" → nicht in der Burst-Runde.
            if (spec === 'agriculture' && veryGoodYearActive && !veryGoodYearBurst) {
              producedRaw['raw.grainVeg'] = (producedRaw['raw.grainVeg'] ?? 0) + 8;
            }

            // Pächterstufen (Domäne): +1 einfaches RM pro Stufe (gemäß Spezialisierung; derzeit grob gemappt).
            const tenantRawId =
              domain.specialization?.kind === 'forestry'
                ? 'raw.wood'
                : domain.specialization?.kind === 'mining'
                  ? 'raw.ironSteel'
                  : domain.specialization?.kind === 'animalHusbandry'
                    ? 'raw.meat'
                    : 'raw.grainVeg';
            const tenantRaw = Math.max(0, Math.trunc(domain.tenants.levels));
            if (tenantRaw) producedRaw[tenantRawId] = (producedRaw[tenantRawId] ?? 0) + tenantRaw;
          }

          // Event 2: Große Hungersnot – Nahrung bereitstellen oder Loyalität -2
          let upkeepRaw: MaterialStock = {};
          let upkeepSpecial: MaterialStock = {};
          const hungerActive = workingState.globalEvents.some(
            (e) =>
              e.tableRollTotal === 2 &&
              state.round >= e.startsAtRound &&
              state.round <= e.endsAtRound,
          );
          if (hungerActive) {
            const isFood = (materialId: string) => getMaterialOrThrow(materialId).tags.includes('food');

            // Nahrung wird aus "food"-Materialien genommen (erst RM, dann SM), dabei zuerst das am wenigsten wertvolle.
            const availableRaw = addStock(player.economy.inventory.raw, producedRaw);
            let foodRaw: MaterialStock = {};
            for (const [materialId, count] of Object.entries(availableRaw)) {
              if (count > 0 && isFood(materialId)) foodRaw[materialId] = count;
            }
            let foodSpecial: MaterialStock = {};
            for (const [materialId, count] of Object.entries(player.economy.inventory.special)) {
              if (count > 0 && isFood(materialId)) foodSpecial[materialId] = count;
            }

            const feedOrder = (ids: string[]) =>
              [...ids].sort((a, b) => {
                const ma = getMaterialOrThrow(a);
                const mb = getMaterialOrThrow(b);
                const tier = materialTierRank(ma.tier) - materialTierRank(mb.tier);
                if (tier !== 0) return tier;
                const bonus = (ma.saleBonusGold ?? 0) - (mb.saleBonusGold ?? 0);
                if (bonus !== 0) return bonus;
                return a.localeCompare(b);
              });

            const canFeed = (amount: number) => sumStock(foodRaw) + sumStock(foodSpecial) >= amount;

            const feed = (amount: number): boolean => {
              const need = Math.max(0, Math.trunc(amount));
              if (!need) return true;
              if (!canFeed(need)) return false;

              const { taken: rawTaken, remaining: rawRemaining } = takeFromStock(foodRaw, need, feedOrder);
              foodRaw = rawRemaining;
              const rawTakenTotal = sumStock(rawTaken);

              const remainingNeed = need - rawTakenTotal;
              let specialTaken: MaterialStock = {};
              if (remainingNeed > 0) {
                const { taken, remaining } = takeFromStock(foodSpecial, remainingNeed, feedOrder);
                foodSpecial = remaining;
                specialTaken = taken;
              }

              const specialTakenTotal = sumStock(specialTaken);
              if (rawTakenTotal + specialTakenTotal !== need) return false;

              upkeepRaw = addStock(upkeepRaw, rawTaken);
              upkeepSpecial = addStock(upkeepSpecial, specialTaken);
              return true;
            };

            const hungerChanges: Array<{
              location: { kind: 'domain' | 'cityProperty' | 'organization'; id: string };
              loyaltyDelta?: number;
            }> = [];

            const requireFeed = (location: { kind: 'domain' | 'cityProperty' | 'organization'; id: string }, required: number) => {
              const need = Math.max(0, Math.trunc(required));
              if (!need) return;
              const ok = feed(need);
              if (!ok) hungerChanges.push({ location, loyaltyDelta: -2 });
            };

            for (const d of player.holdings.domains) {
              requireFeed({ kind: 'domain', id: d.id }, d.tenants.levels);
            }
            for (const c of player.holdings.cityProperties) {
              requireFeed({ kind: 'cityProperty', id: c.id }, c.tenants.levels);
            }
            for (const o of player.holdings.organizations) {
              requireFeed({ kind: 'organization', id: o.id }, o.followers.levels);
            }

            if (hungerChanges.length) {
              push({
                type: 'PlayerFollowersAdjusted',
                visibility: { scope: 'private', playerId: player.id },
                playerId: player.id,
                changes: hungerChanges,
                reason: 'Große Hungersnot: Nahrung nicht bereitgestellt',
              });
              player = workingState.players[playerId];
            }
          }

          // Ereignis-Nebeneffekte: Übergriffe/Angriffe (vereinfacht, aber regeltextnah für Rohstoff-/Pächterverluste).
          const incidentTenantLosses: Array<{
            location: { kind: 'domain' | 'cityProperty' | 'organization'; id: string };
            levelsDelta: number;
          }> = [];

          const stealOrder = (ids: string[]) =>
            [...ids].sort((a, b) => {
              const ma = getMaterialOrThrow(a);
              const mb = getMaterialOrThrow(b);
              const tier = materialTierRank(mb.tier) - materialTierRank(ma.tier);
              if (tier) return tier;
              const bonus = mb.saleBonusGold - ma.saleBonusGold;
              if (bonus) return bonus;
              return a.localeCompare(b);
            });

          const stealRaw = (amount: number): { amountRequested: number; stolen: MaterialStock } => {
            const need = Math.max(0, Math.trunc(amount));
            if (!need) return { amountRequested: 0, stolen: {} };
            const availableRaw = subtractStock(addStock(player.economy.inventory.raw, producedRaw), upkeepRaw);
            const { taken } = takeFromStock(availableRaw, need, stealOrder);
            upkeepRaw = addStock(upkeepRaw, taken);
            return { amountRequested: need, stolen: taken };
          };

          const incidentDefenseMod = defenseRollModifier(player);
          const incidentDefenseDcBonus = activeEvents.some((e) => e.tableRollTotal === 26) ? 2 : 0;

          // Event 16: Räuberbanden und Deserteure – Domänen können RM verlieren (5 Runden).
          const e16 = activeEvents.find((e) => e.tableRollTotal === 16);
          const raidersOrPirates = (e16?.meta as any)?.raidersOrPirates as 'raiders' | 'pirates' | undefined;
          if (raidersOrPirates === 'raiders') {
            for (const domain of player.holdings.domains) {
              const trigger = rollD20(ctx.rng);
              if (trigger.total > 5) continue;

              const defenseDc = 13 + incidentDefenseDcBonus;
              const defenseRoll = rollD20(ctx.rng);
              const defenseTotal = defenseRoll.total + incidentDefenseMod;
              const defended = defenseTotal >= defenseDc;
              if (defended) continue;

              const lossRoll = rollDice('1d6', ctx.rng);
              const stolen = stealRaw(lossRoll.total);

              if (canEmitPublicLogs(ctx)) {
                push({
                  type: 'PublicLogEntryAdded',
                  visibility: { scope: 'public' },
                  message: `${player.displayName}: Räuberüberfall auf Domäne (${domain.id}) – Verteidigung ${defenseRoll.total}+${incidentDefenseMod}=${defenseTotal} < DC ${defenseDc} → ${sumStock(stolen.stolen)} RM verloren.`,
                });
              }
            }
          }

          // Event 37: Entlassene Söldnertruppe plündert – bis zu 2 (unverteidigte) Domänen (5 Runden).
          if (activeEvents.some((e) => e.tableRollTotal === 37)) {
            const candidates = player.holdings.domains.filter(
              (d) => countFacilitySlotsUsedAtDomain(player.holdings, d.id) === 0,
            );
            const attacks = Math.min(2, candidates.length);
            for (let i = 0; i < attacks; i += 1) {
              const pickIndex = ctx.rng.nextIntInclusive(0, candidates.length - 1);
              const domain = candidates.splice(pickIndex, 1)[0];
              if (!domain) continue;

              const defenseDc = 15 + incidentDefenseDcBonus;
              const defenseRoll = rollD20(ctx.rng);
              const defenseTotal = defenseRoll.total + incidentDefenseMod;
              const defended = defenseTotal >= defenseDc;
              if (defended) continue;

              const lossRoll = rollDice('2d6', ctx.rng);
              const stolen = stealRaw(lossRoll.total);

              const tenantsLossRoll = rollDice('1d3', ctx.rng);
              const tenantLoss = Math.min(domain.tenants.levels, tenantsLossRoll.total);
              if (tenantLoss > 0) {
                incidentTenantLosses.push({
                  location: { kind: 'domain', id: domain.id },
                  levelsDelta: -tenantLoss,
                });
              }

              if (canEmitPublicLogs(ctx)) {
                push({
                  type: 'PublicLogEntryAdded',
                  visibility: { scope: 'public' },
                  message: `${player.displayName}: Plünderung auf Domäne (${domain.id}) – Verteidigung ${defenseRoll.total}+${incidentDefenseMod}=${defenseTotal} < DC ${defenseDc} → ${sumStock(stolen.stolen)} RM verloren, ${tenantLoss} Pächterstufe(n) verloren.`,
                });
              }
            }
          }

          const effectiveLaborAvailable = Math.max(0, player.turn.laborAvailable + eventLaborDelta);

          const upkeepActive = state.round >= 2;

          // Upkeep totals (werden ab Runde 2 gezahlt)
          let upkeepGold = 0;
          let upkeepLabor = 0;
          let upkeepInfluence = 0;

          if (upkeepActive) {
            // Domänen-Unterhalt (Gold)
            for (const d of player.holdings.domains) {
              upkeepGold += d.tier === 'small' ? 2 : d.tier === 'medium' ? 4 : d.tier === 'large' ? 8 : 0;
            }

            // Stadtbesitz-Eigenproduktion-Unterhalt (Gold)
            for (const c of player.holdings.cityProperties) {
              upkeepGold += c.mode === 'production' ? (c.tier === 'small' ? 2 : c.tier === 'medium' ? 4 : 8) : 0;
            }

            // Circel/Collegien-Unterhalt
            for (const o of player.holdings.organizations) {
              const rank = postTierRank(o.tier);
              if (o.kind === 'underworld') {
                upkeepGold += 1 * rank;
                upkeepLabor += 1 * rank;
              } else if (o.kind === 'spy') {
                upkeepGold += 2 * rank;
              } else if (o.kind === 'cult') {
                upkeepGold += 1 * rank;
              } else {
                // Handwerks-/Handelscollegium: Unterhalt "2 Gold" (ohne "pro Stufe" im Text) → v1: pauschal 2 Gold pro Collegium.
                upkeepGold += 2;
              }
            }

            // Handelsunternehmungen-Unterhalt
            const tradeUpkeepExtraPerTier =
              (activeEvents.some((e) => e.tableRollTotal === 13) ? 4 : 0) +
              (activeEvents.some((e) => e.tableRollTotal === 15) ? 3 : 0) +
              (activeEvents.some((e) => e.tableRollTotal === 16) ? 3 : 0) +
              (activeEvents.some((e) => e.tableRollTotal === 22) ? 3 : 0);
            for (const te of player.holdings.tradeEnterprises) {
              if (te.tier === 'small') {
                upkeepGold += 3;
                upkeepLabor += 1;
              } else if (te.tier === 'medium') {
                upkeepGold += 5;
                upkeepLabor += 2;
              } else {
                upkeepGold += 6;
                upkeepLabor += 4;
              }
              upkeepGold += tradeUpkeepExtraPerTier * postTierRank(te.tier);
            }

            // Truppen-Unterhalt
            const troops = player.holdings.troops;
            upkeepGold += troops.bodyguardLevels * 4;
            upkeepInfluence += troops.bodyguardLevels * 2;

            upkeepGold += troops.mercenaryLevels * 3;

            // Miliz: 1 Gold + 1 Einfluss pro 50er Einheit (=2 Stufen)
            const militiaGroups = Math.ceil(troops.militiaLevels / 2);
            upkeepGold += militiaGroups;
            upkeepInfluence += militiaGroups;

            upkeepGold += troops.thugLevels * 1;
            upkeepInfluence += troops.thugLevels * 1;

            // Arbeitskraft-Unterhalt: 1 RM pro 4 AK
            const laborMaintenanceRm = Math.floor(effectiveLaborAvailable / 4);
            if (laborMaintenanceRm > 0) {
              const availableRaw = subtractStock(addStock(player.economy.inventory.raw, producedRaw), upkeepRaw);
              const order = (ids: string[]) =>
                [...ids].sort((a, b) => {
                  const ma = getMaterialOrThrow(a);
                  const mb = getMaterialOrThrow(b);
                  const tier = materialTierRank(ma.tier) - materialTierRank(mb.tier);
                  if (tier) return tier;
                  const bonus = ma.saleBonusGold - mb.saleBonusGold;
                  if (bonus) return bonus;
                  return a.localeCompare(b);
                });
              const { taken } = takeFromStock(availableRaw, laborMaintenanceRm, order);
              upkeepRaw = addStock(upkeepRaw, taken);
              const paid = sumStock(taken);
              const missing = laborMaintenanceRm - paid;
              if (missing > 0) {
                // Fehlende RM → fehlende Versorgung der Arbeitskräfte (Interpretation): -4 AK pro fehlendem RM.
                upkeepLabor += missing * 4;
              }
            }
          }

          // Handelsunternehmungen-Ertrag (kommt "in der nächsten Runde" → wir verbuchen ihn im Runden-Start / Maintenance).
          const tradeYieldHalved = activeEvents.some(
            (e) => e.tableRollTotal === 10 || e.tableRollTotal === 17 || e.tableRollTotal === 26,
          );
          const tradeYieldBonusActive = activeEvents.some((e) => e.tableRollTotal === 33);
          for (const te of player.holdings.tradeEnterprises) {
            const produceCount = te.tier === 'small' ? 1 : te.tier === 'medium' ? 2 : 4;
            const tradeInput = te.tier === 'small' ? 1 : te.tier === 'medium' ? 2 : 4;
            const tradeGold = te.tier === 'small' ? 4 : te.tier === 'medium' ? 10 : 24;
            const tierRank = postTierRank(te.tier);

            if (te.mode === 'produce') {
              let out = produceCount;
              if (tradeYieldBonusActive) out += 1 * tierRank;
              if (tradeYieldHalved) out = Math.floor(out / 2);
              if (out > 0) {
                producedSpecial['special.tools'] = (producedSpecial['special.tools'] ?? 0) + out;
              }
              continue;
            }

            // "Trade": investiere Sondermaterial → Gold (vereinfachte Abbildung: günstigstes SM investieren)
            const availableSpecial = subtractStock(player.economy.inventory.special, upkeepSpecial);
            const order = (ids: string[]) =>
              [...ids].sort((a, b) => {
                const ma = getMaterialOrThrow(a);
                const mb = getMaterialOrThrow(b);
                const tier = materialTierRank(ma.tier) - materialTierRank(mb.tier);
                if (tier) return tier;
                const bonus = ma.saleBonusGold - mb.saleBonusGold;
                if (bonus) return bonus;
                return a.localeCompare(b);
              });
            const { taken } = takeFromStock(availableSpecial, tradeInput, order);
            if (sumStock(taken) === tradeInput) {
              upkeepSpecial = addStock(upkeepSpecial, taken);
              // +/- Marktsystem: Wähle den besten verfügbaren Handelsmarkt der Unternehmung für diese Waren.
              const marketCandidates = Array.from({ length: tierRank }, (_, i) =>
                tradeMarketInstanceId(player.id, te.id, i + 1)
              );
              let bestMarketDelta = 0;
              for (const marketId of marketCandidates) {
                let delta = 0;
                for (const [materialId, count] of Object.entries(taken)) {
                  if (count <= 0) continue;
                  delta += count * marketModifierPerInvestment(workingState, marketId, materialId);
                }
                if (delta > bestMarketDelta) bestMarketDelta = delta;
              }

              let globalEventDelta = 0;
              for (const [materialId, count] of Object.entries(taken)) {
                if (count <= 0) continue;
                globalEventDelta += count * marketDeltaPerInvestment(materialId, workingState.globalEvents, state.round);
              }

              let out = tradeGold + bestMarketDelta + globalEventDelta;
              if (tradeYieldBonusActive) out += 2 * tierRank;
              if (tradeYieldHalved) out = Math.floor(out / 2);
              producedGold += out;
            }
          }

          const goldAvailableForUpkeep = player.economy.gold + producedGold;

          const maintainedWorkshopIds: string[] = [];
          if (!upkeepActive) {
            for (const w of player.holdings.workshops) if (!w.damage) maintainedWorkshopIds.push(w.id);
          } else {
            const workshopMods = computeWorkshopUpkeepMods(workingState.globalEvents, state.round);
            for (const w of player.holdings.workshops) {
              if (w.damage) continue;
              const base = workshopUpkeep(w.tier);
              const u = {
                labor: base.labor + workshopMods.laborFlat,
                gold: base.gold + workshopMods.goldFlat + workshopMods.goldPerTier * postTierRank(w.tier),
              };
              if (effectiveLaborAvailable - upkeepLabor >= u.labor && goldAvailableForUpkeep - upkeepGold >= u.gold) {
                upkeepLabor += u.labor;
                upkeepGold += u.gold;
                maintainedWorkshopIds.push(w.id);
              }
            }
          }

          const maintainedStorageIds: string[] = [];
          if (!upkeepActive) {
            for (const s of player.holdings.storages) if (!s.damage) maintainedStorageIds.push(s.id);
          } else {
            for (const s of player.holdings.storages) {
              if (s.damage) continue;
              const u = storageUpkeep(s.tier);
              if (effectiveLaborAvailable - upkeepLabor >= u.labor) {
                upkeepLabor += u.labor;
                maintainedStorageIds.push(s.id);
              }
            }
          }

          push({
            type: 'PlayerIncomeApplied',
            visibility: { scope: 'private', playerId: player.id },
            playerId: player.id,
            produced: {
              gold: producedGold,
              raw: producedRaw,
              special: addStock(producedSpecial, eventSpecialDelta),
              influence: eventInfluenceDelta,
              labor: eventLaborDelta,
              magicPower: eventMagicPowerDelta,
            },
            upkeepPaid: {
              gold: upkeepGold,
              influence: upkeepInfluence,
              labor: upkeepLabor,
              raw: upkeepRaw,
              special: upkeepSpecial,
              magicPower: 0,
            },
            eventTaxesPaid: {
              gold: perRoundTaxGold,
              oneTimeOfficeTaxGold: (() => {
                const warTaxStartsThisRound = workingState.globalEvents.some(
                  (e) => e.tableRollTotal === 4 && state.round === e.startsAtRound,
                );
                if (!warTaxStartsThisRound) return 0;
                let sum = 0;
                for (const office of player.holdings.offices) {
                  sum += office.tier === 'small' ? 4 : office.tier === 'medium' ? 10 : 20;
                }
                return sum;
              })(),
            },
            upkeep: {
              maintainedWorkshopIds,
              maintainedStorageIds,
              maintainedOfficeIds: player.holdings.offices.map((o) => o.id),
              maintainedOrganizationIds: player.holdings.organizations.map((o) => o.id),
              maintainedTradeEnterpriseIds: player.holdings.tradeEnterprises.map((t) => t.id),
              maintainedTroops:
                upkeepActive &&
                (player.holdings.troops.bodyguardLevels > 0 ||
                  player.holdings.troops.militiaLevels > 0 ||
                  player.holdings.troops.mercenaryLevels > 0 ||
                  player.holdings.troops.thugLevels > 0),
            },
          });

          if (incidentTenantLosses.length) {
            push({
              type: 'PlayerFollowersAdjusted',
              visibility: { scope: 'private', playerId: player.id },
              playerId: player.id,
              changes: incidentTenantLosses,
              reason: 'Plünderung: Pächterstufen verloren',
            });
          }
        }
      }

      if (from === 'actions' && to === 'conversion') {
        for (const player of Object.values(state.players)) {
          const rawBefore = player.economy.inventory.raw;
          const specialBefore = player.economy.inventory.special;

          const rawTotalBefore = sumStock(rawBefore);
          const specialTotalBefore = sumStock(specialBefore);
          if (rawTotalBefore === 0 && specialTotalBefore === 0) continue;

          // Workshop conversion: consume up to capacity, produce Sondermaterial (default: Werkzeug).
          let rawToConsume = 0;
          let specialProduced = 0;
          let remainingRawCount = rawTotalBefore;
          for (const wId of player.turn.upkeep.maintainedWorkshopIds) {
            const w = player.holdings.workshops.find((x) => x.id === wId);
            if (!w) continue;
            const cap = workshopCapacity(w.tier);
            const rawForWorkshop = Math.min(remainingRawCount, cap.rawIn);
            const sm = Math.min(Math.floor(rawForWorkshop / 4), cap.specialOutMax);
            const consumed = sm * 4;
            rawToConsume += consumed;
            specialProduced += sm;
            remainingRawCount -= consumed;
          }

          const consumeOrder = (ids: string[]) =>
            ids.sort((a, b) => {
              const ma = getMaterialOrThrow(a);
              const mb = getMaterialOrThrow(b);
              const tier = materialTierRank(ma.tier) - materialTierRank(mb.tier);
              if (tier) return tier;
              const bonus = ma.saleBonusGold - mb.saleBonusGold;
              if (bonus) return bonus;
              return a.localeCompare(b);
            });

          const storeOrder = (ids: string[]) =>
            ids.sort((a, b) => {
              const ma = getMaterialOrThrow(a);
              const mb = getMaterialOrThrow(b);
              const tier = materialTierRank(mb.tier) - materialTierRank(ma.tier);
              if (tier) return tier;
              const bonus = mb.saleBonusGold - ma.saleBonusGold;
              if (bonus) return bonus;
              return a.localeCompare(b);
            });

          const { taken: rawConsumedByType, remaining: rawAfterWorkshop } = takeFromStock(rawBefore, rawToConsume, consumeOrder);

          const specialProducedByType: MaterialStock = specialProduced
            ? { 'special.tools': specialProduced }
            : {};
          const specialAfterWorkshop = addStock(specialBefore, specialProducedByType);

          // Storage: store up to capacity (typed).
          let rawStorageCap = 0;
          let specialStorageCap = 0;
          for (const sId of player.turn.upkeep.maintainedStorageIds) {
            const s = player.holdings.storages.find((x) => x.id === sId);
            if (!s) continue;
            const cap = storageCapacity(s.tier, state.rules);
            rawStorageCap += cap.raw;
            specialStorageCap += cap.special;
          }

          const rawStoreTotal = Math.min(sumStock(rawAfterWorkshop), rawStorageCap);
          const { taken: rawStoredByType, remaining: rawRemaining } = takeFromStock(rawAfterWorkshop, rawStoreTotal, storeOrder);

          const specialStoreTotal = Math.min(sumStock(specialAfterWorkshop), specialStorageCap);
          const { taken: specialStoredByType, remaining: specialRemaining } = takeFromStock(
            specialAfterWorkshop,
            specialStoreTotal,
            storeOrder,
          );

          // Auto conversion (default): RM 4:1, SM 1:2.
          const convertedRawByType: MaterialStock = {};
          const lostRawByType: MaterialStock = {};
          let goldFromRaw = 0;
          for (const [materialId, count] of Object.entries(rawRemaining)) {
            const divisor = rawAutoConvertDivisor(materialId, state.globalEvents, state.round);
            const gold = Math.floor(count / divisor);
            const consumed = gold * divisor;
            goldFromRaw += gold;
            if (consumed > 0) convertedRawByType[materialId] = consumed;
            const lost = count - consumed;
            if (lost > 0) lostRawByType[materialId] = lost;
          }

          const convertedSpecialByType: MaterialStock = {};
          let goldFromSpecial = 0;
          for (const [materialId, count] of Object.entries(specialRemaining)) {
            if (count <= 0) continue;
            convertedSpecialByType[materialId] = count;
            goldFromSpecial += count * 2;
          }

          events.push({
            type: 'PlayerMaterialsConverted',
            visibility: { scope: 'private', playerId: player.id },
            playerId: player.id,
            workshop: { rawConsumed: rawConsumedByType, specialProduced: specialProducedByType },
            stored: { rawStored: rawStoredByType, specialStored: specialStoredByType },
            convertedToGold: {
              rawByType: convertedRawByType,
              specialByType: convertedSpecialByType,
              goldGained: goldFromRaw + goldFromSpecial,
            },
            lost: { rawLost: lostRawByType, specialLost: {} },
          });
        }
      }

      if (from === 'conversion' && to === 'reset') {
        for (const player of Object.values(state.players)) {
          const upcomingRound = state.round + 1;

          let labor = baseLaborTotal(player.holdings);
          const influence = baseInfluencePerRound(player.holdings);

          // Event 3 (Seuche): -1 AK pro 500 Pächter/Untertanen/Anhänger/Klienten (Abschnitt)
          const plagueActiveNextRound = state.globalEvents.some(
            (e) =>
              e.tableRollTotal === 3 &&
              upcomingRound >= e.startsAtRound &&
              upcomingRound <= e.endsAtRound,
          );
          if (plagueActiveNextRound) {
            const followerLevels =
              player.holdings.domains.reduce((sum, d) => sum + d.tenants.levels, 0) +
              player.holdings.cityProperties.reduce((sum, c) => sum + c.tenants.levels, 0) +
              player.holdings.organizations.reduce((sum, o) => sum + o.followers.levels, 0);
            labor = Math.max(0, labor - Math.floor(followerLevels / 2));
          }

          events.push({
            type: 'PlayerTurnReset',
            visibility: { scope: 'private', playerId: player.id },
            playerId: player.id,
            laborAvailable: labor,
            influenceAvailable: influence,
            actionsUsed: 0,
            actionKeysUsed: [],
            facilityActionUsed: false,
            upkeep: {
              maintainedWorkshopIds: [],
              maintainedStorageIds: [],
              maintainedOfficeIds: [],
              maintainedOrganizationIds: [],
              maintainedTradeEnterpriseIds: [],
              maintainedTroops: false,
            },
          });
        }
      }

      events.push({
        type: 'PhaseAdvanced',
        visibility: { scope: 'public' },
        from,
        to,
        round: nextRound,
      });

      return events;
    }

    case 'GainInfluence': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const baseActionKey = 'influence';
      let actionKey = baseActionKey;
      let actionCost = 1;
      const bonusSlots = bonusInfluenceSlots(player);

      const canUseBase =
        !hasUsedCanonicalAction(player, baseActionKey) &&
        player.turn.actionsUsed + 1 <= state.rules.actionsPerRound;

      if (!canUseBase) {
        let picked: string | null = null;
        for (let i = 1; i <= bonusSlots; i += 1) {
          const bonusKey = `influence.bonus.${i}@bonus.influence.${i}`;
          if (hasUsedCanonicalAction(player, canonicalActionKey(bonusKey))) continue;
          picked = bonusKey;
          break;
        }
        if (!picked) {
          // Throws a reasonable error (duplicate vs. no actions).
          ensureActionAvailable(player, state.rules, baseActionKey, 1);
        }
        actionKey = picked!;
        actionCost = 0;
      }

      ensureActionAvailable(player, state.rules, actionKey, actionCost);

      const investments = Math.trunc(command.investments);
      if (investments <= 0) throw new GameRuleError('INPUT', 'Investitionen müssen > 0 sein.');

      // Deckelung (Caps)
      if (command.kind === 'temporary') {
        const hasAnySmall =
          player.holdings.offices.some((o) => o.tier === 'small') ||
          player.holdings.organizations.some((o) => o.tier === 'small');
        const hasAnyMedium =
          player.holdings.offices.some((o) => o.tier === 'medium') ||
          player.holdings.organizations.some((o) => o.tier === 'medium');
        const hasAnyLarge =
          player.holdings.offices.some((o) => o.tier === 'large') ||
          player.holdings.organizations.some((o) => o.tier === 'large');

        const cap = hasAnyLarge ? 12 : hasAnyMedium ? 8 : hasAnySmall ? 6 : 4;
        if (investments > cap) {
          throw new GameRuleError('INPUT', `Zu viele Investitionen (max. ${cap}).`);
        }
      } else {
        // "Maximal 2 Punkte pro Runde + 1 mal pro Amts/Circelstufe" (Interpretation: Summe der Tier-Ränge aller Ämter + Circel/Collegien)
        const cap =
          2 +
          player.holdings.offices.reduce((sum, o) => sum + postTierRank(o.tier), 0) +
          player.holdings.organizations.reduce((sum, o) => sum + postTierRank(o.tier), 0);
        if (investments > cap) {
          throw new GameRuleError('INPUT', `Zu viele Investitionen (max. ${cap}).`);
        }
      }

      const baseDc = 12;
      const actionSize = investments >= 8 ? 'large' : investments >= 4 ? 'medium' : 'small';
      const influenceMods = moneyActionMods(state.globalEvents, state.round);
      let dc = baseDc + investmentDcModifier(investments) + influenceMods.influenceDc;
      if (
        actionSize === 'small' &&
        player.holdings.cityProperties.some((c) => c.tier === 'small' && c.mode === 'leased')
      ) {
        dc -= 1;
      }
      if (
        actionSize === 'medium' &&
        player.holdings.cityProperties.some((c) => c.tier === 'medium' && c.mode === 'leased')
      ) {
        dc -= 1;
      }
      if (
        actionSize === 'large' &&
        player.holdings.cityProperties.some((c) => c.tier === 'large' && c.mode === 'leased')
      ) {
        dc -= 1;
      }
      if (actionSize === 'small' && player.holdings.offices.some((o) => o.tier === 'small')) dc -= 1;
      if (actionSize === 'medium' && player.holdings.offices.some((o) => o.tier === 'medium')) dc -= 1;
      if (actionSize === 'large' && player.holdings.offices.some((o) => o.tier === 'large')) dc -= 1;
      const cult = player.holdings.organizations.find((o) => o.kind === 'cult');
      if (cult) dc -= postTierRank(cult.tier);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tier = resolveSuccessTier(dc, total);

      const goldPerInvestment = command.kind === 'temporary' ? 1 : 2;
      const goldSpent = investments * goldPerInvestment;
      if (player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');

      let influenceGained = 0;
      let permanentInc = 0;

      if (command.kind === 'temporary') {
        if (tier === 'veryGood') influenceGained = investments * 8;
        else if (tier === 'good') influenceGained = investments * 6;
        else if (tier === 'success') influenceGained = investments * 4;
        else if (tier === 'poor') influenceGained = Math.max(1, investments * 2);
        else influenceGained = 0;
      } else {
        if (tier === 'veryGood') permanentInc = investments * 3;
        else if (tier === 'good') permanentInc = investments * 2;
        else if (tier === 'success') permanentInc = investments;
        else if (tier === 'poor') permanentInc = Math.max(1, Math.round(investments * 0.5));
        else permanentInc = 0;
        influenceGained = permanentInc;
      }

      return [
        {
          type: 'PlayerInfluenceGained',
          visibility: { scope: 'private', playerId },
          playerId,
          kind: command.kind,
          investments,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tier,
          goldSpent,
          influenceGained,
          permanentInfluenceIncreasedBy: command.kind === 'permanent' ? permanentInc : 0,
          actionCost,
          actionKey,
        },
      ];
    }

    case 'MoneyLend': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const baseActionKey = 'money.lend';
      let actionKey = baseActionKey;
      let actionCost = 1;
      const bonusSlots = bonusMoneySlots(player);

      if (hasUsedCanonicalAction(player, baseActionKey)) {
        ensureActionAvailable(player, state.rules, baseActionKey, 1);
      }

      const hasBaseActions = player.turn.actionsUsed + 1 <= state.rules.actionsPerRound;
      if (!hasBaseActions && bonusSlots > 0) {
        // One bonus money action per round (collegium trade, Stufe 3).
        const marker = 'bonus.money.1';
        if (!hasUsedBonusMarker(player, marker)) {
          actionKey = `${baseActionKey}@${marker}`;
          actionCost = 0;
        } else {
          ensureActionAvailable(player, state.rules, baseActionKey, 1);
        }
      }

      ensureActionAvailable(player, state.rules, actionKey, actionCost);

      const investments = Math.trunc(command.investments);
      if (investments <= 0) throw new GameRuleError('INPUT', 'Investitionen müssen > 0 sein.');

      const moneyMods = moneyActionMods(state.globalEvents, state.round);
      const maxTradeTier = Math.max(0, ...player.holdings.tradeEnterprises.map((t) => postTierRank(t.tier)));
      const investmentCap = maxTradeTier === 0 ? 2 : maxTradeTier === 1 ? 4 : maxTradeTier === 2 ? 6 : 10;
      if (investments > investmentCap) {
        throw new GameRuleError('INPUT', `Zu viele Investitionen (max. ${investmentCap}).`);
      }

      const actionSize = investments >= 8 ? 'large' : investments >= 4 ? 'medium' : 'small';
      let dc = 14 + investmentDcModifier(investments) + moneyMods.lendDc;
      if (actionSize === 'small' && player.holdings.tradeEnterprises.some((t) => t.tier === 'small')) dc -= 1;
      if (actionSize === 'medium' && player.holdings.tradeEnterprises.some((t) => t.tier === 'medium')) dc -= 1;
      if (actionSize === 'large' && player.holdings.tradeEnterprises.some((t) => t.tier === 'large')) dc -= 1;
      const collegiumTrade = player.holdings.organizations.find((o) => o.kind === 'collegiumTrade');
      if (collegiumTrade) dc -= 2 * postTierRank(collegiumTrade.tier);

      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.money, state.round);
      const total = roll.total + mod;
      const tier = resolveSuccessTier(dc, total);

      const goldSpent = investments * 2;
      if (player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');

      let goldScheduled = 0;
      if (tier === 'veryGood') goldScheduled = investments * 12;
      else if (tier === 'good') goldScheduled = investments * 8;
      else if (tier === 'success') goldScheduled = investments * 4;
      else if (tier === 'poor') goldScheduled = investments; // lose 1 per investment, get 1 back
      else goldScheduled = 0;

      // Event 31: Alle 2 Investitionen +X Gold (auch für Geldverleih)
      if (tier !== 'fail') {
        goldScheduled += Math.floor(investments / 2) * moneyMods.bonusGoldPerTwoInvestments;
      }

      // Event 13: Erträge aus Geldverleih halbiert
      const lendHalved = state.globalEvents.some(
        (e) => state.round >= e.startsAtRound && state.round <= e.endsAtRound && e.tableRollTotal === 13,
      );
      if (lendHalved) goldScheduled = Math.floor(goldScheduled / 2);

      return [
        {
          type: 'PlayerMoneyLent',
          visibility: { scope: 'private', playerId },
          playerId,
          investments,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tier,
          goldSpent,
          goldScheduled,
          actionCost,
          actionKey,
        },
      ];
    }

    case 'MoneySell': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const baseActionKey = 'money.sell';
      let actionKey = baseActionKey;
      let actionCost = 1;
      const bonusSlots = bonusMoneySlots(player);

      if (hasUsedCanonicalAction(player, baseActionKey)) {
        ensureActionAvailable(player, state.rules, baseActionKey, 1);
      }

      const hasBaseActions = player.turn.actionsUsed + 1 <= state.rules.actionsPerRound;
      if (!hasBaseActions && bonusSlots > 0) {
        const marker = 'bonus.money.1';
        if (!hasUsedBonusMarker(player, marker)) {
          actionKey = `${baseActionKey}@${marker}`;
          actionCost = 0;
        } else {
          ensureActionAvailable(player, state.rules, baseActionKey, 1);
        }
      }

      ensureActionAvailable(player, state.rules, actionKey, actionCost);

      const marketUsed = marketUsedForPlayerOrThrow(state, playerId, command.marketInstanceId);

      const sold: Array<
        | { kind: 'labor'; count: number }
        | { kind: MaterialKind; materialId: string; count: number }
      > = [];

      let investments = 0;
      let baseSaleGold = 0;
      let conversionGold = 0;
      let marketDeltaGold = 0;
      const soldMaterialIds = new Set<string>();

      for (const item of command.items) {
        const count = Math.trunc(item.count);
        if (count <= 0) continue;

        if (item.kind === 'labor') {
          if (count > player.holdings.permanentLabor) {
            throw new GameRuleError('RESOURCES', 'Nicht genug permanente Arbeitskraft.');
          }
          sold.push({ kind: 'labor', count });
          investments += count;
          baseSaleGold += count * 6;
          conversionGold += count * 6;
          continue;
        }

        const material = getMaterialOrThrow(item.materialId);
        if (material.kind !== item.kind) {
          throw new GameRuleError('INPUT', `Material ${item.materialId} ist nicht vom Typ ${item.kind}.`);
        }

        if (item.kind === 'raw') {
          if (count % 6 !== 0) {
            throw new GameRuleError('INPUT', 'Rohmaterial-Verkauf muss in 6er-Schritten erfolgen.');
          }
          const available = player.economy.inventory.raw[item.materialId] ?? 0;
          if (available < count) throw new GameRuleError('RESOURCES', `Nicht genug RM: ${item.materialId}.`);
          const inv = count / 6;
          sold.push({ kind: 'raw', materialId: item.materialId, count });
          soldMaterialIds.add(item.materialId);
          investments += inv;
          baseSaleGold += inv * 3;
          conversionGold += inv * 1;
          marketDeltaGold +=
            inv *
            (marketModifierPerInvestment(state, marketUsed.instanceId, item.materialId) +
              material.saleBonusGold +
              marketDeltaPerInvestment(item.materialId, state.globalEvents, state.round));
          continue;
        }

        // special
        {
          const available = player.economy.inventory.special[item.materialId] ?? 0;
          if (available < count) throw new GameRuleError('RESOURCES', `Nicht genug SM: ${item.materialId}.`);
          const inv = count;
          sold.push({ kind: 'special', materialId: item.materialId, count });
          soldMaterialIds.add(item.materialId);
          investments += inv;
          baseSaleGold += inv * 3;
          conversionGold += inv * 2;
          marketDeltaGold +=
            inv *
            (marketModifierPerInvestment(state, marketUsed.instanceId, item.materialId) +
              material.saleBonusGold +
              marketDeltaPerInvestment(item.materialId, state.globalEvents, state.round));
        }
      }

      if (investments <= 0) throw new GameRuleError('INPUT', 'Nichts zu verkaufen.');

      // Event-Sale-Boni, die nicht pro Investment über die Markttabellen laufen.
      marketDeltaGold += saleBonusGoldForAction([...soldMaterialIds], state.globalEvents, state.round);

      const capFromTrade = player.holdings.tradeEnterprises.reduce(
        (sum, te) => sum + 2 * postTierRank(te.tier),
        0,
      );
      const capFromDomains = player.holdings.domains.reduce(
        (sum, d) => sum + (d.tier === 'starter' ? 0 : postTierRank(d.tier)),
        0,
      );
      const investmentCap = 3 + capFromTrade + capFromDomains;
      if (investments > investmentCap) {
        throw new GameRuleError('INPUT', `Zu viele Investitionen (max. ${investmentCap}).`);
      }

      const moneyMods = moneyActionMods(state.globalEvents, state.round);
      const actionSize = investments >= 8 ? 'large' : investments >= 4 ? 'medium' : 'small';
      let dc = 14 + investmentDcModifier(investments) + moneyMods.sellDc;
      if (actionSize === 'small' && player.holdings.tradeEnterprises.some((t) => t.tier === 'small')) dc -= 1;
      if (actionSize === 'medium' && player.holdings.tradeEnterprises.some((t) => t.tier === 'medium')) dc -= 1;
      if (actionSize === 'large' && player.holdings.tradeEnterprises.some((t) => t.tier === 'large')) dc -= 1;
      const collegiumTrade = player.holdings.organizations.find((o) => o.kind === 'collegiumTrade');
      if (collegiumTrade) dc -= 2 * postTierRank(collegiumTrade.tier);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.money, state.round);
      const total = roll.total + mod;
      const tier = resolveSuccessTier(dc, total);

      const baseGold = (() => {
        switch (tier) {
          case 'veryGood':
            return baseSaleGold + investments * 3;
          case 'good':
            return baseSaleGold + investments * 2;
          case 'success':
            return baseSaleGold;
          case 'poor':
            return conversionGold;
          case 'fail':
            return Math.max(0, conversionGold - investments);
        }
      })();
      const bonusGold = tier === 'fail' ? 0 : Math.floor(investments / 2) * moneyMods.bonusGoldPerTwoInvestments;
      const goldGained = Math.max(0, baseGold + bonusGold + marketDeltaGold);

      return [
        {
          type: 'PlayerMoneySold',
          visibility: { scope: 'private', playerId },
          playerId,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tier,
          sold: sold as any,
          marketUsed,
          marketDeltaGold,
          goldGained,
          actionCost,
          actionKey,
        },
      ];
    }

    case 'MoneyBuy': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const baseActionKey = 'money.buy';
      let actionKey = baseActionKey;
      let actionCost = 1;
      const bonusSlots = bonusMoneySlots(player);

      if (hasUsedCanonicalAction(player, baseActionKey)) {
        ensureActionAvailable(player, state.rules, baseActionKey, 1);
      }

      const hasBaseActions = player.turn.actionsUsed + 1 <= state.rules.actionsPerRound;
      if (!hasBaseActions && bonusSlots > 0) {
        const marker = 'bonus.money.1';
        if (!hasUsedBonusMarker(player, marker)) {
          actionKey = `${baseActionKey}@${marker}`;
          actionCost = 0;
        } else {
          ensureActionAvailable(player, state.rules, baseActionKey, 1);
        }
      }

      ensureActionAvailable(player, state.rules, actionKey, actionCost);

      const marketUsed = marketUsedForPlayerOrThrow(state, playerId, command.marketInstanceId);

      const bought: Array<
        | { kind: 'labor'; count: number }
        | { kind: MaterialKind; materialId: string; count: number }
      > = [];

      let investments = 0;
      let baseCostGold = 0;
      let marketDeltaGold = 0;

      for (const item of command.items) {
        const count = Math.trunc(item.count);
        if (count <= 0) continue;

        if (item.kind === 'labor') {
          bought.push({ kind: 'labor', count });
          investments += count;
          baseCostGold += count * 8;
          continue;
        }

        const material = getMaterialOrThrow(item.materialId);
        if (material.kind !== item.kind) {
          throw new GameRuleError('INPUT', `Material ${item.materialId} ist nicht vom Typ ${item.kind}.`);
        }

        if (item.kind === 'raw') {
          if (count % 5 !== 0) {
            throw new GameRuleError('INPUT', 'Rohmaterial-Kauf muss in 5er-Schritten erfolgen.');
          }
          const inv = count / 5;
          bought.push({ kind: 'raw', materialId: item.materialId, count });
          investments += inv;
          baseCostGold += inv * 3;
          marketDeltaGold +=
            inv *
            (marketModifierPerInvestment(state, marketUsed.instanceId, item.materialId) +
              marketDeltaPerInvestment(item.materialId, state.globalEvents, state.round));
          continue;
        }

        // special
        {
          const inv = count;
          bought.push({ kind: 'special', materialId: item.materialId, count });
          investments += inv;
          baseCostGold += inv * 3;
          marketDeltaGold +=
            inv *
            (marketModifierPerInvestment(state, marketUsed.instanceId, item.materialId) +
              marketDeltaPerInvestment(item.materialId, state.globalEvents, state.round));
        }
      }

      if (investments <= 0) throw new GameRuleError('INPUT', 'Nichts zu kaufen.');

      const capFromTrade = player.holdings.tradeEnterprises.reduce(
        (sum, te) => sum + 2 * postTierRank(te.tier),
        0,
      );
      const capFromDomains = player.holdings.domains.reduce(
        (sum, d) => sum + (d.tier === 'starter' ? 0 : postTierRank(d.tier)),
        0,
      );
      const investmentCap = 3 + capFromTrade + capFromDomains;
      if (investments > investmentCap) {
        throw new GameRuleError('INPUT', `Zu viele Investitionen (max. ${investmentCap}).`);
      }

      const actionSize = investments >= 8 ? 'large' : investments >= 4 ? 'medium' : 'small';
      let dc = 14 + investmentDcModifier(investments);
      if (actionSize === 'small' && player.holdings.tradeEnterprises.some((t) => t.tier === 'small')) dc -= 1;
      if (actionSize === 'medium' && player.holdings.tradeEnterprises.some((t) => t.tier === 'medium')) dc -= 1;
      if (actionSize === 'large' && player.holdings.tradeEnterprises.some((t) => t.tier === 'large')) dc -= 1;
      const collegiumTrade = player.holdings.organizations.find((o) => o.kind === 'collegiumTrade');
      if (collegiumTrade) dc -= 2 * postTierRank(collegiumTrade.tier);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.money, state.round);
      const total = roll.total + mod;
      const tier = resolveSuccessTier(dc, total);

      const multiplier =
        tier === 'veryGood'
          ? 0.75
          : tier === 'good'
            ? 0.9
            : tier === 'success'
              ? 1
              : tier === 'poor'
                ? 1.1
                : 0;

      const baseCostAdjusted =
        tier === 'fail' ? 0 : Math.ceil(baseCostGold * multiplier);

      const goldSpent =
        tier === 'fail' ? 0 : Math.max(0, baseCostAdjusted + marketDeltaGold);

      const finalBought = tier === 'fail' ? [] : bought;
      if (goldSpent > player.economy.gold) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');

      return [
        {
          type: 'PlayerMoneyBought',
          visibility: { scope: 'private', playerId },
          playerId,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tier,
          bought: finalBought as any,
          marketUsed,
          marketDeltaGold,
          goldSpent,
          actionCost,
          actionKey,
        },
      ];
    }

    case 'GainMaterials': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const baseActionKey = command.mode === 'domainAdministration' ? 'materials.domain' : 'materials.workshop';
      let actionKey = baseActionKey;
      let actionCost = 1;
      const bonusSlots = bonusMaterialsSlots(player);

      if (hasUsedCanonicalAction(player, baseActionKey)) {
        ensureActionAvailable(player, state.rules, baseActionKey, 1);
      }

      const hasBaseActions = player.turn.actionsUsed + 1 <= state.rules.actionsPerRound;
      if (!hasBaseActions && bonusSlots > 0) {
        const marker = 'bonus.materials.1';
        if (!hasUsedBonusMarker(player, marker)) {
          actionKey = `${baseActionKey}@${marker}`;
          actionCost = 0;
        } else {
          ensureActionAvailable(player, state.rules, baseActionKey, 1);
        }
      }

      ensureActionAvailable(player, state.rules, actionKey, actionCost);

      const investments = Math.trunc(command.investments);
      if (investments <= 0) throw new GameRuleError('INPUT', 'Investitionen müssen > 0 sein.');
      if (player.turn.laborAvailable < investments) throw new GameRuleError('FUNDS', 'Nicht genug Arbeitskraft.');

      const baseDc = command.mode === 'domainAdministration' ? 10 : 12;
      const actionSize = investments >= 8 ? 'large' : investments >= 4 ? 'medium' : 'small';

      let dc = baseDc + investmentDcModifier(investments);

      const collegiumCraft = player.holdings.organizations.find((o) => o.kind === 'collegiumCraft');
      if (collegiumCraft) dc -= 2 * postTierRank(collegiumCraft.tier);

      const pickDomainOrThrow = () => {
        if (command.targetId) {
          const d = player.holdings.domains.find((x) => x.id === command.targetId);
          if (!d) throw new GameRuleError('INPUT', 'Unbekannte Domäne.');
          return d;
        }
        if (player.holdings.domains.length === 1) return player.holdings.domains[0];
        throw new GameRuleError('INPUT', 'targetId erforderlich (mehrere Domänen vorhanden).');
      };

      const pickWorkshopOrThrow = () => {
        if (command.targetId) {
          const w = player.holdings.workshops.find((x) => x.id === command.targetId);
          if (!w) throw new GameRuleError('INPUT', 'Unbekannte Werkstatt.');
          return w;
        }
        if (player.holdings.workshops.length === 1) return player.holdings.workshops[0];
        throw new GameRuleError('INPUT', 'targetId erforderlich (mehrere Werkstätten vorhanden).');
      };

      if (command.mode === 'domainAdministration') {
        const domain = pickDomainOrThrow();
        const rank = domain.tier === 'starter' ? 1 : postTierRank(domain.tier);
        const investmentCap = 4 * rank;
        if (investments > investmentCap) {
          throw new GameRuleError('INPUT', `Zu viele Investitionen (max. ${investmentCap}).`);
        }
        // Domänen-Vorteil: Senkt Materialgewinn-DC je nach Aktionsgröße um 1.
        if (actionSize === 'small' && domain.tier === 'small') dc -= 1;
        if (actionSize === 'medium' && domain.tier === 'medium') dc -= 1;
        if (actionSize === 'large' && domain.tier === 'large') dc -= 1;
      } else {
        const workshop = pickWorkshopOrThrow();
        const investmentCap = 2 * postTierRank(workshop.tier);
        if (investments > investmentCap) {
          throw new GameRuleError('INPUT', `Zu viele Investitionen (max. ${investmentCap}).`);
        }
      }

      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.materials, state.round);
      const total = roll.total + mod;
      const tier = resolveSuccessTier(dc, total);

      let perInvRaw = 0;
      let perInvSpecial = 0;
      if (command.mode === 'domainAdministration') {
        if (tier === 'veryGood') perInvRaw = 16;
        else if (tier === 'good') perInvRaw = 12;
        else if (tier === 'success') perInvRaw = 8;
        else if (tier === 'poor') perInvRaw = 1;
        else perInvRaw = 0;
      } else {
        if (tier === 'veryGood') perInvSpecial = 3;
        else if (tier === 'good') perInvSpecial = 2;
        else if (tier === 'success') perInvSpecial = 1;
        else if (tier === 'poor') perInvSpecial = 0.5;
        else perInvSpecial = 0;
      }

      const rawGained: MaterialStock = {};
      const specialGained: MaterialStock = {};
      if (perInvRaw) {
        const totalRaw = investments * perInvRaw;
        const domain = pickDomainOrThrow();
        const spec = domain.specialization?.kind;
        if (spec === 'agriculture') {
          rawGained['raw.grainVeg'] = (rawGained['raw.grainVeg'] ?? 0) + totalRaw;
        } else if (spec === 'forestry') {
          rawGained['raw.wood'] = (rawGained['raw.wood'] ?? 0) + totalRaw;
        } else if (spec === 'mining') {
          rawGained['raw.ironSteel'] = (rawGained['raw.ironSteel'] ?? 0) + totalRaw;
        } else if (spec === 'animalHusbandry') {
          rawGained['raw.meat'] = (rawGained['raw.meat'] ?? 0) + totalRaw;
        } else {
          const wood = Math.ceil(totalRaw / 2);
          const food = totalRaw - wood;
          rawGained['raw.wood'] = (rawGained['raw.wood'] ?? 0) + wood;
          rawGained['raw.grainVeg'] = (rawGained['raw.grainVeg'] ?? 0) + food;
        }
      }
      if (perInvSpecial) {
        specialGained['special.tools'] = (specialGained['special.tools'] ?? 0) + Math.floor(investments * perInvSpecial);
      }

      return [
        {
          type: 'PlayerMaterialsGained',
          visibility: { scope: 'private', playerId },
          playerId,
          mode: command.mode,
          investments,
          targetId: command.targetId,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tier,
          laborSpent: investments,
          rawGained,
          specialGained,
          actionCost,
          actionKey,
        },
      ];
    }

    case 'AcquireDomain': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const actionKey = 'acquire.domain';
      ensureActionAvailable(player, state.rules, actionKey, 1);

      const tier: Exclude<DomainTier, 'starter'> = command.tier;
      const baseCost = tier === 'small' ? 35 : tier === 'medium' ? 80 : 120;
      const baseDc = 10;
      const dc = actionDcForAcquire(baseDc, tier);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tierResult = resolveSuccessTier(dc, total);
      const costMultiplier = tierResult === 'veryGood' ? 0.75 : tierResult === 'good' ? 0.9 : tierResult === 'poor' ? 1.1 : 1;
      const domainId = generateId('domain', player.holdings.domains);
      const goldSpent = tierResult === 'fail' ? 0 : Math.ceil(baseCost * costMultiplier);
      if (tierResult !== 'fail' && player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      return [
        {
          type: 'PlayerDomainAcquired',
          visibility: { scope: 'private', playerId },
          playerId,
          domainId,
          tier,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tierResult,
          goldSpent,
          actionCost: 1,
          actionKey,
        },
      ];
    }

    case 'AcquireCityProperty': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const actionKey = 'acquire.cityProperty';
      ensureActionAvailable(player, state.rules, actionKey, 1);

      const tier: CityPropertyTier = command.tier;
      let baseCost = tier === 'small' ? 15 : tier === 'medium' ? 25 : 50;

      // Event 30: Große Feuersbrunst in der Stadt → Bei 1-5 auf w20 Preis für Städtischen Besitz halbiert (1 Runde).
      const fireDiscountActive = state.globalEvents.some(
        (e) => state.round >= e.startsAtRound && state.round <= e.endsAtRound && e.tableRollTotal === 30,
      );
      if (fireDiscountActive) {
        const discountRoll = rollD20(ctx.rng);
        if (discountRoll.total <= 5) baseCost = Math.floor(baseCost / 2);
      }
      const baseDc = 10;
      const dc = actionDcForAcquire(baseDc, tier);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tierResult = resolveSuccessTier(dc, total);
      const costMultiplier = tierResult === 'veryGood' ? 0.75 : tierResult === 'good' ? 0.9 : tierResult === 'poor' ? 1.1 : 1;
      const cityPropertyId = generateId('city', player.holdings.cityProperties);
      const goldSpent = tierResult === 'fail' ? 0 : Math.ceil(baseCost * costMultiplier);
      if (tierResult !== 'fail' && player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      return [
        {
          type: 'PlayerCityPropertyAcquired',
          visibility: { scope: 'private', playerId },
          playerId,
          cityPropertyId,
          tier,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tierResult,
          goldSpent,
          actionCost: 1,
          actionKey,
        },
      ];
    }

    case 'SetCityPropertyMode': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      return [
        {
          type: 'PlayerCityPropertyModeSet',
          visibility: { scope: 'private', playerId },
          playerId,
          cityPropertyId: command.cityPropertyId,
          mode: command.mode,
        },
      ];
    }

    case 'AcquireOffice': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const actionKey = 'acquire.office';
      ensureActionAvailable(player, state.rules, actionKey, 1);

      const tier: PostTier = command.tier;
      if (tier === 'medium') {
        const smallCount = player.holdings.offices.filter((o) => o.tier === 'small').length;
        if (smallCount < 2) throw new GameRuleError('RULE', 'Für ein mittleres Amt werden 2 kleine Ämter benötigt.');
      }
      if (tier === 'large') {
        const mediumCount = player.holdings.offices.filter((o) => o.tier === 'medium').length;
        if (mediumCount < 2) throw new GameRuleError('RULE', 'Für ein großes Amt werden 2 mittlere Ämter benötigt.');
      }

      const baseDc = 14;
      const dc = actionDcForAcquire(baseDc, tier);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tierResult = resolveSuccessTier(dc, total);

      const cost = tier === 'small' ? { goldA: 8, infA: 2, goldB: 4, infB: 8 } : tier === 'medium' ? { goldA: 18, infA: 8, goldB: 10, infB: 18 } : { goldA: 70, infA: 20, goldB: 24, infB: 70 };
      const baseGold = command.payment === 'goldFirst' ? cost.goldA : cost.goldB;
      const baseInfluence = command.payment === 'goldFirst' ? cost.infA : cost.infB;
      const costMultiplier = tierResult === 'veryGood' ? 0.75 : tierResult === 'good' ? 0.9 : tierResult === 'poor' ? 1.1 : 1;
      const goldSpent = tierResult === 'fail' ? 0 : Math.ceil(baseGold * costMultiplier);
      const influenceSpent = tierResult === 'fail' ? 0 : Math.ceil(baseInfluence * costMultiplier);
      if (tierResult !== 'fail' && player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      if (tierResult !== 'fail' && player.turn.influenceAvailable < influenceSpent) throw new GameRuleError('FUNDS', 'Nicht genug Einfluss.');
      const officeId = generateId('office', player.holdings.offices);

      return [
        {
          type: 'PlayerOfficeAcquired',
          visibility: { scope: 'private', playerId },
          playerId,
          officeId,
          tier,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tierResult,
          goldSpent,
          influenceSpent,
          actionCost: 1,
          actionKey,
        },
      ];
    }

    case 'SetOfficeYieldMode': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      return [
        {
          type: 'PlayerOfficeYieldModeSet',
          visibility: { scope: 'private', playerId },
          playerId,
          officeId: command.officeId,
          mode: command.mode,
        },
      ];
    }

    case 'AcquireOrganization': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const actionKey = `acquire.org.${command.kind}`;
      ensureActionAvailable(player, state.rules, actionKey, 1);

      const existing = player.holdings.organizations.find((o) => o.kind === command.kind);
      const fromTier: PostTier = existing?.tier ?? 'small';
      const toTier: PostTier = existing ? (existing.tier === 'small' ? 'medium' : 'large') : 'small';
      if (existing && existing.tier === 'large') throw new GameRuleError('STATE', 'Bereits auf maximaler Stufe.');

      // HQ-Anforderung: pro Stufe des Circels braucht man einen Stadtbesitz entsprechender Größe.
      const requiredHqTier = postTierRank(toTier);
      const maxCityTier = Math.max(0, ...player.holdings.cityProperties.map((c) => postTierRank(c.tier)));
      if (maxCityTier < requiredHqTier) {
        throw new GameRuleError('RULE', `Für Stufe ${toTier} wird ein Städtischer Besitz der Größe ${toTier} als Hauptquartier benötigt.`);
      }

      const baseDc = command.kind.startsWith('collegium') ? 12 : 14;
      const dc = actionDcForAcquire(baseDc, toTier);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tierResult = resolveSuccessTier(dc, total);

      const baseCost = command.kind === 'cult' ? { gold: 10, influence: 6 } : command.kind.startsWith('collegium') ? { gold: 20, influence: 2 } : { gold: 16, influence: 6 };
      const rank = postTierRank(toTier);
      const costMultiplier = tierResult === 'veryGood' ? 0.75 : tierResult === 'good' ? 0.9 : tierResult === 'poor' ? 1.1 : 1;
      const goldSpent = tierResult === 'fail' ? 0 : Math.ceil(baseCost.gold * rank * costMultiplier);
      const influenceSpent = tierResult === 'fail' ? 0 : Math.ceil(baseCost.influence * rank * costMultiplier);
      if (tierResult !== 'fail' && player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      if (tierResult !== 'fail' && player.turn.influenceAvailable < influenceSpent) throw new GameRuleError('FUNDS', 'Nicht genug Einfluss.');
      const organizationId = existing?.id ?? generateId('org', player.holdings.organizations);

      return [
        {
          type: 'PlayerOrganizationAcquired',
          visibility: { scope: 'private', playerId },
          playerId,
          organizationId,
          kind: command.kind,
          fromTier,
          toTier,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tierResult,
          goldSpent,
          influenceSpent,
          actionCost: 1,
          actionKey,
        },
      ];
    }

    case 'AcquireTradeEnterprise': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const actionKey = 'acquire.trade';
      ensureActionAvailable(player, state.rules, actionKey, 1);

      const tier = command.tier;
      // 🧩 Regeltext nennt keine Kaufkosten für Handelsunternehmungen; v1-Interpretation:
      // Klein/Mittel/Groß: 20/40/80 Gold.
      const baseCost = tier === 'small' ? 20 : tier === 'medium' ? 40 : 80;
      const baseDc = 10;
      const dc = actionDcForAcquire(baseDc, tier);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tierResult = resolveSuccessTier(dc, total);

      const costMultiplier = tierResult === 'veryGood' ? 0.75 : tierResult === 'good' ? 0.9 : tierResult === 'poor' ? 1.1 : 1;
      const goldSpent = tierResult === 'fail' ? 0 : Math.ceil(baseCost * costMultiplier);
      if (tierResult !== 'fail' && player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      const tradeEnterpriseId = generateId('trade', player.holdings.tradeEnterprises);
      return [
        {
          type: 'PlayerTradeEnterpriseAcquired',
          visibility: { scope: 'private', playerId },
          playerId,
          tradeEnterpriseId,
          tier,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tierResult,
          goldSpent,
          actionCost: 1,
          actionKey,
        },
      ];
    }

    case 'SetTradeEnterpriseMode': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      return [
        {
          type: 'PlayerTradeEnterpriseModeSet',
          visibility: { scope: 'private', playerId },
          playerId,
          tradeEnterpriseId: command.tradeEnterpriseId,
          mode: command.mode,
        },
      ];
    }

    case 'AcquireTenants': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const actionKey = 'acquire.tenants';
      ensureActionAvailable(player, state.rules, actionKey, 1);

      const levels = Math.trunc(command.levels);
      if (levels <= 0) throw new GameRuleError('INPUT', 'levels muss > 0 sein.');

      const location = command.location;
      let currentLevels = 0;
      let maxLevels = 0;
      let goldPerLevel = 12;
      let influencePerLevel = 4;

      if (location.kind === 'domain') {
        const domain = player.holdings.domains.find((d) => d.id === location.id);
        if (!domain) throw new GameRuleError('INPUT', 'Unbekannte Domäne.');
        if (domain.tier === 'starter') {
          throw new GameRuleError('RULE', 'Auf Starter-Domänen können keine Pächter angeworben werden (erst ausbauen).');
        }
        currentLevels = domain.tenants.levels;
        maxLevels = domain.tier === 'small' ? 2 : domain.tier === 'medium' ? 4 : 8;
      } else if (location.kind === 'cityProperty') {
        const city = player.holdings.cityProperties.find((c) => c.id === location.id);
        if (!city) throw new GameRuleError('INPUT', 'Unbekannter städtischer Besitz.');
        currentLevels = city.tenants.levels;
        maxLevels = city.tier === 'small' ? 2 : city.tier === 'medium' ? 3 : 4;
      } else {
        const org = player.holdings.organizations.find((o) => o.id === location.id);
        if (!org) throw new GameRuleError('INPUT', 'Unbekannter Circel/Organisation.');
        if (org.kind === 'spy') throw new GameRuleError('RULE', 'Spionageringe haben keine Anhänger.');

        currentLevels = org.followers.levels;

        const tierRank = postTierRank(org.tier);
        if (org.kind === 'underworld') {
          maxLevels = 2 * tierRank; // 2/4/6
          goldPerLevel = 12;
          influencePerLevel = 10;
        } else if (org.kind === 'cult') {
          maxLevels = tierRank === 1 ? 2 : tierRank === 2 ? 4 : 8;
          goldPerLevel = 8;
          influencePerLevel = 8;
        } else {
          // Collegien: Standardkosten, Cap = 1/2/3
          maxLevels = tierRank;
        }
      }

      if (currentLevels + levels > maxLevels) {
        throw new GameRuleError('RULE', `Zu viele Stufen (max. ${maxLevels}, aktuell: ${currentLevels}).`);
      }

      // Kosten (Events können diese verändern)
      let baseGold = levels * goldPerLevel;
      let baseInfluence = levels * influencePerLevel;

      // Event 11: Gute Ernte → Pächterstufen sind um die Hälfte verbilligt (Interpretation: Gold+Einfluss, nur Domäne/Stadt).
      const hasGoodHarvest = state.globalEvents.some(
        (e) => state.round >= e.startsAtRound && state.round <= e.endsAtRound && e.tableRollTotal === 11,
      );
      if (hasGoodHarvest && (location.kind === 'domain' || location.kind === 'cityProperty')) {
        baseGold = Math.ceil(baseGold / 2);
        baseInfluence = Math.ceil(baseInfluence / 2);
      }

      const baseDc = 14;
      const dc = baseDc + investmentDcModifier(levels);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tierResult = resolveSuccessTier(dc, total);

      const costMultiplier = tierResult === 'veryGood' ? 0.75 : tierResult === 'good' ? 0.9 : tierResult === 'poor' ? 1.1 : 1;
      const goldSpent = tierResult === 'fail' ? 0 : Math.ceil(baseGold * costMultiplier);
      const influenceSpent = tierResult === 'fail' ? 0 : Math.ceil(baseInfluence * costMultiplier);
      if (tierResult !== 'fail' && player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      if (tierResult !== 'fail' && player.turn.influenceAvailable < influenceSpent) throw new GameRuleError('FUNDS', 'Nicht genug Einfluss.');
      return [
        {
          type: 'PlayerTenantsAcquired',
          visibility: { scope: 'private', playerId },
          playerId,
          location,
          levels,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tierResult,
          goldSpent,
          influenceSpent,
          actionCost: 1,
          actionKey,
        },
      ];
    }

    case 'RecruitTroops': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const actionKey = `troops.${command.troopKind}`;
      ensureActionAvailable(player, state.rules, actionKey, 1);

      const levels = Math.trunc(command.levels);
      if (levels <= 0) throw new GameRuleError('INPUT', 'levels muss > 0 sein.');

      const current =
        command.troopKind === 'bodyguard'
          ? player.holdings.troops.bodyguardLevels
          : command.troopKind === 'militia'
            ? player.holdings.troops.militiaLevels
            : command.troopKind === 'mercenary'
              ? player.holdings.troops.mercenaryLevels
              : player.holdings.troops.thugLevels;

      const maxBodyguard =
        3 +
        player.holdings.offices.reduce(
          (sum, o) => sum + (o.tier === 'small' ? 1 : o.tier === 'medium' ? 3 : 4),
          0,
        );
      const maxMilitia = player.holdings.domains.reduce(
        (sum, d) => sum + (d.tier === 'small' ? 2 : d.tier === 'medium' ? 4 : d.tier === 'large' ? 8 : 0),
        0,
      );
      const maxMercenary = 4;
      const maxThug =
        player.holdings.cityProperties.reduce(
          (sum, c) => sum + (c.tier === 'small' ? 1 : c.tier === 'medium' ? 2 : 3),
          0,
        ) +
        player.holdings.organizations.reduce(
          (sum, o) =>
            o.kind === 'underworld' || o.kind === 'cult' ? sum + 2 * postTierRank(o.tier) : sum,
          0,
        );

      const cap =
        command.troopKind === 'bodyguard'
          ? maxBodyguard
          : command.troopKind === 'militia'
            ? maxMilitia
            : command.troopKind === 'mercenary'
              ? maxMercenary
              : maxThug;

      if (current + levels > cap) {
        throw new GameRuleError('RULE', `Zu viele Stufen (max. ${cap}).`);
      }

      const dc = 10 + investmentDcModifier(levels);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tierResult = resolveSuccessTier(dc, total);

      const costMultiplier = tierResult === 'veryGood' ? 0.75 : tierResult === 'good' ? 0.9 : tierResult === 'poor' ? 1.1 : 1;

      let goldSpent = 0;
      let influenceSpent = 0;
      const rawSpent: MaterialStock = {};
      const specialSpent: MaterialStock = {};

      if (command.troopKind === 'militia') {
        goldSpent = 6 * levels;
        specialSpent['special.weapons'] = levels;
      } else if (command.troopKind === 'mercenary') {
        // Event 17: Söldnerkosten halbiert (nur Rekrutierungskosten)
        const mercenaryHalf = state.globalEvents.some(
          (e) => state.round >= e.startsAtRound && state.round <= e.endsAtRound && e.tableRollTotal === 17,
        );
        goldSpent = (mercenaryHalf ? 4 : 8) * levels;
      } else if (command.troopKind === 'thug') {
        goldSpent = 4 * levels;
        influenceSpent = 2 * levels;
      } else if (command.troopKind === 'bodyguard') {
        goldSpent = 12 * levels;
        influenceSpent = 4 * levels;
        specialSpent['special.armor'] = levels;
        specialSpent['special.weapons'] = levels;
      }

      // Event 25: Verdoppelte Truppenkosten (Gold/Einfluss)
      const troopCostsDouble = state.globalEvents.some(
        (e) => state.round >= e.startsAtRound && state.round <= e.endsAtRound && e.tableRollTotal === 25,
      );
      if (troopCostsDouble) {
        goldSpent *= 2;
        influenceSpent *= 2;
      }

      goldSpent = tierResult === 'fail' ? 0 : Math.ceil(goldSpent * costMultiplier);
      influenceSpent = tierResult === 'fail' ? 0 : Math.ceil(influenceSpent * costMultiplier);

      if (tierResult !== 'fail' && player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      if (tierResult !== 'fail' && player.turn.influenceAvailable < influenceSpent) throw new GameRuleError('FUNDS', 'Nicht genug Einfluss.');
      if (tierResult !== 'fail') {
        for (const [materialId, count] of Object.entries(specialSpent)) {
          const have = player.economy.inventory.special[materialId] ?? 0;
          if (have < count) throw new GameRuleError('RESOURCES', `Nicht genug SM: ${materialId}.`);
        }
      }

      const finalRawSpent = tierResult === 'fail' ? {} : rawSpent;
      const finalSpecialSpent = tierResult === 'fail' ? {} : specialSpent;

      return [
        {
          type: 'PlayerTroopsRecruited',
          visibility: { scope: 'private', playerId },
          playerId,
          troopKind: command.troopKind === 'mercenary' ? 'mercenary' : command.troopKind,
          levels,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tierResult,
          goldSpent,
          influenceSpent,
          rawSpent: finalRawSpent,
          specialSpent: finalSpecialSpent,
          actionCost: 1,
          actionKey,
        },
      ];
    }

    case 'BuildWorkshop': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const location = command.location;
      if (location.kind === 'domain') {
        const domain = player.holdings.domains.find((d) => d.id === location.id);
        if (!domain) throw new GameRuleError('INPUT', 'Unbekannte Domäne.');
        if (domain.tier === 'starter') throw new GameRuleError('RULE', 'Erst Starter-Domäne ausbauen, bevor weitere Werkstätten gebaut werden.');
        const used = countFacilitySlotsUsedAtDomain(player.holdings, domain.id);
        const max = domainFacilitySlotsMax(domain.tier);
        if (used + 1 > max) throw new GameRuleError('RULE', 'Nicht genug Einrichtungsplätze auf dieser Domäne.');
      } else {
        const city = player.holdings.cityProperties.find((c) => c.id === location.id);
        if (!city) throw new GameRuleError('INPUT', 'Unbekannter städtischer Besitz.');
        if (city.mode !== 'production') throw new GameRuleError('RULE', 'Werkstätten können nur bei Eigenproduktion im Stadtbesitz betrieben werden.');
        const usedSlots = countFacilitySlotsUsedAtCity(player.holdings, city.id);
        const maxSlots = cityFacilitySlotsMax(city.tier);
        if (usedSlots + 1 > maxSlots) throw new GameRuleError('RULE', 'Nicht genug Einrichtungsplätze im Stadtbesitz.');
        const usedUnits = countProductionUnitsUsedAtCity(player.holdings, city.id);
        const maxUnits = productionCapacityUnitsMaxForCity(city.tier);
        if (usedUnits + tierUnits(command.tier) > maxUnits) throw new GameRuleError('RULE', 'Nicht genug Produktionskapazität (Werkstatt/Lager) im Stadtbesitz.');
      }

      const requiredTier =
        command.tier === 'large' ? 'experienced' : command.tier === 'medium' ? 'simple' : null;
      if (requiredTier) {
        const has = player.holdings.specialists.some(
          (s) =>
            (s.kind === 'artisan' || s.kind === 'workshop') &&
            (requiredTier === 'simple'
              ? true
              : s.tier === 'experienced' || s.tier === 'master'),
        );
        if (!has) throw new GameRuleError('RULE', 'Für diese Werkstattgröße wird ein Handwerksmeister (Fachkraft) benötigt.');
      }

      const { usedFree } = consumeFacilityOrAction(player, state.rules);
      const goldSpent = command.tier === 'small' ? 8 : command.tier === 'medium' ? 16 : 40;
      if (player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      const workshopId = generateId('workshop', player.holdings.workshops);

      return [
        {
          type: 'PlayerWorkshopBuilt',
          visibility: { scope: 'private', playerId },
          playerId,
          workshopId,
          location,
          tier: command.tier,
          goldSpent,
          usedFreeFacilityBuild: usedFree,
        },
      ];
    }

    case 'UpgradeWorkshop': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const workshop = player.holdings.workshops.find((w) => w.id === command.workshopId);
      if (!workshop) throw new GameRuleError('INPUT', 'Unbekannte Werkstatt.');
      if (workshop.tier === 'large') throw new GameRuleError('RULE', 'Werkstatt ist bereits auf maximaler Stufe.');
      const expectedNext = workshop.tier === 'small' ? 'medium' : 'large';
      if (command.toTier !== expectedNext) throw new GameRuleError('RULE', `Upgrade nur auf nächste Stufe möglich (${expectedNext}).`);

      const requiredTier = command.toTier === 'large' ? 'experienced' : 'simple';
      const has = player.holdings.specialists.some(
        (s) =>
          (s.kind === 'artisan' || s.kind === 'workshop') &&
          (requiredTier === 'simple'
            ? true
            : s.tier === 'experienced' || s.tier === 'master'),
      );
      if (!has) throw new GameRuleError('RULE', 'Für dieses Upgrade wird ein Handwerksmeister (Fachkraft) benötigt.');

      if (workshop.location.kind === 'cityProperty') {
        const city = player.holdings.cityProperties.find((c) => c.id === workshop.location.id);
        if (!city) throw new GameRuleError('STATE', 'Stadtbesitz der Werkstatt fehlt.');
        if (city.mode !== 'production') throw new GameRuleError('RULE', 'Werkstätten können nur bei Eigenproduktion im Stadtbesitz betrieben werden.');
        const usedUnits = countProductionUnitsUsedAtCity(player.holdings, city.id);
        const maxUnits = productionCapacityUnitsMaxForCity(city.tier);
        const deltaUnits = tierUnits(command.toTier) - tierUnits(workshop.tier);
        if (usedUnits + deltaUnits > maxUnits) throw new GameRuleError('RULE', 'Nicht genug Produktionskapazität (Werkstatt/Lager) im Stadtbesitz.');
      }

      const { usedFree } = consumeFacilityOrAction(player, state.rules);
      const baseCost = (tier: WorkshopTier) => (tier === 'small' ? 8 : tier === 'medium' ? 16 : 40);
      const goldSpent = baseCost(command.toTier) - baseCost(workshop.tier);
      if (goldSpent <= 0) throw new GameRuleError('STATE', 'Ungültige Upgrade-Kosten.');
      if (player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');

      return [
        {
          type: 'PlayerWorkshopUpgraded',
          visibility: { scope: 'private', playerId },
          playerId,
          workshopId: workshop.id,
          fromTier: workshop.tier,
          toTier: command.toTier,
          goldSpent,
          usedFreeFacilityBuild: usedFree,
        },
      ];
    }

    case 'BuildStorage': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const location = command.location;
      if (location.kind === 'domain') {
        const domain = player.holdings.domains.find((d) => d.id === location.id);
        if (!domain) throw new GameRuleError('INPUT', 'Unbekannte Domäne.');
        if (domain.tier === 'starter') throw new GameRuleError('RULE', 'Erst Starter-Domäne ausbauen, bevor Lager gebaut werden.');
        const used = countFacilitySlotsUsedAtDomain(player.holdings, domain.id);
        const max = domainFacilitySlotsMax(domain.tier);
        if (used + 1 > max) throw new GameRuleError('RULE', 'Nicht genug Einrichtungsplätze auf dieser Domäne.');
      } else {
        const city = player.holdings.cityProperties.find((c) => c.id === location.id);
        if (!city) throw new GameRuleError('INPUT', 'Unbekannter städtischer Besitz.');
        if (city.mode !== 'production') throw new GameRuleError('RULE', 'Lager können nur bei Eigenproduktion im Stadtbesitz betrieben werden.');
        const usedSlots = countFacilitySlotsUsedAtCity(player.holdings, city.id);
        const maxSlots = cityFacilitySlotsMax(city.tier);
        if (usedSlots + 1 > maxSlots) throw new GameRuleError('RULE', 'Nicht genug Einrichtungsplätze im Stadtbesitz.');
        const usedUnits = countProductionUnitsUsedAtCity(player.holdings, city.id);
        const maxUnits = productionCapacityUnitsMaxForCity(city.tier);
        if (usedUnits + tierUnits(command.tier) > maxUnits) throw new GameRuleError('RULE', 'Nicht genug Produktionskapazität (Werkstatt/Lager) im Stadtbesitz.');
      }

      const { usedFree } = consumeFacilityOrAction(player, state.rules);
      const goldSpent = command.tier === 'small' ? 8 : command.tier === 'medium' ? 16 : 40;
      if (player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      const storageId = generateId('storage', player.holdings.storages);

      return [
        {
          type: 'PlayerStorageBuilt',
          visibility: { scope: 'private', playerId },
          playerId,
          storageId,
          location,
          tier: command.tier,
          goldSpent,
          usedFreeFacilityBuild: usedFree,
        },
      ];
    }

    case 'UpgradeStorage': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const storage = player.holdings.storages.find((s) => s.id === command.storageId);
      if (!storage) throw new GameRuleError('INPUT', 'Unbekanntes Lager.');
      if (storage.tier === 'large') throw new GameRuleError('RULE', 'Lager ist bereits auf maximaler Stufe.');
      const expectedNext = storage.tier === 'small' ? 'medium' : 'large';
      if (command.toTier !== expectedNext) throw new GameRuleError('RULE', `Upgrade nur auf nächste Stufe möglich (${expectedNext}).`);

      if (storage.location.kind === 'cityProperty') {
        const city = player.holdings.cityProperties.find((c) => c.id === storage.location.id);
        if (!city) throw new GameRuleError('STATE', 'Stadtbesitz des Lagers fehlt.');
        if (city.mode !== 'production') throw new GameRuleError('RULE', 'Lager können nur bei Eigenproduktion im Stadtbesitz betrieben werden.');
        const usedUnits = countProductionUnitsUsedAtCity(player.holdings, city.id);
        const maxUnits = productionCapacityUnitsMaxForCity(city.tier);
        const deltaUnits = tierUnits(command.toTier) - tierUnits(storage.tier);
        if (usedUnits + deltaUnits > maxUnits) throw new GameRuleError('RULE', 'Nicht genug Produktionskapazität (Werkstatt/Lager) im Stadtbesitz.');
      }

      const { usedFree } = consumeFacilityOrAction(player, state.rules);
      const baseCost = (tier: StorageTier) => (tier === 'small' ? 8 : tier === 'medium' ? 16 : 40);
      const goldSpent = baseCost(command.toTier) - baseCost(storage.tier);
      if (goldSpent <= 0) throw new GameRuleError('STATE', 'Ungültige Upgrade-Kosten.');
      if (player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');

      return [
        {
          type: 'PlayerStorageUpgraded',
          visibility: { scope: 'private', playerId },
          playerId,
          storageId: storage.id,
          fromTier: storage.tier,
          toTier: command.toTier,
          goldSpent,
          usedFreeFacilityBuild: usedFree,
        },
      ];
    }

    case 'BuildFacility': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const { usedFree } = consumeFacilityOrAction(player, state.rules);

      const location = command.location;
      let existingFacilities: Array<{ id: string }> | undefined;
      let usedSlots = 0;
      let maxSlots = Number.POSITIVE_INFINITY;
      switch (location.kind) {
        case 'domain':
          {
            const domain = player.holdings.domains.find((d) => d.id === location.id);
            existingFacilities = domain?.facilities;
            if (domain) {
              usedSlots = countFacilitySlotsUsedAtDomain(player.holdings, domain.id);
              maxSlots = domainFacilitySlotsMax(domain.tier);
            }
          }
          break;
        case 'cityProperty':
          {
            const city = player.holdings.cityProperties.find((c) => c.id === location.id);
            existingFacilities = city?.facilities;
            if (city) {
              usedSlots = countFacilitySlotsUsedAtCity(player.holdings, city.id);
              maxSlots = cityFacilitySlotsMax(city.tier);
            }
          }
          break;
        case 'organization':
          {
            const org = player.holdings.organizations.find((o) => o.id === location.id);
            existingFacilities = org?.facilities;
            if (org) {
              usedSlots = org.facilities.length;
              maxSlots = 2 * postTierRank(org.tier);
            }
          }
          break;
        case 'office':
          {
            const office = player.holdings.offices.find((o) => o.id === location.id);
            existingFacilities = office?.facilities;
            if (office) {
              usedSlots = office.facilities.length;
              maxSlots = cityFacilitySlotsMax(office.tier);
            }
          }
          break;
        case 'tradeEnterprise':
          {
            const te = player.holdings.tradeEnterprises.find((t) => t.id === location.id);
            existingFacilities = te?.facilities;
            if (te) {
              usedSlots = te.facilities.length;
              maxSlots = 2 * postTierRank(te.tier);
            }
          }
          break;
        case 'troops':
          existingFacilities = player.holdings.troops.facilities;
          break;
        default:
          existingFacilities = undefined;
      }

      if (!existingFacilities) {
        throw new GameRuleError('INPUT', 'Ungültiger Ort für Einrichtung.');
      }

      if (usedSlots + 1 > maxSlots) {
        throw new GameRuleError('RULE', 'Nicht genug Einrichtungsplätze.');
      }

      const [category, size] = command.facilityKey.split('.', 2);
      const tier: PostTier | null = size === 'small' || size === 'medium' || size === 'large' ? (size as PostTier) : null;
      if (!tier) throw new GameRuleError('INPUT', 'facilityKey muss ein Tier enthalten (small/medium/large).');

      let goldSpent =
        category === 'general'
          ? tier === 'small'
            ? 8
            : tier === 'medium'
              ? 12
              : 30
          : category === 'special'
            ? tier === 'small'
              ? 10
              : tier === 'medium'
                ? 20
                : 40
            : null;
      if (!goldSpent) throw new GameRuleError('INPUT', 'Unbekannte Einrichtung (erwartet: general.* oder special.*).');

      const activeEvents = state.globalEvents.filter(
        (e) => state.round >= e.startsAtRound && state.round <= e.endsAtRound,
      );

      // Event 23: Erhöhte Steuereinnahmen → Kosten Allgemeiner Amtseinrichtungen verdoppelt (5 Runden).
      if (location.kind === 'office' && category === 'general' && activeEvents.some((e) => e.tableRollTotal === 23)) {
        goldSpent *= 2;
      }

      // Event 13: Zusammenbruch einer großen Handelsunternehmung → Handelsunternehmungs-Einrichtungen 1 Runde halbiert.
      // (Regeltext: "Möglichkeit ... günstig Einrichtungen zu erwerben" → v1: gilt in der Start-Runde des Ereignisses.)
      if (
        location.kind === 'tradeEnterprise' &&
        activeEvents.some((e) => e.tableRollTotal === 13 && state.round === e.startsAtRound)
      ) {
        goldSpent = Math.max(0, Math.ceil(goldSpent / 2));
      }

      if (player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');

      const facilityInstanceId = generateFacilityInstanceId(location as any, existingFacilities);
      return [
        {
          type: 'PlayerFacilityBuilt',
          visibility: { scope: 'private', playerId },
          playerId,
          location: location as any,
          facilityInstanceId,
          facilityKey: command.facilityKey,
          goldSpent,
          influenceSpent: 0,
          laborSpent: 0,
          rawSpent: {},
          specialSpent: {},
          magicPowerSpent: 0,
          usedFreeFacilityBuild: usedFree,
        },
      ];
    }

    case 'SetDomainSpecialization': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const domain = player.holdings.domains.find((d) => d.id === command.domainId);
      if (!domain) throw new GameRuleError('INPUT', 'Unbekannte Domäne.');
      if (domain.tier === 'starter') throw new GameRuleError('RULE', 'Starter-Domänen können nicht spezialisiert werden (erst ausbauen).');
      if (domain.specialization) throw new GameRuleError('RULE', 'Domäne ist bereits spezialisiert.');

      const { usedFree } = consumeFacilityOrAction(player, state.rules);

      let goldSpent = 0;
      let rawSpent: MaterialStock = {};

      if (command.kind === 'agriculture') {
        goldSpent = 10;
        const preferred = command.picks?.costRawId ?? 'raw.grainVeg';
        const mat = getMaterialOrThrow(preferred);
        if (mat.kind !== 'raw') throw new GameRuleError('INPUT', 'costRawId muss ein Rohmaterial sein.');
        rawSpent = { [preferred]: 2 };
      } else if (command.kind === 'animalHusbandry') {
        goldSpent = 15;
        const animalIds = Object.keys(player.economy.inventory.raw).filter((id) => {
          try {
            return getMaterialOrThrow(id).tags.includes('animal');
          } catch {
            return false;
          }
        });
        const order = (ids: string[]) =>
          [...ids].sort((a, b) => {
            const ma = getMaterialOrThrow(a);
            const mb = getMaterialOrThrow(b);
            const tier = materialTierRank(ma.tier) - materialTierRank(mb.tier);
            if (tier) return tier;
            return a.localeCompare(b);
          });
        const animalStock: MaterialStock = {};
        for (const id of animalIds) animalStock[id] = player.economy.inventory.raw[id] ?? 0;
        const { taken } = takeFromStock(animalStock, 4, order);
        if (sumStock(taken) < 4) throw new GameRuleError('RESOURCES', 'Nicht genug Tiere (RM mit Tag "animal").');
        rawSpent = taken;
      } else if (command.kind === 'forestry') {
        goldSpent = 6;
        rawSpent = {};
      } else if (command.kind === 'mining') {
        // Minimal-Interpretation (Steinbruch): 20 Gold, 4 RM Bauholz.
        goldSpent = 20;
        rawSpent = { 'raw.wood': 4 };
      }

      if (player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      for (const [materialId, count] of Object.entries(rawSpent)) {
        const have = player.economy.inventory.raw[materialId] ?? 0;
        if (have < count) throw new GameRuleError('RESOURCES', `Nicht genug RM: ${materialId}.`);
      }

      return [
        {
          type: 'PlayerDomainSpecializationSet',
          visibility: { scope: 'private', playerId },
          playerId,
          domainId: command.domainId,
          kind: command.kind,
          picks: command.picks,
          goldSpent,
          rawSpent,
          usedFreeFacilityBuild: usedFree,
        },
      ];
    }

    case 'UpgradeStarterDomain': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const domain = player.holdings.domains.find((d) => d.id === command.domainId);
      if (!domain) throw new GameRuleError('INPUT', 'Unbekannte Domäne.');
      if (domain.tier !== 'starter') throw new GameRuleError('RULE', 'Nur Starter-Domänen können so ausgebaut werden.');

      const { usedFree, actionCost } = consumeFacilityOrAction(player, state.rules);
      if (actionCost > 0) ensureActionAvailable(player, state.rules, `facility.upgradeStarterDomain.${command.domainId}`, 1);

      const goldSpent = 10;
      const laborSpent = 4;
      if (player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      if (player.turn.laborAvailable < laborSpent) throw new GameRuleError('FUNDS', 'Nicht genug Arbeitskraft.');

      return [
        {
          type: 'PlayerStarterDomainUpgraded',
          visibility: { scope: 'private', playerId },
          playerId,
          domainId: command.domainId,
          goldSpent,
          laborSpent,
          usedFreeFacilityBuild: usedFree,
        },
      ];
    }

    case 'HireSpecialist': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const tableRoll = rollDice('2d6', ctx.rng);
      const loyaltyRoll = rollDice('1d6', ctx.rng);
      const baseCost = command.tier === 'simple' ? 10 : command.tier === 'experienced' ? 25 : 50;
      let costAdj = 0;
      if (tableRoll.total === 2 || tableRoll.total === 3 || tableRoll.total === 9) costAdj = 20;
      if (tableRoll.total === 4 || tableRoll.total === 5 || tableRoll.total === 6) costAdj = -10;
      if (tableRoll.total === 8) costAdj = 5;
      if (tableRoll.total === 10) costAdj = 25;
      if (tableRoll.total === 12) costAdj = 50;
      const goldSpent = Math.max(0, baseCost + costAdj);
      if (player.economy.gold < goldSpent) throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      const specialistId = generateId('spec', player.holdings.specialists);
      const loyaltyFinal = 2 + loyaltyRoll.total;
      return [
        {
          type: 'PlayerSpecialistHired',
          visibility: { scope: 'private', playerId },
          playerId,
          specialistId,
          kind: command.kind,
          tier: command.tier,
          tableRoll,
          costAdjustmentGold: costAdj,
          loyaltyRolled: loyaltyRoll,
          loyaltyFinal,
          traits: [],
          goldSpent,
        },
      ];
    }

    case 'AddPrivateNote': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      return [
        {
          type: 'PlayerPrivateNoteAdded',
          visibility: { scope: 'private', playerId },
          playerId,
          note: command.note,
        },
      ];
    }
  }
}

function postTierRank(tier: PostTier): number {
  switch (tier) {
    case 'small':
      return 1;
    case 'medium':
      return 2;
    case 'large':
      return 3;
  }
}
