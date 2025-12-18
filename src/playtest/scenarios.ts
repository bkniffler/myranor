import type { PlayerChecks } from '../core';

import { builderAgent, courtierAgent, merchantAgent, randomAgent, speculatorAgent } from './agents';
import type { PlayerProfile } from './types';

export type Scenario = {
  name: string;
  players: PlayerProfile[];
};

function checks(values: Partial<PlayerChecks>): PlayerChecks {
  return {
    influence: values.influence ?? 5,
    money: values.money ?? 5,
    materials: values.materials ?? 5,
  };
}

export const SCENARIOS: Scenario[] = [
  {
    name: 'core-v0-all5',
    players: [
      {
        userId: 'u-builder',
        playerId: 'p-builder',
        displayName: 'Baumeister',
        agent: builderAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
      },
      {
        userId: 'u-merchant',
        playerId: 'p-merchant',
        displayName: 'Händler',
        agent: merchantAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
      },
      {
        userId: 'u-courtier',
        playerId: 'p-courtier',
        displayName: 'Höfling',
        agent: courtierAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
      },
      {
        userId: 'u-random',
        playerId: 'p-random',
        displayName: 'Zufall',
        agent: randomAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
      },
    ],
  },
  {
    name: 'core-v0-marketaware',
    players: [
      {
        userId: 'u-builder',
        playerId: 'p-builder',
        displayName: 'Baumeister',
        agent: builderAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
      },
      {
        userId: 'u-merchant',
        playerId: 'p-merchant',
        displayName: 'Händler',
        agent: merchantAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
      },
      {
        userId: 'u-speculator',
        playerId: 'p-speculator',
        displayName: 'Spekulant',
        agent: speculatorAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
      },
      {
        userId: 'u-courtier',
        playerId: 'p-courtier',
        displayName: 'Höfling',
        agent: courtierAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
      },
    ],
  },
  {
    name: 'core-v0-specialists',
    players: [
      {
        userId: 'u-builder',
        playerId: 'p-builder',
        displayName: 'Baumeister',
        agent: builderAgent,
        checks: checks({ influence: 1, money: 3, materials: 5 }),
      },
      {
        userId: 'u-merchant',
        playerId: 'p-merchant',
        displayName: 'Händler',
        agent: merchantAgent,
        checks: checks({ influence: 1, money: 5, materials: 3 }),
      },
      {
        userId: 'u-courtier',
        playerId: 'p-courtier',
        displayName: 'Höfling',
        agent: courtierAgent,
        checks: checks({ influence: 5, money: 3, materials: 1 }),
      },
      {
        userId: 'u-random',
        playerId: 'p-random',
        displayName: 'Allrounder',
        agent: randomAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
      },
    ],
  },
];

export function listScenarioNames(): string[] {
  return SCENARIOS.map((s) => s.name);
}

export function getScenario(name: string): Scenario | null {
  return SCENARIOS.find((s) => s.name === name) ?? null;
}
