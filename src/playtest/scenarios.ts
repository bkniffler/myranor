import type { PlayerChecks } from '../core';

import {
  builderAgent,
  cityUnderworldAgent,
  courtierAgent,
  domainFocusAgent,
  merchantAgent,
  officeFocusAgent,
  plannerCityAgent,
  plannerDomainAgent,
  plannerOfficeAgent,
  plannerTradeAgent,
  plannerWorkshopAgent,
  randomAgent,
  speculatorAgent,
  tradeFocusAgent,
  workshopFocusAgent,
} from './agents';
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
    name: 'core-v1-all5',
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
    name: 'core-v1-strategies',
    players: [
      {
        userId: 'u-office',
        playerId: 'p-office',
        displayName: 'Amtsfokus',
        agent: officeFocusAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
        llmPreamble:
          'Du spielst eine amtsfokussierte Strategie: Hauptziel Erwerb von Ämtern und Einflussgewinn; sekundär städtischer Besitz und Geldgewinnaktionen.',
      },
      {
        userId: 'u-trade',
        playerId: 'p-trade',
        displayName: 'Handel & Geld',
        agent: tradeFocusAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
        llmPreamble:
          'Du spielst eine handels- und geldgewinnorientierte Strategie: Hauptziel Geldgewinn (Verkauf/Verleih); sekundär Handelsstrukturen, Werkstätten und städtischer Besitz.',
      },
      {
        userId: 'u-city',
        playerId: 'p-city',
        displayName: 'Stadt & Unterwelt',
        agent: cityUnderworldAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
        llmPreamble:
          'Du spielst eine stadtorientierte/unterwelt-Strategie: Fokus städtischer Besitz, Unterwelt-Netzwerke und Anhänger; sekundär Ämter, Geldgewinn, Werkstätten.',
      },
      {
        userId: 'u-workshop',
        playerId: 'p-workshop',
        displayName: 'Werkstattfokus',
        agent: workshopFocusAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
        llmPreamble:
          'Du spielst eine werkstattfokussierte Strategie: Fokus Werkstätten und städtischer Besitz; sekundär Handwerks-Strukturen, Materialgewinn (Werkstatt) und Handel.',
      },
      {
        userId: 'u-domain',
        playerId: 'p-domain',
        displayName: 'Domänenfokus',
        agent: domainFocusAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
        llmPreamble:
          'Du spielst eine domänenfokussierte Strategie: Fokus Domänenentwicklung, Materialgewinn (Domäne) und Verkauf von Rohstoffen; sekundär Werkstätten/Lager, Fachleute und passende Ämter.',
      },
    ],
  },
  {
    name: 'core-v1-planner-strategies',
    players: [
      {
        userId: 'u-office',
        playerId: 'p-office',
        displayName: 'Amtsfokus (Planner)',
        agent: plannerOfficeAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
      },
      {
        userId: 'u-trade',
        playerId: 'p-trade',
        displayName: 'Handel & Geld (Planner)',
        agent: plannerTradeAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
      },
      {
        userId: 'u-city',
        playerId: 'p-city',
        displayName: 'Stadt & Unterwelt (Planner)',
        agent: plannerCityAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
      },
      {
        userId: 'u-workshop',
        playerId: 'p-workshop',
        displayName: 'Werkstattfokus (Planner)',
        agent: plannerWorkshopAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
      },
      {
        userId: 'u-domain',
        playerId: 'p-domain',
        displayName: 'Domänenfokus (Planner)',
        agent: plannerDomainAgent,
        checks: checks({ influence: 5, money: 5, materials: 5 }),
      },
    ],
  },
  {
    name: 'core-v1-marketaware',
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
    name: 'core-v1-specialists',
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
