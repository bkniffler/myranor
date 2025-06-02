import {
  type GameEvent,
  GameEventType,
  createGameEvent,
} from '../events/GameEvent';
import type { GameState, Player } from '../models';
import { PropertySize, PropertyType } from '../models/Property';
import type { GameCommand } from './GameCommand';

// For V1, use a simple d20 roll
function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}
const GAIN_INFLUENCE_DC = 12;

export interface GainInfluenceCommandPayload {
  influenceType: 'temporary' | 'semiPermanent';
  goldAmount?: number; // For temporary influence (cost)
  investmentUnits?: number; // For semi-permanent (1 unit = 3 Gold cost, yields 1 base SP point)
  targetOfficeId?: string; // Required if influenceType is 'semiPermanent'
  [key: string]: any; // For GameCommand compatibility
}

export interface GainInfluenceCommand extends GameCommand {
  type: 'GAIN_INFLUENCE';
  payload: GainInfluenceCommandPayload;
}

// Helper to get temporary influence gold cap based on offices/circles
// TODO: Implement circle checks as per docs/SOURCE.MD line 214
function getTempInfluenceGoldCap(player: Player, state: GameState): number {
  let cap = 4; // Base cap without office/circle
  let highestOfficeLevel = 0; // 0: none, 1: small, 2: medium, 3: large

  for (const propId of player.propertyIds) {
    const prop = state.properties[propId];
    if (prop?.active && prop.type === PropertyType.OFFICE) {
      if (prop.size === PropertySize.SMALL && highestOfficeLevel < 1)
        highestOfficeLevel = 1;
      if (prop.size === PropertySize.MEDIUM && highestOfficeLevel < 2)
        highestOfficeLevel = 2;
      if (prop.size === PropertySize.LARGE && highestOfficeLevel < 3)
        highestOfficeLevel = 3;
    }
    // TODO: Add circle checks here
  }

  if (highestOfficeLevel === 1) cap = 6;
  else if (highestOfficeLevel === 2) cap = 8;
  else if (highestOfficeLevel === 3) cap = 12;
  return cap;
}

export const gainInfluenceHandler = {
  validate: (command: GainInfluenceCommand, state: GameState): boolean => {
    const player = state.players[command.playerId];
    if (!player) return false;

    if (state.phase !== 'action') return false;
    if (state.actionPointsRemaining <= 0) return false;

    const { influenceType, goldAmount, investmentUnits, targetOfficeId } =
      command.payload;

    if (influenceType === 'temporary') {
      if (goldAmount === undefined || goldAmount <= 0) return false;
      if (player.resources.gold < goldAmount) return false;
      const tempGoldCap = getTempInfluenceGoldCap(player, state);
      if (goldAmount > tempGoldCap) return false;
    } else if (influenceType === 'semiPermanent') {
      if (investmentUnits === undefined || investmentUnits <= 0) return false;
      if (!targetOfficeId) return false;

      const office = state.properties[targetOfficeId];
      if (
        !office ||
        !player.propertyIds.includes(targetOfficeId) ||
        office.type !== PropertyType.OFFICE ||
        !office.active
      ) {
        return false;
      }

      const costPerUnit = 3;
      if (player.resources.gold < investmentUnits * costPerUnit) return false;

      const basePointsToGain = investmentUnits * 1;
      const alreadyGainedThisRound =
        player.influenceGainedThisRound.semiPermanentPerOffice[
          targetOfficeId
        ] || 0;

      if (
        basePointsToGain <= 0 || // Must attempt to gain at least 1
        basePointsToGain > 2 || // Cannot attempt to gain more than 2 base points in one go for an office
        alreadyGainedThisRound + basePointsToGain > 2
      ) {
        return false;
      }
    } else {
      return false;
    }
    return true;
  },

  execute: (command: GainInfluenceCommand, state: GameState): GameEvent[] => {
    const player = state.players[command.playerId];
    const { influenceType, goldAmount, investmentUnits, targetOfficeId } =
      command.payload;
    const events: GameEvent[] = [];

    if (influenceType === 'temporary') {
      const tempInfluenceGained = (goldAmount || 0) * 4;

      const event = createGameEvent({
        type: GameEventType.INFLUENCE_GAINED,
        playerId: command.playerId,
        payload: {
          influenceType: 'temporary',
          goldSpent: goldAmount,
          temporaryInfluenceAdded: tempInfluenceGained,
        },
        apply: (currentState: GameState): GameState => {
          const newPlayer = { ...currentState.players[command.playerId] };
          newPlayer.resources = { ...newPlayer.resources };
          newPlayer.resources.gold -= goldAmount || 0;
          newPlayer.resources.temporaryInfluence += tempInfluenceGained;

          const updatedPlayers = {
            ...currentState.players,
            [command.playerId]: newPlayer,
          };
          return {
            ...currentState,
            players: updatedPlayers,
            actionPointsRemaining: currentState.actionPointsRemaining - 1,
          };
        },
      });
      events.push(event);
    } else if (
      influenceType === 'semiPermanent' &&
      investmentUnits &&
      targetOfficeId
    ) {
      const costPerUnit = 3;
      const totalGoldCost = investmentUnits * costPerUnit;
      const basePointsAttempted = investmentUnits * 1;

      const roll = rollD20();
      const success = roll >= GAIN_INFLUENCE_DC;
      const successMargin = roll - GAIN_INFLUENCE_DC;

      let calculatedSpGain = 0;

      if (success) {
        if (successMargin >= 10) {
          // Sehr gut
          calculatedSpGain = basePointsAttempted + basePointsAttempted * 2;
        } else if (successMargin >= 5) {
          // Gut
          calculatedSpGain = basePointsAttempted + basePointsAttempted * 1;
        } else {
          // Geschafft
          calculatedSpGain = basePointsAttempted;
        }
      } else {
        if (successMargin >= -5) {
          // Schlecht
          calculatedSpGain = Math.ceil(basePointsAttempted / 2);
        } else {
          // Fehlschlag
          calculatedSpGain = 0;
        }
      }

      const alreadyGainedThisRound =
        player.influenceGainedThisRound.semiPermanentPerOffice[
          targetOfficeId
        ] || 0;
      // Determine how many of the *base attempted points* can actually be applied towards the cap
      const actualBasePointsAppliedToCap = Math.min(
        basePointsAttempted,
        2 - alreadyGainedThisRound
      );

      let finalSemiPermanentPointsGained = 0;
      if (actualBasePointsAppliedToCap > 0) {
        // If the base points attempted were more than what can be applied to the cap,
        // scale the calculated bonus proportionally to the base points that *are* applied to the cap.
        if (basePointsAttempted > actualBasePointsAppliedToCap) {
          const proportionOfBaseApplied =
            actualBasePointsAppliedToCap / basePointsAttempted;
          if (success) {
            if (successMargin >= 10) {
              // Sehr gut
              finalSemiPermanentPointsGained =
                actualBasePointsAppliedToCap +
                Math.floor(basePointsAttempted * 2 * proportionOfBaseApplied);
            } else if (successMargin >= 5) {
              // Gut
              finalSemiPermanentPointsGained =
                actualBasePointsAppliedToCap +
                Math.floor(basePointsAttempted * 1 * proportionOfBaseApplied);
            } else {
              // Geschafft
              finalSemiPermanentPointsGained = actualBasePointsAppliedToCap;
            }
          } else {
            // Schlecht (Fehlschlag already results in 0)
            if (successMargin >= -5) {
              finalSemiPermanentPointsGained = Math.ceil(
                actualBasePointsAppliedToCap / 2
              );
            } else {
              finalSemiPermanentPointsGained = 0;
            }
          }
        } else {
          // Base points attempted were within cap, so use the initially calculated gain
          finalSemiPermanentPointsGained = calculatedSpGain;
        }
      } else {
        // Cap for this office was already met for base points
        finalSemiPermanentPointsGained = 0;
      }

      finalSemiPermanentPointsGained = Math.max(
        0,
        finalSemiPermanentPointsGained
      ); // Ensure it's not negative

      const goldChange = -totalGoldCost; // Cost is always paid unless specific rule for Fehlschlag refunds it

      const event = createGameEvent({
        type: GameEventType.INFLUENCE_GAINED,
        playerId: command.playerId,
        payload: {
          influenceType: 'semiPermanent',
          goldSpent: totalGoldCost, // Or goldLost if Fehlschlag implies no cost
          semiPermanentInfluenceBaseAdded: finalSemiPermanentPointsGained,
          targetOfficeId: targetOfficeId,
          roll,
          dc: GAIN_INFLUENCE_DC,
          successMargin,
        },
        apply: (currentState: GameState): GameState => {
          const newPlayer = { ...currentState.players[command.playerId] };
          newPlayer.resources = { ...newPlayer.resources };
          newPlayer.influenceGainedThisRound = {
            ...newPlayer.influenceGainedThisRound,
            semiPermanentPerOffice: {
              ...newPlayer.influenceGainedThisRound.semiPermanentPerOffice,
            },
          };

          newPlayer.resources.gold += goldChange;
          newPlayer.resources.semiPermanentInfluenceBase +=
            finalSemiPermanentPointsGained;

          if (
            targetOfficeId &&
            actualBasePointsAppliedToCap > 0 &&
            finalSemiPermanentPointsGained > 0
          ) {
            newPlayer.influenceGainedThisRound.semiPermanentPerOffice[
              targetOfficeId
            ] =
              (newPlayer.influenceGainedThisRound.semiPermanentPerOffice[
                targetOfficeId
              ] || 0) + actualBasePointsAppliedToCap;
          }

          const updatedPlayers = {
            ...currentState.players,
            [command.playerId]: newPlayer,
          };
          return {
            ...currentState,
            players: updatedPlayers,
            actionPointsRemaining: currentState.actionPointsRemaining - 1,
          };
        },
      });
      events.push(event);
    }
    return events;
  },
};
