import { asUserId, createSeededRng, decide, reduceEvents } from './core';

type Actor = { role: 'gm' | 'player'; userId: string };

function run(
  state: ReturnType<typeof reduceEvents>,
  command: Parameters<typeof decide>[1],
  actor: Actor,
  rngSeeded: ReturnType<typeof createSeededRng>,
) {
  const events = decide(state, command as any, { actor, rng: rngSeeded });
  const nextState = reduceEvents(state, events);
  return { events, state: nextState };
}

function getPlayer(state: NonNullable<ReturnType<typeof reduceEvents>>, userId: string) {
  const playerId = state.playerIdByUserId[asUserId(userId)];
  return state.players[playerId];
}

function printRoundSummary(
  round: number,
  phase: string,
  alice: ReturnType<typeof getPlayer>,
  bob: ReturnType<typeof getPlayer>,
) {
  console.log(`\n=== Runde ${round} (${phase}) ===`);
  console.log(
    `Alice: gold=${alice.economy.gold}, rm=${alice.economy.rawMaterials}, sm=${alice.economy.specialMaterials}, ak=${alice.turn.laborAvailable}, inf=${alice.turn.influenceAvailable}, actionsUsed=${alice.turn.actionsUsed}`,
  );
  console.log(
    `Bob:   gold=${bob.economy.gold}, rm=${bob.economy.rawMaterials}, sm=${bob.economy.specialMaterials}, ak=${bob.turn.laborAvailable}, inf=${bob.turn.influenceAvailable}, actionsUsed=${bob.turn.actionsUsed}`,
  );
}

function main() {
  const rng = createSeededRng(42);
  const gm: Actor = { role: 'gm', userId: 'gm-1' };
  const aliceUser: Actor = { role: 'player', userId: 'user-alice' };
  const bobUser: Actor = { role: 'player', userId: 'user-bob' };

  let state: ReturnType<typeof reduceEvents> = null;
  const publicLog: string[] = [];

  const capturePublicLog = (events: any[]) => {
    for (const event of events) {
      if (event.type === 'PublicLogEntryAdded') {
        publicLog.push(event.message);
      }
    }
  };

  // Create campaign
  {
    const result = run(
      state,
      { type: 'CreateCampaign', campaignId: 'campaign-1', name: 'Playtest' },
      gm,
      rng,
    );
    capturePublicLog(result.events);
    state = result.state;
  }

  // Join players
  {
    const result = run(
      state,
      {
        type: 'JoinCampaign',
        campaignId: 'campaign-1',
        playerId: 'p-alice',
        displayName: 'Alice',
      },
      aliceUser,
      rng,
    );
    capturePublicLog(result.events);
    state = result.state;
  }
  {
    const result = run(
      state,
      {
        type: 'JoinCampaign',
        campaignId: 'campaign-1',
        playerId: 'p-bob',
        displayName: 'Bob',
      },
      bobUser,
      rng,
    );
    capturePublicLog(result.events);
    state = result.state;
  }

  if (!state) throw new Error('State missing');

  // Play 3 rounds.
  for (let i = 0; i < 3; i += 1) {
    const round = state.round;
    const alice = getPlayer(state, aliceUser.userId);
    const bob = getPlayer(state, bobUser.userId);
    printRoundSummary(round, state.phase, alice, bob);

    // maintenance -> actions (income)
    {
      const result = run(state, { type: 'AdvancePhase', campaignId: 'campaign-1' }, gm, rng);
      capturePublicLog(result.events);
      state = result.state;
    }

    // actions: each does 2 actions: gather domain (3 AK) + gather workshop (2 AK)
    {
      const result = run(
        state,
        { type: 'GatherMaterials', campaignId: 'campaign-1', mode: 'domain', investments: 3 },
        aliceUser,
        rng,
      );
      capturePublicLog(result.events);
      state = result.state;
    }
    {
      const result = run(
        state,
        { type: 'GatherMaterials', campaignId: 'campaign-1', mode: 'workshop', investments: 2 },
        aliceUser,
        rng,
      );
      capturePublicLog(result.events);
      state = result.state;
    }
    {
      const result = run(
        state,
        { type: 'GatherMaterials', campaignId: 'campaign-1', mode: 'domain', investments: 3 },
        bobUser,
        rng,
      );
      capturePublicLog(result.events);
      state = result.state;
    }
    {
      const result = run(
        state,
        { type: 'GatherMaterials', campaignId: 'campaign-1', mode: 'workshop', investments: 2 },
        bobUser,
        rng,
      );
      capturePublicLog(result.events);
      state = result.state;
    }

    {
      const aliceAfter = getPlayer(state, aliceUser.userId);
      const bobAfter = getPlayer(state, bobUser.userId);
      printRoundSummary(state.round, state.phase, aliceAfter, bobAfter);
    }

    // actions -> conversion
    {
      const result = run(state, { type: 'AdvancePhase', campaignId: 'campaign-1' }, gm, rng);
      capturePublicLog(result.events);
      state = result.state;
    }

    // conversion -> reset
    {
      const result = run(state, { type: 'AdvancePhase', campaignId: 'campaign-1' }, gm, rng);
      capturePublicLog(result.events);
      state = result.state;
    }

    // reset -> maintenance (next round)
    {
      const result = run(state, { type: 'AdvancePhase', campaignId: 'campaign-1' }, gm, rng);
      capturePublicLog(result.events);
      state = result.state;
    }
  }

  console.log('\n=== Public Log (Auszug) ===');
  for (const entry of publicLog) console.log(`- ${entry}`);
}

main();

