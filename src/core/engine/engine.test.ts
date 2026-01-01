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

    let state = reduceEvents(
      null,
      decide(
        null,
        { type: 'CreateCampaign', campaignId: 'c-1', name: 'Test' },
        gm
      )
    );

    state = reduceEvents(
      state,
      decide(
        state,
        {
          type: 'JoinCampaign',
          campaignId: 'c-1',
          playerId: 'p-1',
          displayName: 'Alice',
        },
        p1
      )
    );

    expect(state?.phase).toBe('maintenance');
    expect(Object.values(state?.players ?? {})).toHaveLength(1);

    const alice = state!.players[state!.playerIdByUserId[asUserId('user-1')]];
    expect(alice.economy.gold).toBe(4);
    expect(alice.turn.laborAvailable).toBe(5);

    // GM opens actions and applies income
    state = reduceEvents(
      state,
      decide(state, { type: 'AdvancePhase', campaignId: 'c-1' }, gm)
    );
    expect(state?.phase).toBe('actions');

    const aliceAfterIncome =
      state!.players[state!.playerIdByUserId[asUserId('user-1')]];
    expect(aliceAfterIncome.economy.gold).toBe(6);
    expect(aliceAfterIncome.economy.inventory.raw['raw.grain']).toBe(8);
    expect(aliceAfterIncome.economy.inventory.raw['raw.honey']).toBeUndefined();

    // Player performs one action
    state = reduceEvents(
      state,
      decide(
        state,
        {
          type: 'GainMaterials',
          campaignId: 'c-1',
          mode: 'domainAdministration',
          investments: 2,
        },
        p1
      )
    );
    expect(state?.phase).toBe('actions');

    const aliceAfterAction =
      state!.players[state!.playerIdByUserId[asUserId('user-1')]];
    expect(aliceAfterAction.turn.actionsUsed).toBe(1);
    expect(aliceAfterAction.turn.laborAvailable).toBe(3);
    const rawAfterAction = Object.values(
      aliceAfterAction.economy.inventory.raw
    ).reduce((sum, v) => sum + v, 0);
    expect(rawAfterAction).toBeGreaterThan(4);

    // Conversion (auto conversion runs when entering "conversion")
    state = reduceEvents(
      state,
      decide(state, { type: 'AdvancePhase', campaignId: 'c-1' }, gm)
    );
    expect(state?.phase).toBe('conversion');

    const aliceAfterConversion =
      state!.players[state!.playerIdByUserId[asUserId('user-1')]];
    const rawAfterConversion = Object.values(
      aliceAfterConversion.economy.inventory.raw
    ).reduce((sum, v) => sum + v, 0);
    const specialAfterConversion = Object.values(
      aliceAfterConversion.economy.inventory.special
    ).reduce((sum, v) => sum + v, 0);
    // Starter-Spieler hat ein Lager → bis zu Cap werden RM/SM gehalten, Rest wird auto-umgewandelt.
    expect(rawAfterConversion).toBeLessThanOrEqual(15);
    expect(specialAfterConversion).toBeLessThanOrEqual(5);
    expect(aliceAfterConversion.economy.gold).toBeGreaterThanOrEqual(6);

    // Reset
    state = reduceEvents(
      state,
      decide(state, { type: 'AdvancePhase', campaignId: 'c-1' }, gm)
    );
    expect(state?.phase).toBe('reset');

    const aliceAfterReset =
      state!.players[state!.playerIdByUserId[asUserId('user-1')]];
    expect(aliceAfterReset.turn.actionsUsed).toBe(0);
    expect(aliceAfterReset.turn.laborAvailable).toBe(5);
    expect(aliceAfterReset.turn.influenceAvailable).toBe(5);

    // Next round maintenance
    state = reduceEvents(
      state,
      decide(state, { type: 'AdvancePhase', campaignId: 'c-1' }, gm)
    );
    expect(state?.phase).toBe('maintenance');
    expect(state?.round).toBe(2);
  });

  test('cannot act outside actions phase', () => {
    const rng = createSeededRng(1);
    const gm = { actor: { role: 'gm' as const, userId: 'gm-1' }, rng };
    const p1 = { actor: { role: 'player' as const, userId: 'user-1' }, rng };

    let state = reduceEvents(
      null,
      decide(
        null,
        { type: 'CreateCampaign', campaignId: 'c-1', name: 'Test' },
        gm
      )
    );
    state = reduceEvents(
      state,
      decide(
        state,
        {
          type: 'JoinCampaign',
          campaignId: 'c-1',
          playerId: 'p-1',
          displayName: 'Alice',
        },
        p1
      )
    );

    expect(() =>
      decide(
        state,
        {
          type: 'GainMaterials',
          campaignId: 'c-1',
          mode: 'domainAdministration',
          investments: 1,
        },
        p1
      )
    ).toThrow(GameRuleError);
  });

  test('Neider-Gegenreaktion requires explicit loss choice', () => {
    const rng = createSeededRng(42);
    const gm = { actor: { role: 'gm' as const, userId: 'gm-1' }, rng };
    const p1 = { actor: { role: 'player' as const, userId: 'user-1' }, rng };

    let state = reduceEvents(
      null,
      decide(
        null,
        { type: 'CreateCampaign', campaignId: 'c-1', name: 'Test' },
        gm
      )
    );
    state = reduceEvents(
      state,
      decide(
        state,
        {
          type: 'JoinCampaign',
          campaignId: 'c-1',
          playerId: 'p-1',
          displayName: 'Alice',
        },
        p1
      )
    );

    const playerId = state!.playerIdByUserId[asUserId('user-1')];
    state = reduceEvents(state, [
      {
        type: 'PlayerPoliticsAdjusted',
        visibility: { scope: 'private', playerId },
        playerId,
        nDelta: 3,
        reason: 'test',
      },
    ]);

    expect(() =>
      decide(state, { type: 'AdvancePhase', campaignId: 'c-1' }, gm)
    ).toThrow(GameRuleError);

    state = reduceEvents(
      state,
      decide(
        state,
        {
          type: 'SetCounterReactionLossChoice',
          campaignId: 'c-1',
          choice: 'gold',
        },
        p1
      )
    );

    const events = decide(
      state,
      { type: 'AdvancePhase', campaignId: 'c-1' },
      gm
    );
    const reaction = events.find(
      (e) => e.type === 'PlayerCounterReactionResolved'
    );
    expect(reaction?.type).toBe('PlayerCounterReactionResolved');
    if (reaction && reaction.type === 'PlayerCounterReactionResolved') {
      expect(reaction.loss.kind).toBe('gold');
    }
  });

  test('long-term project: insulae build progresses and settles tenants', () => {
    const rng = createSeededRng(7);
    const gm = { actor: { role: 'gm' as const, userId: 'gm-1' }, rng };
    const p1 = { actor: { role: 'player' as const, userId: 'user-1' }, rng };

    let state = reduceEvents(
      null,
      decide(
        null,
        { type: 'CreateCampaign', campaignId: 'c-1', name: 'Test' },
        gm
      )
    );

    state = reduceEvents(
      state,
      decide(
        state,
        {
          type: 'JoinCampaign',
          campaignId: 'c-1',
          playerId: 'p-1',
          displayName: 'Alice',
        },
        p1
      )
    );

    // Open actions (round 1) and apply income.
    state = reduceEvents(
      state,
      decide(state, { type: 'AdvancePhase', campaignId: 'c-1' }, gm)
    );
    expect(state?.phase).toBe('actions');

    const playerId = state!.playerIdByUserId[asUserId('user-1')];

    // Give the player the required materials and gold (test helper via event).
    state = reduceEvents(state, [
      {
        type: 'PlayerPendingApplied',
        visibility: { scope: 'private', playerId },
        playerId,
        goldApplied: 100,
        laborApplied: 0,
        rawApplied: { 'raw.bricks': 30, 'raw.lumber': 15 },
        specialApplied: {},
        magicPowerApplied: 0,
      },
    ]);

    // Add a medium city property (so Insulae is allowed).
    state = reduceEvents(state, [
      {
        type: 'PlayerCityPropertyAcquired',
        visibility: { scope: 'private', playerId },
        playerId,
        cityPropertyId: 'city-test',
        tier: 'medium',
        tenure: 'owned',
        dc: 0,
        roll: { expression: '1d20', rolls: [20], total: 20 },
        rollModifier: 0,
        rollTotal: 20,
        tierResult: 'success',
        goldSpent: 0,
        actionCost: 0,
        actionKey: 'test',
      },
    ]);

    // Start Insulaebau as a long-term project (4 rounds, 2 AK/round).
    state = reduceEvents(
      state,
      decide(
        state,
        {
          type: 'BuildFacility',
          campaignId: 'c-1',
          location: { kind: 'cityProperty', id: 'city-test' },
          facilityKey: 'general.medium.city.insulae',
        },
        p1
      )
    );

    const afterStart = state!.players[playerId];
    expect(afterStart.holdings.longTermProjects).toHaveLength(1);
    expect(
      afterStart.holdings.cityProperties.find((c) => c.id === 'city-test')
        ?.facilities.length
    ).toBe(0);

    const advance = () => {
      state = reduceEvents(
        state,
        decide(state, { type: 'AdvancePhase', campaignId: 'c-1' }, gm)
      );
    };

    // Cycle rounds until the project completes in maintenance->actions at round 4.
    // Round 1: actions -> conversion -> reset -> maintenance (round 2) -> actions (progress 1)
    advance(); // actions -> conversion
    advance(); // conversion -> reset
    advance(); // reset -> maintenance (round 2)
    advance(); // maintenance -> actions (round 2; progress)
    expect(state?.round).toBe(2);
    expect(state?.phase).toBe('actions');
    expect(state!.players[playerId].holdings.longTermProjects[0]?.remainingRounds)
      .toBe(2);

    // Round 2 -> Round 3 (progress 2)
    advance(); // actions -> conversion
    advance(); // conversion -> reset
    advance(); // reset -> maintenance (round 3)
    advance(); // maintenance -> actions (round 3; progress)
    expect(state?.round).toBe(3);
    expect(state!.players[playerId].holdings.longTermProjects[0]?.remainingRounds)
      .toBe(1);

    // Round 3 -> Round 4 (progress 3 + complete)
    advance(); // actions -> conversion
    advance(); // conversion -> reset
    advance(); // reset -> maintenance (round 4)
    advance(); // maintenance -> actions (round 4; complete)
    expect(state?.round).toBe(4);
    expect(state?.phase).toBe('actions');
    expect(state!.players[playerId].holdings.longTermProjects).toHaveLength(0);
    const cityAfterComplete = state!.players[playerId].holdings.cityProperties.find(
      (c) => c.id === 'city-test'
    );
    expect(cityAfterComplete?.facilities.some((f) => f.key === 'general.medium.city.insulae')).toBe(true);

    // Settlement happens in the next round's maintenance->actions (round 5).
    advance(); // actions -> conversion
    advance(); // conversion -> reset
    advance(); // reset -> maintenance (round 5)
    advance(); // maintenance -> actions (round 5; settlement)
    const cityAfterSettlement =
      state!.players[playerId].holdings.cityProperties.find(
        (c) => c.id === 'city-test'
      );
    expect(cityAfterSettlement?.tenants.levels).toBe(2);
  });

  test('personal facilities: raise specialist cap', () => {
    const rng = createSeededRng(9);
    const gm = { actor: { role: 'gm' as const, userId: 'gm-1' }, rng };
    const p1 = { actor: { role: 'player' as const, userId: 'user-1' }, rng };

    let state = reduceEvents(
      null,
      decide(
        null,
        { type: 'CreateCampaign', campaignId: 'c-1', name: 'Test' },
        gm
      )
    );

    state = reduceEvents(
      state,
      decide(
        state,
        {
          type: 'JoinCampaign',
          campaignId: 'c-1',
          playerId: 'p-1',
          displayName: 'Alice',
        },
        p1
      )
    );

    // Round 1 actions (apply income).
    state = reduceEvents(
      state,
      decide(state, { type: 'AdvancePhase', campaignId: 'c-1' }, gm)
    );
    expect(state?.phase).toBe('actions');

    const playerId = state!.playerIdByUserId[asUserId('user-1')];

    // Give enough gold for hires and a personal facility.
    state = reduceEvents(state, [
      {
        type: 'PlayerPendingApplied',
        visibility: { scope: 'private', playerId },
        playerId,
        goldApplied: 200,
        laborApplied: 0,
        rawApplied: {},
        specialApplied: {},
        magicPowerApplied: 0,
      },
    ]);

    // Hire 2 specialists (base cap = 2).
    state = reduceEvents(
      state,
      decide(
        state,
        {
          type: 'HireSpecialist',
          campaignId: 'c-1',
          kind: 'builder',
          tier: 'simple',
        },
        p1
      )
    );
    state = reduceEvents(
      state,
      decide(
        state,
        {
          type: 'HireSpecialist',
          campaignId: 'c-1',
          kind: 'administrator',
          tier: 'simple',
        },
        p1
      )
    );

    expect(state!.players[playerId].holdings.specialists).toHaveLength(2);

    expect(() =>
      decide(
        state,
        { type: 'HireSpecialist', campaignId: 'c-1', kind: 'wizard', tier: 'simple' },
        p1
      )
    ).toThrow(GameRuleError);

    const advance = () => {
      state = reduceEvents(
        state,
        decide(state, { type: 'AdvancePhase', campaignId: 'c-1' }, gm)
      );
    };

    // Next round actions.
    advance(); // actions -> conversion
    advance(); // conversion -> reset
    advance(); // reset -> maintenance (round 2)
    advance(); // maintenance -> actions (round 2)
    expect(state?.phase).toBe('actions');
    expect(state?.round).toBe(2);

    // Build a personal facility (increases cap by +1).
    state = reduceEvents(
      state,
      decide(
        state,
        {
          type: 'BuildFacility',
          campaignId: 'c-1',
          location: { kind: 'personal' },
          facilityKey: 'general.small.personal.study',
        },
        p1
      )
    );
    expect(state!.players[playerId].holdings.personalFacilities).toHaveLength(1);

    // Now the 3rd hire should be accepted (cap = 3).
    const events = decide(
      state,
      { type: 'HireSpecialist', campaignId: 'c-1', kind: 'wizard', tier: 'simple' },
      p1
    );
    expect(events[0]?.type).toBe('PlayerSpecialistHired');
  });
});
