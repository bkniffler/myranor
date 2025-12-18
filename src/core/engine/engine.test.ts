import { describe, expect, test } from 'bun:test';

import { asUserId } from '../domain/ids';
import { createSeededRng } from '../util/rng';
import { decide, reduceEvents } from './engine';
import { GameRuleError } from './errors';

describe('engine smoke', () => {
  test('round flow: join -> income -> action -> conversion -> reset -> next round', () => {
    const rng = createSeededRng(123);
    const gm = { actor: { role: 'gm' as const, userId: 'gm-1' }, rng };
    const p1 = { actor: { role: 'player' as const, userId: 'user-1' }, rng };

    let state = reduceEvents(null, decide(null, { type: 'CreateCampaign', campaignId: 'c-1', name: 'Test' }, gm));

    state = reduceEvents(
      state,
      decide(state, { type: 'JoinCampaign', campaignId: 'c-1', playerId: 'p-1', displayName: 'Alice' }, p1),
    );

    expect(state?.phase).toBe('maintenance');
    expect(Object.values(state?.players ?? {})).toHaveLength(1);

    const alice = state!.players[state!.playerIdByUserId[asUserId('user-1')]];
    expect(alice.economy.gold).toBe(4);
    expect(alice.turn.laborAvailable).toBe(5);

    // GM opens actions and applies income
    state = reduceEvents(state, decide(state, { type: 'AdvancePhase', campaignId: 'c-1' }, gm));
    expect(state?.phase).toBe('actions');

    const aliceAfterIncome = state!.players[state!.playerIdByUserId[asUserId('user-1')]];
    expect(aliceAfterIncome.economy.gold).toBe(6);
    expect(aliceAfterIncome.economy.rawMaterials).toBe(4);

    // Player performs one action
    state = reduceEvents(
      state,
      decide(state, { type: 'GatherMaterials', campaignId: 'c-1', mode: 'domain', investments: 2 }, p1),
    );
    expect(state?.phase).toBe('actions');

    const aliceAfterAction = state!.players[state!.playerIdByUserId[asUserId('user-1')]];
    expect(aliceAfterAction.turn.actionsUsed).toBe(1);
    expect(aliceAfterAction.turn.laborAvailable).toBe(3);
    expect(aliceAfterAction.economy.rawMaterials).toBeGreaterThan(4);

    // Conversion
    state = reduceEvents(state, decide(state, { type: 'AdvancePhase', campaignId: 'c-1' }, gm));
    expect(state?.phase).toBe('conversion');

    const aliceAfterConversion = state!.players[state!.playerIdByUserId[asUserId('user-1')]];
    expect(aliceAfterConversion.economy.rawMaterials).toBe(0);
    expect(aliceAfterConversion.economy.specialMaterials).toBe(0);
    expect(aliceAfterConversion.economy.gold).toBeGreaterThanOrEqual(6);

    // Reset
    state = reduceEvents(state, decide(state, { type: 'AdvancePhase', campaignId: 'c-1' }, gm));
    expect(state?.phase).toBe('reset');

    const aliceAfterReset = state!.players[state!.playerIdByUserId[asUserId('user-1')]];
    expect(aliceAfterReset.turn.actionsUsed).toBe(0);
    expect(aliceAfterReset.turn.laborAvailable).toBe(5);
    expect(aliceAfterReset.turn.influenceAvailable).toBe(1);

    // Next round maintenance
    state = reduceEvents(state, decide(state, { type: 'AdvancePhase', campaignId: 'c-1' }, gm));
    expect(state?.phase).toBe('maintenance');
    expect(state?.round).toBe(2);
  });

  test('cannot act outside actions phase', () => {
    const rng = createSeededRng(1);
    const gm = { actor: { role: 'gm' as const, userId: 'gm-1' }, rng };
    const p1 = { actor: { role: 'player' as const, userId: 'user-1' }, rng };

    let state = reduceEvents(null, decide(null, { type: 'CreateCampaign', campaignId: 'c-1', name: 'Test' }, gm));
    state = reduceEvents(
      state,
      decide(state, { type: 'JoinCampaign', campaignId: 'c-1', playerId: 'p-1', displayName: 'Alice' }, p1),
    );

    expect(() =>
      decide(state, { type: 'GatherMaterials', campaignId: 'c-1', mode: 'domain', investments: 1 }, p1),
    ).toThrow(GameRuleError);
  });
});
