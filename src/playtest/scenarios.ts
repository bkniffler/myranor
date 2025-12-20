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
    influence: values.influence ?? 3,
    money: values.money ?? 3,
    materials: values.materials ?? 3,
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
        checks: checks({}),
      },
      {
        userId: 'u-merchant',
        playerId: 'p-merchant',
        displayName: 'Händler',
        agent: merchantAgent,
        checks: checks({}),
      },
      {
        userId: 'u-courtier',
        playerId: 'p-courtier',
        displayName: 'Höfling',
        agent: courtierAgent,
        checks: checks({}),
      },
      {
        userId: 'u-random',
        playerId: 'p-random',
        displayName: 'Zufall',
        agent: randomAgent,
        checks: checks({}),
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
        checks: checks({}),
        llmPreamble:
          'Du spielst eine amtsfokussierte Strategie: Hauptziel Erwerb von Ämtern und Einflussgewinn; sekundär städtischer Besitz und Geldgewinnaktionen.',
        strategyCard: {
          title: 'Amtsfokus',
          risk: 'aggressive',
          primary: [
            'Aemter sammeln (klein), wenn bezahlbar',
            'Einflussgewinn priorisieren, um Amtskosten zu decken',
          ],
          secondary: [
            'Staedtischer Besitz fuer Einfluss/Gold',
            'Geldgewinnaktionen zur Finanzierung',
            'Organisationen (Kult/Collegium), wenn moeglich',
          ],
          guardrails: [
            'Goldreserve >= 6',
            'Wenn Einfluss < 4: Einfluss gewinnen',
            'Nicht nur Einfluss waehlen, wenn Verkauf/Material moeglich',
          ],
        },
      },
      {
        userId: 'u-trade',
        playerId: 'p-trade',
        displayName: 'Handel & Geld',
        agent: tradeFocusAgent,
        checks: checks({}),
        llmPreamble:
          'Du spielst eine handels- und geldgewinnorientierte Strategie: Hauptziel Geldgewinn (Verkauf/Verleih); sekundär Handelsstrukturen, Werkstätten und städtischer Besitz.',
        strategyCard: {
          title: 'Handel & Geld',
          risk: 'aggressive',
          primary: [
            'Geldgewinn (MoneySell/MoneyLend) priorisieren',
            'Handelsunternehmungen erwerben',
            'Verkaufen, sobald Inventar aufgebaut ist',
          ],
          secondary: [
            'Staedtischer Besitz fuer Gold/Einfluss',
            'Werkstattaufsicht fuer SM',
          ],
          guardrails: [
            'Goldreserve >= 4',
            'Wenn Inventar leer: Materialgewinn priorisieren',
          ],
        },
      },
      {
        userId: 'u-city',
        playerId: 'p-city',
        displayName: 'Stadt & Unterwelt',
        agent: cityUnderworldAgent,
        checks: checks({}),
        llmPreamble:
          'Du spielst eine stadtorientierte/unterwelt-Strategie: Fokus städtischer Besitz, Unterwelt-Netzwerke und Anhänger; sekundär Ämter, Geldgewinn, Werkstätten.',
        strategyCard: {
          title: 'Stadt & Unterwelt',
          risk: 'aggressive',
          primary: [
            'Staedtischen Besitz aufbauen',
            'Unterwelt-Organisation priorisieren',
            'Geldgewinn fuer Stabilitaet',
          ],
          secondary: [
            'Einflussgewinn fuer Orga-Kosten',
            'Werkstattaufsicht wenn AK uebrig',
          ],
          guardrails: [
            'Goldreserve >= 6',
            'HQ-Anforderung fuer Orga beachten',
          ],
        },
      },
      {
        userId: 'u-workshop',
        playerId: 'p-workshop',
        displayName: 'Werkstattfokus',
        agent: workshopFocusAgent,
        checks: checks({}),
        llmPreamble:
          'Du spielst eine werkstattfokussierte Strategie: Fokus Werkstätten und städtischer Besitz; sekundär Handwerks-Strukturen, Materialgewinn (Werkstatt) und Handel.',
        strategyCard: {
          title: 'Werkstattfokus',
          risk: 'conservative',
          primary: [
            'Materialgewinn ueber Werkstattaufsicht',
            'Staedtischer Besitz fuer Kapazitaet',
            'Lager bauen, wenn Material liegen bleibt',
          ],
          secondary: [
            'Geldgewinn bei Ueberschuss',
            'Handwerkscollegium, wenn moeglich',
          ],
          guardrails: ['AK nicht unter 1 druecken', 'Goldreserve >= 6'],
        },
      },
      {
        userId: 'u-domain',
        playerId: 'p-domain',
        displayName: 'Domänenfokus',
        agent: domainFocusAgent,
        checks: checks({}),
        llmPreamble:
          'Du spielst eine domänenfokussierte Strategie: Fokus Domänenentwicklung, Materialgewinn (Domäne) und Verkauf von Rohstoffen; sekundär Werkstätten/Lager, Fachleute und passende Ämter.',
        strategyCard: {
          title: 'Domaenenfokus',
          risk: 'conservative',
          primary: [
            'Domaenen erwerben',
            'Materialgewinn Domaene',
            'Verkauf von RM/SM',
          ],
          secondary: [
            'Lager bauen, wenn RM liegen bleibt',
            'Handelsunternehmung, wenn Gold uebrig',
          ],
          guardrails: [
            'Goldreserve >= 6',
            'Wenn Inventar voll: MoneySell priorisieren',
          ],
        },
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
        checks: checks({}),
      },
      {
        userId: 'u-trade',
        playerId: 'p-trade',
        displayName: 'Handel & Geld (Planner)',
        agent: plannerTradeAgent,
        checks: checks({}),
      },
      {
        userId: 'u-city',
        playerId: 'p-city',
        displayName: 'Stadt & Unterwelt (Planner)',
        agent: plannerCityAgent,
        checks: checks({}),
      },
      {
        userId: 'u-workshop',
        playerId: 'p-workshop',
        displayName: 'Werkstattfokus (Planner)',
        agent: plannerWorkshopAgent,
        checks: checks({}),
      },
      {
        userId: 'u-domain',
        playerId: 'p-domain',
        displayName: 'Domänenfokus (Planner)',
        agent: plannerDomainAgent,
        checks: checks({}),
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
        checks: checks({}),
      },
      {
        userId: 'u-merchant',
        playerId: 'p-merchant',
        displayName: 'Händler',
        agent: merchantAgent,
        checks: checks({}),
      },
      {
        userId: 'u-speculator',
        playerId: 'p-speculator',
        displayName: 'Spekulant',
        agent: speculatorAgent,
        checks: checks({}),
      },
      {
        userId: 'u-courtier',
        playerId: 'p-courtier',
        displayName: 'Höfling',
        agent: courtierAgent,
        checks: checks({}),
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
        checks: checks({}),
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
