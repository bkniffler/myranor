import {
  asCampaignId,
  asPlayerId,
  asUserId,
  type PlayerId,
} from '../domain/ids';
import type { Phase } from '../domain/phase';
import { resolveSuccessTier, successTierLabelDe } from '../domain/success';
import type {
  CampaignState,
  DomainTier,
  PlayerChecks,
  PlayerInfrastructure,
  PlayerState,
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
  domainGoldUpkeep,
  domainRawMaterialsPerRound,
  officesGoldIncomePerRound,
  roundGoldIncome,
  startingPlayerChecks,
  startingPlayerEconomy,
  startingPlayerHoldings,
  startingPlayerInfrastructure,
  startingMarketState,
  startingPlayerTurn,
  storageCapacity,
  storageUpkeep,
  workshopCapacity,
  workshopUpkeep,
  workforceRawMaterialsUpkeep,
} from '../rules/v0';
import {
  computeCampaignEventModifiers,
  rollSectionEvents,
} from '../rules/events_v0';
import { rollMarket } from '../rules/market_v0';
import { rollD20 } from '../util/dice';
import type { Rng } from '../util/rng';
import { GameRuleError } from './errors';

export type ActorContext =
  | { role: 'gm'; userId: string }
  | { role: 'player'; userId: string };

export type EngineContext = {
  actor: ActorContext;
  rng: Rng;
};

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
        rules: DEFAULT_CAMPAIGN_RULES,
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
      if (!state) {
        throw new Error(`Cannot apply ${event.type} without campaign state`);
      }
    }
  }

  switch (event.type) {
    case 'PlayerJoined': {
      const playerId = event.playerId;
      const userId = event.userId;

      const existing = state.playerIdByUserId[userId];
      if (existing) return state;

      const placeholderInfrastructure = startingPlayerInfrastructure();
      const placeholderEconomy = startingPlayerEconomy();
      const placeholderChecks = startingPlayerChecks();
      const placeholderHoldings = startingPlayerHoldings();
      const placeholderTurn = startingPlayerTurn(placeholderInfrastructure);

      const player: PlayerState = {
        id: playerId,
        userId,
        displayName: event.displayName,
        checks: placeholderChecks,
        infrastructure: placeholderInfrastructure,
        holdings: placeholderHoldings,
        economy: placeholderEconomy,
        turn: placeholderTurn,
        privateNotes: [],
      };

      return {
        ...state,
        players: { ...state.players, [playerId]: player },
        playerIdByUserId: { ...state.playerIdByUserId, [userId]: playerId },
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
            infrastructure: event.infrastructure,
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
          raw: {
            tableRollTotal: event.raw.tableRoll.total,
            categoryLabel: event.raw.categoryLabel,
            demandLabel: event.raw.demandLabel,
            modifiers: event.raw.modifiers,
          },
          special: {
            tableRollTotal: event.special.tableRoll.total,
            categoryLabel: event.special.categoryLabel,
            demandLabel: event.special.demandLabel,
            modifiers: event.special.modifiers,
          },
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
        })),
      };
    }
    case 'PlayerPendingGoldApplied': {
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
              gold: player.economy.gold + event.amount,
              pendingGold: Math.max(0, player.economy.pendingGold - event.amount),
            },
          },
        },
      };
    }
    case 'PlayerIncomeApplied': {
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
              gold: player.economy.gold + event.goldGained,
              rawMaterials: player.economy.rawMaterials + event.rawMaterialsGained,
              specialMaterials: player.economy.specialMaterials + event.specialMaterialsGained,
            },
            turn: {
              ...player.turn,
              laborAvailable: Math.max(0, player.turn.laborAvailable - event.upkeepLaborPaid),
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
              gold: player.economy.gold + event.goldGained,
              rawMaterials: event.storage.rawStored,
              specialMaterials: event.storage.specialStored,
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
    case 'PlayerGatherMaterialsResolved': {
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
              rawMaterials: player.economy.rawMaterials + event.rawMaterialsGained,
              specialMaterials:
                player.economy.specialMaterials + event.specialMaterialsGained,
            },
            turn: {
              ...player.turn,
              laborAvailable: player.turn.laborAvailable - event.laborSpent,
              actionsUsed: player.turn.actionsUsed + event.actionCost,
              actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
            },
          },
        },
      };
    }
    case 'PlayerGainInfluenceResolved': {
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
    case 'PlayerLendMoneyResolved': {
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
              pendingGold: player.economy.pendingGold + event.goldScheduled,
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
    case 'PlayerSellMaterialsResolved': {
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
              gold: player.economy.gold + event.goldGained,
              rawMaterials: player.economy.rawMaterials - event.rawMaterialsSpent,
              specialMaterials: player.economy.specialMaterials - event.specialMaterialsSpent,
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
    case 'PlayerFacilityBuilt': {
      const player = state.players[event.playerId];
      if (!player) return state;

      const infrastructure = (() => {
        switch (event.facility) {
          case 'upgradeStarterDomainToSmall':
            return player.infrastructure.domainTier === 'starter'
              ? { ...player.infrastructure, domainTier: 'small' as const }
              : player.infrastructure;
          case 'buildSmallStorage':
            return player.infrastructure.storageTier === 'none'
              ? { ...player.infrastructure, storageTier: 'small' as const }
              : player.infrastructure;
        }
      })();

      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            infrastructure,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            turn: {
              ...player.turn,
              laborAvailable: player.turn.laborAvailable - event.laborSpent,
              facilityActionUsed: true,
            },
          },
        },
      };
    }
    case 'PlayerOfficeAcquired': {
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
              officesGold: player.holdings.officesGold + event.officesGoldGained,
            },
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            turn: {
              ...player.turn,
              influenceAvailable: player.turn.influenceAvailable - event.influenceSpent,
              actionsUsed: player.turn.actionsUsed + event.actionCost,
              actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
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
  for (const event of events) {
    state = applyEvent(state, event);
  }
  return state;
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

function assertPhase(state: CampaignState, phase: Phase): void {
  if (state.phase !== phase) {
    throw new GameRuleError(
      'PHASE',
      `Aktion nur in Phase "${phase}" möglich (aktuell: "${state.phase}").`,
    );
  }
}

function investmentDcModifier(investments: number): number {
  if (investments >= 8) return 8;
  if (investments >= 4) return 4;
  return 0;
}

function domainTierRank(tier: DomainTier): number {
  switch (tier) {
    case 'starter':
      return 1;
    case 'small':
      return 1;
    case 'medium':
      return 2;
    case 'large':
      return 3;
  }
}

function workshopTierRank(tier: WorkshopTier): number {
  switch (tier) {
    case 'none':
      return 0;
    case 'small':
      return 1;
    case 'medium':
      return 2;
    case 'large':
      return 3;
  }
}

function actionAlreadyUsed(player: PlayerState, actionKey: string): boolean {
  return player.turn.actionKeysUsed.includes(actionKey);
}

function assertActionAllowed(
  state: CampaignState,
  player: PlayerState,
  actionKey: string,
  actionCost: number,
): void {
  if (player.turn.actionsUsed + actionCost > state.rules.actionsPerRound) {
    throw new GameRuleError('ACTIONS', 'Keine Aktionen mehr übrig.');
  }
  if (actionAlreadyUsed(player, actionKey)) {
    throw new GameRuleError('ACTIONS', 'Diese Aktion wurde diese Runde bereits genutzt.');
  }
}

function assertFacilityActionAvailable(player: PlayerState): void {
  if (player.turn.facilityActionUsed) {
    throw new GameRuleError('ACTIONS', 'Einrichtungsbau wurde diese Runde bereits genutzt.');
  }
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

function normalizeInfrastructure(input: PlayerInfrastructure): PlayerInfrastructure {
  return input;
}

function degradeDomainTier(tier: DomainTier): DomainTier {
  switch (tier) {
    case 'large':
      return 'medium';
    case 'medium':
      return 'small';
    case 'small':
      return 'starter';
    case 'starter':
      return 'starter';
  }
}

export function decide(
  state: CampaignState | null,
  command: GameCommand,
  ctx: EngineContext,
): GameEvent[] {
  switch (command.type) {
    case 'CreateCampaign': {
      if (state) throw new GameRuleError('STATE', 'Kampagne existiert bereits.');
      if (ctx.actor.role !== 'gm') {
        throw new GameRuleError('AUTH', 'Nur GM kann Kampagnen erstellen.');
      }
      return [
        {
          type: 'CampaignCreated',
          visibility: { scope: 'public' },
          campaignId: asCampaignId(command.campaignId),
          name: command.name,
          gmUserId: asUserId(ctx.actor.userId),
          rulesVersion: RULES_VERSION,
          round: 1,
          phase: 'maintenance',
        },
        {
          type: 'PublicLogEntryAdded',
          visibility: { scope: 'public' },
          message: `Kampagne "${command.name}" wurde erstellt.`,
        },
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
      const infrastructure = normalizeInfrastructure(startingPlayerInfrastructure());
      const economy = startingPlayerEconomy();
      const checks = normalizeChecks({
        ...startingPlayerChecks(),
        ...command.checks,
      });
      const holdings = startingPlayerHoldings();
      const turn = startingPlayerTurn(infrastructure);

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
          infrastructure,
          holdings,
          economy,
          turn,
        },
        {
          type: 'PublicLogEntryAdded',
          visibility: { scope: 'public' },
          playerId,
          message: `${command.displayName} ist der Kampagne beigetreten.`,
        },
      ];
    }

    case 'AdvancePhase': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertGm(state, ctx.actor);

      const from = state.phase;
      const to = (() => {
        switch (from) {
          case 'maintenance':
            return 'actions';
          case 'actions':
            return 'conversion';
          case 'conversion':
            return 'reset';
          case 'reset':
            return 'maintenance';
        }
      })();

      const nextRound = from === 'reset' ? state.round + 1 : state.round;

      const events: GameEvent[] = [
        {
          type: 'PhaseAdvanced',
          visibility: { scope: 'public' },
          from,
          to,
          round: nextRound,
        },
      ];

      if (from === 'maintenance' && to === 'actions') {
        const sectionStarts = (state.round - 1) % 5 === 0;

        const sectionRoll = sectionStarts
          ? rollSectionEvents(state.round, ctx.rng)
          : null;

        if (sectionRoll) {
          events.push({
            type: 'SectionEventsRolled',
            visibility: { scope: 'public' },
            startsAtRound: sectionRoll.startsAtRound,
            endsAtRound: sectionRoll.endsAtRound,
            events: sectionRoll.events,
          });
        }

        const market = rollMarket(state.round, ctx.rng);
        events.push({
          type: 'MarketRolled',
          visibility: { scope: 'public' },
          round: state.round,
          raw: {
            tableRoll: market.raw.tableRoll,
            categoryLabel: market.raw.categoryLabel,
            demandLabel: market.raw.demandLabel,
            modifiers: market.raw.modifiers,
            modifierRolls: market.raw.modifierRolls,
            metaRolls: market.raw.metaRolls,
          },
          special: {
            tableRoll: market.special.tableRoll,
            categoryLabel: market.special.categoryLabel,
            demandLabel: market.special.demandLabel,
            modifiers: market.special.modifiers,
            modifierRolls: market.special.modifierRolls,
            metaRolls: market.special.metaRolls,
          },
        });

        const globalEventsForMods = sectionRoll
          ? sectionRoll.events.map((e) => ({
              startsAtRound: sectionRoll.startsAtRound,
              endsAtRound: sectionRoll.endsAtRound,
              tableRollTotal: e.tableRoll.total,
              name: e.name,
              effectsText: e.effectsText,
            }))
          : state.globalEvents;
        const campaignMods = computeCampaignEventModifiers(globalEventsForMods);

        for (const player of Object.values(state.players)) {
          if (player.economy.pendingGold > 0) {
            events.push({
              type: 'PlayerPendingGoldApplied',
              visibility: { scope: 'private', playerId: player.id },
              playerId: player.id,
              amount: player.economy.pendingGold,
              reason: 'loan',
            });
          }

          const roundHasUpkeep = state.round >= 2;

          let gold = player.economy.gold + player.economy.pendingGold;
          let labor = player.turn.laborAvailable;

          // Global event taxes (apply even in round 1)
          let eventGoldTaxPaid = 0;
          if (campaignMods.taxGoldPerRound > 0) {
            const paid = Math.min(gold, campaignMods.taxGoldPerRound);
            gold -= paid;
            eventGoldTaxPaid += paid;
          }

          let eventOneTimeOfficeTaxPaid = 0;
          if (sectionStarts && campaignMods.oneTimeGoldTaxPerOffice > 0) {
            const due = campaignMods.oneTimeGoldTaxPerOffice * player.holdings.officesGold;
            if (due > 0) {
              const paid = Math.min(gold, due);
              gold -= paid;
              eventOneTimeOfficeTaxPaid += paid;
            }
          }

          // Gold upkeep: domain (if not payable, degrade tier for production this round)
          const domainTier = player.infrastructure.domainTier;
          const domainUpkeepDue = roundHasUpkeep ? domainGoldUpkeep(domainTier) : 0;
          const domainMaintained = domainUpkeepDue === 0 || gold >= domainUpkeepDue;
          const effectiveDomainTier = domainMaintained
            ? domainTier
            : degradeDomainTier(domainTier);

          let upkeepGoldPaid = 0;
          upkeepGoldPaid += eventGoldTaxPaid;
          upkeepGoldPaid += eventOneTimeOfficeTaxPaid;

          if (domainMaintained && domainUpkeepDue > 0) {
            gold -= domainUpkeepDue;
            upkeepGoldPaid += domainUpkeepDue;
          }

          // Workshop upkeep
          const baseWorkshopDue = roundHasUpkeep
            ? workshopUpkeep(player.infrastructure.workshopTier)
            : { labor: 0, gold: 0 };
          const workshopTier = player.infrastructure.workshopTier;
          const workshopGoldBonus = roundHasUpkeep
            ? campaignMods.workshopUpkeepGoldBonusFlat +
              campaignMods.workshopUpkeepGoldBonusPerTier * workshopTierRank(workshopTier)
            : 0;
          const workshopDue = roundHasUpkeep
            ? {
                labor: baseWorkshopDue.labor + campaignMods.workshopUpkeepLaborBonusFlat,
                gold: baseWorkshopDue.gold + workshopGoldBonus,
              }
            : baseWorkshopDue;
          const canMaintainWorkshop = gold >= workshopDue.gold && labor >= workshopDue.labor;
          const workshopMaintained = workshopDue.gold === 0 && workshopDue.labor === 0
            ? true
            : canMaintainWorkshop;
          if (workshopMaintained) {
            gold -= workshopDue.gold;
            labor -= workshopDue.labor;
            upkeepGoldPaid += workshopDue.gold;
          }

          // Storage upkeep
          const storageDue = roundHasUpkeep
            ? storageUpkeep(player.infrastructure.storageTier)
            : { labor: 0 };
          const canMaintainStorage = labor >= storageDue.labor;
          const storageMaintained = storageDue.labor === 0 ? true : canMaintainStorage;
          if (storageMaintained) {
            labor -= storageDue.labor;
          }

          const upkeepLaborPaid = (workshopMaintained ? workshopDue.labor : 0) + (storageMaintained ? storageDue.labor : 0);

          // Production
          const officeBase = officesGoldIncomePerRound(player.holdings.officesGold);
          const officeScaled =
            Math.floor(officeBase * campaignMods.officeGoldIncomeMultiplier) +
            campaignMods.officeGoldIncomeBonusPerOffice * player.holdings.officesGold;
          const goldProduced = roundGoldIncome(player.infrastructure) + officeScaled;
          const rawMaterialsProduced = domainRawMaterialsPerRound(effectiveDomainTier);
          const specialMaterialsProduced = 0;

          // Workforce upkeep in RM (paid from stored + produced)
          const workforceDue = roundHasUpkeep
            ? workforceRawMaterialsUpkeep(baseLaborTotal(player.infrastructure))
            : 0;
          const rawAvailableAfterProduction =
            player.economy.rawMaterials + rawMaterialsProduced;
          const workforcePaid = Math.min(rawAvailableAfterProduction, workforceDue);

          const goldDelta = goldProduced - upkeepGoldPaid;
          const rawDelta = rawMaterialsProduced - workforcePaid;
          const specialDelta = 0;

          events.push({
            type: 'PlayerIncomeApplied',
            visibility: { scope: 'private', playerId: player.id },
            playerId: player.id,
            goldProduced,
            officeGoldIncomeMultiplierApplied: campaignMods.officeGoldIncomeMultiplier,
            officeGoldIncomeBonusPerOfficeApplied: campaignMods.officeGoldIncomeBonusPerOffice,
            rawMaterialsProduced,
            specialMaterialsProduced,
            upkeepGoldPaid,
            eventGoldTaxPaid,
            eventOneTimeOfficeTaxPaid,
            upkeepLaborPaid,
            workforceUpkeepRawMaterialsPaid: workforcePaid,
            upkeep: {
              workshopMaintained,
              storageMaintained,
            },
            goldGained: goldDelta,
            rawMaterialsGained: rawDelta,
            specialMaterialsGained: specialDelta,
          });
        }
        events.push({
          type: 'PublicLogEntryAdded',
          visibility: { scope: 'public' },
          message: `Runde ${state.round}: Unterhalt & Erträge abgehandelt. Aktionen sind offen.`,
        });
      }

      if (from === 'actions' && to === 'conversion') {
        const campaignMods = computeCampaignEventModifiers(state.globalEvents);
        const rawDivisor = Math.max(1, Math.trunc(campaignMods.rawAutoConvertDivisor));

        for (const player of Object.values(state.players)) {
          const rawBefore = player.economy.rawMaterials;
          const specialBefore = player.economy.specialMaterials;
          if (rawBefore === 0 && specialBefore === 0) continue;

          const workshopMaintained = player.turn.upkeep.workshopMaintained;
          const storageMaintained = player.turn.upkeep.storageMaintained;

          const workshopCap = workshopMaintained
            ? workshopCapacity(player.infrastructure.workshopTier)
            : { rmIn: 0, smOutMax: 0 };

          const rmForWorkshop = Math.min(rawBefore, workshopCap.rmIn);
          const smProduced = Math.min(
            Math.floor(rmForWorkshop / 4),
            workshopCap.smOutMax,
          );
          const rmConsumed = smProduced * 4;
          const rawAfterWorkshop = rawBefore - rmConsumed;
          const specialAfterWorkshop = specialBefore + smProduced;

          const storageCap = storageMaintained
            ? storageCapacity(player.infrastructure.storageTier)
            : { raw: 0, special: 0 };

          const specialStored = Math.min(specialAfterWorkshop, storageCap.special);
          const remainingSpecial = specialAfterWorkshop - specialStored;
          const rawStored = Math.min(rawAfterWorkshop, storageCap.raw);
          const remainingRaw = rawAfterWorkshop - rawStored;

          const rawConvertedToGold = Math.floor(remainingRaw / rawDivisor);
          const rawLost = remainingRaw - rawConvertedToGold * rawDivisor;
          const specialConvertedToGold = remainingSpecial * 2;
          const goldGained = rawConvertedToGold + specialConvertedToGold;

          events.push({
            type: 'PlayerMaterialsConverted',
            visibility: { scope: 'private', playerId: player.id },
            playerId: player.id,
            rawMaterialsBefore: rawBefore,
            specialMaterialsBefore: specialBefore,
            workshop: {
              maintained: workshopMaintained,
              rawConsumed: rmConsumed,
              specialProduced: smProduced,
            },
            storage: {
              maintained: storageMaintained,
              rawStored,
              specialStored,
            },
            rawConvertedToGold,
            rawLost,
            specialConvertedToGold,
            goldGained,
          });
        }
        events.push({
          type: 'PublicLogEntryAdded',
          visibility: { scope: 'public' },
          message: `Runde ${state.round}: Automatische Umwandlung wurde durchgeführt.`,
        });
      }

      if (from === 'conversion' && to === 'reset') {
        for (const player of Object.values(state.players)) {
          const baseLabor = baseLaborTotal(player.infrastructure);
          const baseInfluence = baseInfluencePerRound();
          events.push({
            type: 'PlayerTurnReset',
            visibility: { scope: 'private', playerId: player.id },
            playerId: player.id,
            laborAvailable: baseLabor,
            influenceAvailable: baseInfluence,
            actionsUsed: 0,
            actionKeysUsed: [],
            facilityActionUsed: false,
            upkeep: {
              workshopMaintained: true,
              storageMaintained: true,
            },
          });
        }
        events.push({
          type: 'PublicLogEntryAdded',
          visibility: { scope: 'public' },
          message: `Runde ${state.round}: Ressourcen wurden zurückgesetzt.`,
        });
      }

      if (from === 'reset' && to === 'maintenance') {
        events.push({
          type: 'PublicLogEntryAdded',
          visibility: { scope: 'public' },
          message: `Runde ${nextRound} beginnt (Maintenance).`,
        });
      }

      return events;
    }

    case 'GatherMaterials': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');

      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new GameRuleError('STATE', 'Spieler nicht gefunden.');

      const actionKey =
        command.mode === 'domain' ? 'material.domain' : 'material.workshop';
      assertActionAllowed(state, player, actionKey, 1);

      const investments = Math.trunc(command.investments);
      if (investments <= 0) {
        throw new GameRuleError('INPUT', 'Investitionen müssen > 0 sein.');
      }

      const investCap =
        command.mode === 'domain'
          ? 4 * domainTierRank(player.infrastructure.domainTier)
          : 2 * workshopTierRank(player.infrastructure.workshopTier);
      if (investments > investCap) {
        throw new GameRuleError('INPUT', 'Zu viele Investitionen für diesen Posten.');
      }
      if (investments > player.turn.laborAvailable) {
        throw new GameRuleError(
          'RESOURCES',
          'Nicht genug Arbeitskraft für diese Investitionen.',
        );
      }

      const baseDc = command.mode === 'domain' ? 10 : 12;
      const dc = baseDc + investmentDcModifier(investments);
      const roll = rollD20(ctx.rng);
      const rollModifier = player.checks.materials;
      const rollTotal = roll.total + rollModifier;
      const tier = resolveSuccessTier(dc, rollTotal);

      const gainsPerInvestment = (() => {
        if (command.mode === 'domain') {
          switch (tier) {
            case 'veryGood':
              return { rm: 16, sm: 0 };
            case 'good':
              return { rm: 12, sm: 0 };
            case 'success':
              return { rm: 8, sm: 0 };
            case 'poor':
              return { rm: 1, sm: 0 };
            case 'fail':
              return { rm: 0, sm: 0 };
          }
        }

        // workshop
        switch (tier) {
          case 'veryGood':
            return { rm: 0, sm: 3 };
          case 'good':
            return { rm: 0, sm: 2 };
          case 'success':
            return { rm: 0, sm: 1 };
          case 'poor':
            return { rm: 0, sm: 0.5 };
          case 'fail':
            return { rm: 0, sm: 0 };
        }
      })();

      const rawMaterialsGained = gainsPerInvestment.rm * investments;
      const specialMaterialsGained =
        gainsPerInvestment.sm === 0.5
          ? Math.floor(investments / 2)
          : gainsPerInvestment.sm * investments;

      return [
        {
          type: 'PlayerGatherMaterialsResolved',
          visibility: { scope: 'private', playerId },
          playerId,
          mode: command.mode,
          investments,
          dc,
          roll,
          rollModifier,
          rollTotal,
          tier,
          laborSpent: investments,
          rawMaterialsGained,
          specialMaterialsGained,
          actionCost: 1,
          actionKey,
        },
        {
          type: 'PublicLogEntryAdded',
          visibility: { scope: 'public' },
          playerId,
          message: `${player.displayName}: Materialgewinn (${command.mode}) – ${successTierLabelDe(tier)}.`,
        },
      ];
    }

    case 'GainInfluence': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');

      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new GameRuleError('STATE', 'Spieler nicht gefunden.');

      const campaignMods = computeCampaignEventModifiers(state.globalEvents);

      const actionKey = 'influence';
      assertActionAllowed(state, player, actionKey, 1);

      const investments = Math.trunc(command.investments);
      if (investments <= 0) {
        throw new GameRuleError('INPUT', 'Investitionen müssen > 0 sein.');
      }
      if (investments > 4) {
        throw new GameRuleError('INPUT', 'Zu viele Investitionen (max. 4 ohne Amt/Circel).');
      }

      const goldSpent = investments;
      if (goldSpent > player.economy.gold) {
        throw new GameRuleError('RESOURCES', 'Nicht genug Gold.');
      }

      const dc =
        12 +
        investmentDcModifier(investments) +
        campaignMods.influenceActionDcBonus;
      const roll = rollD20(ctx.rng);
      const rollModifier = player.checks.influence;
      const rollTotal = roll.total + rollModifier;
      const tier = resolveSuccessTier(dc, rollTotal);

      const perInvestment = (() => {
        switch (tier) {
          case 'veryGood':
            return 8;
          case 'good':
            return 6;
          case 'success':
            return 4;
          case 'poor':
            return 2;
          case 'fail':
            return 0;
        }
      })();

      const influenceGained = perInvestment * investments;

      return [
        {
          type: 'PlayerGainInfluenceResolved',
          visibility: { scope: 'private', playerId },
          playerId,
          investments,
          dc,
          roll,
          rollModifier,
          rollTotal,
          tier,
          goldSpent,
          influenceGained,
          actionCost: 1,
          actionKey,
        },
        {
          type: 'PublicLogEntryAdded',
          visibility: { scope: 'public' },
          playerId,
          message: `${player.displayName}: Einflussgewinn – ${successTierLabelDe(tier)}.`,
        },
      ];
    }

    case 'LendMoney': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');

      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new GameRuleError('STATE', 'Spieler nicht gefunden.');

      const campaignMods = computeCampaignEventModifiers(state.globalEvents);

      const actionKey = 'money.lend';
      assertActionAllowed(state, player, actionKey, 1);

      const investments = Math.trunc(command.investments);
      if (investments <= 0) {
        throw new GameRuleError('INPUT', 'Investitionen müssen > 0 sein.');
      }
      if (investments > 2) {
        throw new GameRuleError('INPUT', 'Zu viele Investitionen (max. 2 ohne Handelsunternehmung).');
      }

      const goldSpent = investments * 2;
      if (goldSpent > player.economy.gold) {
        throw new GameRuleError('RESOURCES', 'Nicht genug Gold.');
      }

      const dc =
        14 +
        investmentDcModifier(investments) +
        campaignMods.lendMoneyDcBonus;
      const roll = rollD20(ctx.rng);
      const rollModifier = player.checks.money;
      const rollTotal = roll.total + rollModifier;
      const tier = resolveSuccessTier(dc, rollTotal);

      const perInvestment = (() => {
        switch (tier) {
          case 'veryGood':
            return 12;
          case 'good':
            return 8;
          case 'success':
            return 4;
          case 'poor':
            return 1;
          case 'fail':
            return 0;
        }
      })();
      let goldScheduled = perInvestment * investments;
      goldScheduled = Math.floor(goldScheduled * campaignMods.lendMoneyPayoutMultiplier);
      goldScheduled +=
        Math.floor(investments / 2) * campaignMods.moneyBonusGoldPerTwoInvestments;

      return [
        {
          type: 'PlayerLendMoneyResolved',
          visibility: { scope: 'private', playerId },
          playerId,
          investments,
          dc,
          roll,
          rollModifier,
          rollTotal,
          tier,
          goldSpent,
          goldScheduled,
          actionCost: 1,
          actionKey,
        },
        {
          type: 'PublicLogEntryAdded',
          visibility: { scope: 'public' },
          playerId,
          message: `${player.displayName}: Geldgewinn (Geldverleih) – ${successTierLabelDe(tier)}.`,
        },
      ];
    }

    case 'SellMaterials': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');

      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new GameRuleError('STATE', 'Spieler nicht gefunden.');

      const campaignMods = computeCampaignEventModifiers(state.globalEvents);

      const actionKey = 'money.sell';
      assertActionAllowed(state, player, actionKey, 1);

      const investments = Math.trunc(command.investments);
      if (investments <= 0) {
        throw new GameRuleError('INPUT', 'Investitionen müssen > 0 sein.');
      }
      if (investments > 3) {
        throw new GameRuleError('INPUT', 'Zu viele Investitionen (max. 3 ohne Handelsunternehmung).');
      }

      const rawMaterialsSpent = command.resource === 'raw' ? investments * 6 : 0;
      const specialMaterialsSpent = command.resource === 'special' ? investments : 0;

      if (rawMaterialsSpent > player.economy.rawMaterials) {
        throw new GameRuleError('RESOURCES', 'Nicht genug Rohmaterial.');
      }
      if (specialMaterialsSpent > player.economy.specialMaterials) {
        throw new GameRuleError('RESOURCES', 'Nicht genug Sondermaterial.');
      }

      const dc =
        14 +
        investmentDcModifier(investments) +
        campaignMods.sellMaterialsDcBonus;
      const roll = rollD20(ctx.rng);
      const rollModifier = player.checks.money;
      const rollTotal = roll.total + rollModifier;
      const tier = resolveSuccessTier(dc, rollTotal);

      const conversionValuePerInvestment = command.resource === 'raw' ? 1 : 2;
      const baseSaleValuePerInvestment = 3;

      const baseGold = (() => {
        switch (tier) {
          case 'veryGood':
            return (baseSaleValuePerInvestment + 3) * investments;
          case 'good':
            return (baseSaleValuePerInvestment + 2) * investments;
          case 'success':
            return baseSaleValuePerInvestment * investments;
          case 'poor':
            return conversionValuePerInvestment * investments;
          case 'fail':
            return Math.max(0, (conversionValuePerInvestment - 1) * investments);
        }
      })();

      const marketModifierPerInvestment =
        command.resource === 'raw'
          ? state.market.raw.modifiers.basic
          : state.market.special.modifiers.basic;
      const marketModifierTotal = marketModifierPerInvestment * investments;

      const eventBonusGold =
        Math.floor(investments / 2) * campaignMods.moneyBonusGoldPerTwoInvestments;

      const goldGained = Math.max(0, baseGold + marketModifierTotal + eventBonusGold);

      return [
        {
          type: 'PlayerSellMaterialsResolved',
          visibility: { scope: 'private', playerId },
          playerId,
          resource: command.resource,
          investments,
          dc,
          roll,
          rollModifier,
          rollTotal,
          tier,
          rawMaterialsSpent,
          specialMaterialsSpent,
          marketModifierPerInvestment,
          marketModifierTotal,
          goldGained,
          actionCost: 1,
          actionKey,
        },
        {
          type: 'PublicLogEntryAdded',
          visibility: { scope: 'public' },
          playerId,
          message: `${player.displayName}: Geldgewinn (Verkauf) – ${successTierLabelDe(tier)}.`,
        },
      ];
    }

    case 'AcquireOffice': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');

      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new GameRuleError('STATE', 'Spieler nicht gefunden.');

      const actionKey = 'acquire.office';
      assertActionAllowed(state, player, actionKey, 1);

      const baseCost =
        command.payment === 'gold'
          ? { gold: 8, influence: 2 }
          : { gold: 4, influence: 8 };

      if (baseCost.gold > player.economy.gold) {
        throw new GameRuleError('RESOURCES', 'Nicht genug Gold.');
      }
      if (baseCost.influence > player.turn.influenceAvailable) {
        throw new GameRuleError('RESOURCES', 'Nicht genug Einfluss.');
      }

      const dc = 14;
      const roll = rollD20(ctx.rng);
      const rollModifier = player.checks.money;
      const rollTotal = roll.total + rollModifier;
      const tier = resolveSuccessTier(dc, rollTotal);

      const costMultiplier = (() => {
        switch (tier) {
          case 'veryGood':
            return 0.75;
          case 'good':
            return 0.9;
          case 'success':
            return 1;
          case 'poor':
            return 1.1;
          case 'fail':
            return 0;
        }
      })();

      const goldSpent =
        tier === 'fail' ? 0 : Math.ceil(baseCost.gold * costMultiplier);
      const influenceSpent =
        tier === 'fail' ? 0 : Math.ceil(baseCost.influence * costMultiplier);

      if (tier !== 'fail') {
        if (goldSpent > player.economy.gold || influenceSpent > player.turn.influenceAvailable) {
          // If the rolled outcome would exceed resources, treat as failed acquisition.
          return [
            {
              type: 'PlayerOfficeAcquired',
              visibility: { scope: 'private', playerId },
              playerId,
              dc,
              roll,
              rollModifier,
              rollTotal,
              tier,
              goldSpent: 0,
              influenceSpent: 0,
              officesGoldGained: 0,
              actionCost: 1,
              actionKey,
            },
            {
              type: 'PublicLogEntryAdded',
              visibility: { scope: 'public' },
              playerId,
              message: `${player.displayName}: Versuch, ein Amt zu erlangen, scheitert an fehlenden Mitteln.`,
            },
          ];
        }
      }

      const officesGoldGained = tier === 'fail' ? 0 : 1;

      return [
        {
          type: 'PlayerOfficeAcquired',
          visibility: { scope: 'private', playerId },
          playerId,
          dc,
          roll,
          rollModifier,
          rollTotal,
          tier,
          goldSpent,
          influenceSpent,
          officesGoldGained,
          actionCost: 1,
          actionKey,
        },
        {
          type: 'PublicLogEntryAdded',
          visibility: { scope: 'public' },
          playerId,
          message:
            tier === 'fail'
              ? `${player.displayName}: Amt erlangen – Fehlschlag.`
              : `${player.displayName}: Amt erlangen – ${successTierLabelDe(tier)}.`,
        },
      ];
    }

    case 'BuildFacility': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');

      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new GameRuleError('STATE', 'Spieler nicht gefunden.');

      assertFacilityActionAvailable(player);

      const { goldSpent, laborSpent } = (() => {
        switch (command.facility) {
          case 'upgradeStarterDomainToSmall':
            return { goldSpent: 10, laborSpent: 4 };
          case 'buildSmallStorage':
            return { goldSpent: 8, laborSpent: 0 };
        }
      })();

      if (command.facility === 'upgradeStarterDomainToSmall') {
        if (player.infrastructure.domainTier !== 'starter') {
          throw new GameRuleError('STATE', 'Domäne ist bereits ausgebaut.');
        }
      }
      if (command.facility === 'buildSmallStorage') {
        if (player.infrastructure.storageTier !== 'none') {
          throw new GameRuleError('STATE', 'Lager existiert bereits.');
        }
      }

      if (goldSpent > player.economy.gold) {
        throw new GameRuleError('RESOURCES', 'Nicht genug Gold.');
      }
      if (laborSpent > player.turn.laborAvailable) {
        throw new GameRuleError('RESOURCES', 'Nicht genug Arbeitskraft.');
      }

      const label =
        command.facility === 'upgradeStarterDomainToSmall'
          ? 'Domäne ausbauen'
          : 'Lager errichten';

      return [
        {
          type: 'PlayerFacilityBuilt',
          visibility: { scope: 'private', playerId },
          playerId,
          facility: command.facility,
          goldSpent,
          laborSpent,
        },
        {
          type: 'PublicLogEntryAdded',
          visibility: { scope: 'public' },
          playerId,
          message: `${player.displayName}: ${label}.`,
        },
      ];
    }

    case 'AddPrivateNote': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const note = command.note.trim();
      if (!note) throw new GameRuleError('INPUT', 'Notiz darf nicht leer sein.');
      if (note.length > 2_000) {
        throw new GameRuleError('INPUT', 'Notiz ist zu lang (max. 2000).');
      }
      return [
        {
          type: 'PlayerPrivateNoteAdded',
          visibility: { scope: 'private', playerId },
          playerId,
          note,
        },
      ];
    }
  }
}
