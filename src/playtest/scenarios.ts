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
          'Du spielst eine amtsfokussierte Strategie: Hauptziel Erwerb von Ämtern und Einflussgewinn; sekundär städtischer Besitz, große Domäne und Geldgewinnaktionen.',
        strategyCard: {
          title: 'Amtsfokus',
          risk: 'aggressive',
          primary: [
            'Aemter sammeln (klein -> mittel -> gross), wenn bezahlbar',
            'Temporären Einfluss nutzen, um Aemter frueh zu sichern',
            'Grosse Domaene anstreben (small -> medium -> large), sobald finanzierbar',
          ],
          secondary: [
            'Staedtischer Besitz fuer Einfluss/Gold',
            'Geldgewinnaktionen zur Finanzierung',
            'Lager bauen, um RM/SM zu halten (bei schlechtem Markt)',
            'Organisationen (Kult/Collegium), wenn moeglich',
          ],
          guardrails: [
            'Goldreserve >= 6',
            'Wenn Einfluss < 4: Einfluss gewinnen',
            'Aemter nicht erzwingen, wenn Cap erreicht oder Ressourcen fehlen',
            'Nicht nur Einfluss waehlen, wenn Verkauf/Material sinnvoll ist',
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
          'Du spielst eine handels- und geldgewinnorientierte Strategie: Hauptziel Geldgewinn (Verkauf/Verleih); sekundär Handelsstrukturen, große Domäne, Werkstätten und städtischer Besitz.',
        strategyCard: {
          title: 'Handel & Geld',
          risk: 'aggressive',
          primary: [
            'Geldgewinn (MoneySell/MoneyLend) priorisieren',
            'Handelsunternehmungen erwerben',
            'RM kaufen, wenn Markt guenstig (MoneyBuy/MoneySellBuy)',
            'Lager bauen, um RM/SM zu halten und spaeter teurer zu verkaufen',
            'Grosse Domaene anstreben (Cap + Rohstoffzufuhr)',
          ],
          secondary: [
            'Staedtischer Besitz fuer Gold/Einfluss',
            'Werkstattaufsicht fuer SM',
            'Werkstatt bauen, wenn genug RM fuer Umwandlung',
          ],
          guardrails: [
            'Goldreserve >= 4',
            'Wenn Inventar leer: Materialgewinn priorisieren',
            'Wenn Markt schlecht und Lager vorhanden: nicht verkaufen',
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
          'Du spielst eine stadtorientierte/unterwelt-Strategie: Fokus städtischer Besitz, Unterwelt-Netzwerke und Anhänger; sekundär Ämter, große Domäne, Geldgewinn, Werkstätten.',
        strategyCard: {
          title: 'Stadt & Unterwelt',
          risk: 'aggressive',
          primary: [
            'Staedtischen Besitz aufbauen',
            'Unterwelt-Organisation priorisieren',
            'Geldgewinn fuer Stabilitaet',
            'Grosse Domaene anstreben, wenn bezahlbar',
          ],
          secondary: [
            'Einflussgewinn fuer Orga-Kosten',
            'Werkstattaufsicht wenn AK uebrig',
            'Lager bauen, wenn Markt schlecht und Vorrat sinnvoll',
          ],
          guardrails: [
            'Goldreserve >= 6',
            'HQ-Anforderung fuer Orga beachten',
            'Nicht zu frueh in Domaenen investieren, wenn Stadt/Orga stockt',
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
          'Du spielst eine werkstattfokussierte Strategie: Fokus Werkstätten und städtischer Besitz; sekundär Handwerks-Strukturen, große Domäne, Materialgewinn (Werkstatt) und Handel.',
        strategyCard: {
          title: 'Werkstattfokus',
          risk: 'conservative',
          primary: [
            'Werkstaetten aufbauen/ausbauen',
            'RM kaufen, wenn Markt guenstig (MoneyBuy/MoneySellBuy)',
            'Lager bauen, um RM/SM zu puffern',
            'Staedtischer Besitz fuer Produktionskapazitaet',
            'Grosse Domaene anstreben (Rohstoffbasis)',
          ],
          secondary: [
            'Geldgewinn bei Ueberschuss',
            'Handwerkscollegium, wenn moeglich',
          ],
          guardrails: [
            'AK nicht unter 1 druecken',
            'Goldreserve >= 6',
            'Nicht verkaufen, wenn Werkstaetten Input brauchen',
          ],
        },
      },
      {
        userId: 'u-domain',
        playerId: 'p-domain',
        displayName: 'Domänenfokus',
        agent: domainFocusAgent,
        checks: checks({}),
        llmPreamble:
          'Du spielst eine domänenfokussierte Strategie: Fokus Domänenentwicklung (Ziel: grosse Domäne), Materialgewinn (Domäne) und Verkauf von Rohstoffen; sekundär Werkstätten/Lager, Fachleute und passende Ämter.',
        strategyCard: {
          title: 'Domaenenfokus',
          risk: 'conservative',
          primary: [
            'Domaenen erwerben (small -> medium -> large)',
            'Materialgewinn Domaene',
            'Lager bauen, um RM/SM zu halten',
            'Verkauf von RM/SM, wenn Markt gut',
          ],
          secondary: [
            'Handelsunternehmung, wenn Gold uebrig',
            'Werkstatt bauen, wenn RM-Ueberschuss',
          ],
          guardrails: [
            'Goldreserve >= 6',
            'Wenn Inventar voll: MoneySell priorisieren',
            'Nicht in Stadt/Orga investieren, bevor grosse Domaene erreichbar ist',
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
