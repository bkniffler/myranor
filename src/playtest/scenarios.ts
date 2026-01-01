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

const CORE_STRATEGY_PLAYERS: PlayerProfile[] = [
  {
    userId: 'u-office',
    playerId: 'p-office',
    displayName: 'Amtsfokus',
    agent: officeFocusAgent,
    checks: checks({}),
    llmPreamble:
      'Du spielst eine amtsfokussierte Strategie: Hauptziel ist der Erwerb und Ausbau von Aemtern, deren Einrichtungen und anderer Einflussquellen; sekundaer Stadtbesitz und Domaenen, Circel/Collegien und Handelsunternehmungen. Ziel: vielseitig und stabil, darf in einzelnen Runden schwanken.',
    strategyCard: {
      title: 'Amtsfokus',
      risk: 'aggressive',
      primary: [
        'Aemter sammeln (klein -> mittel -> gross), wenn bezahlbar',
        'Einrichtungen an Aemtern priorisieren (Einfluss-RoI)',
        'Einflussquellen ausbauen (Aemter/Orgs/Familienposten)',
      ],
      secondary: [
        'Staedtischer Besitz und Domaenen fuer Basisressourcen',
        'Geldgewinnaktionen zur Finanzierung',
        'Organisationen (Kult/Collegium), wenn moeglich',
        'Handelsunternehmungen, wenn Gold uebrig',
        'Lager/Werkstaetten bei Ueberschuss',
      ],
      guardrails: [
        'Goldreserve >= 6',
        'Mindestens jede 2. Runde Einfluss- oder Amtsaktion, falls moeglich',
        'Temp. Einfluss priorisieren, wenn dadurch dieses Runde ein Posten erwerbbar wird',
        'Aemter nicht erzwingen, wenn Cap erreicht oder Ressourcen fehlen',
        'Nicht reines Marktspiel, wenn Amtskauf moeglich ist',
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
      'Du spielst eine handels- und geldgewinnorientierte Strategie: schneller Geldgewinn durch Geldverleih und Markt-Timing (Einkauf/Verkauf + Lager). Sehr risiko- und schwankungsstark. Sekundaer Handelsunternehmungen/Collegien und Stadtbesitz, tertiaer Werkstaetten/Domaenen.',
    strategyCard: {
      title: 'Handel & Geld',
      risk: 'aggressive',
      primary: [
        'Geldverleih (MoneyLend) priorisieren',
        'Markt-Timing: Kaufen bei gutem Mod, verkaufen bei hohem Mod',
        'Lager fuer Timing und Puffer nutzen',
        'Handelsunternehmungen erwerben/ausbauen',
      ],
      secondary: [
        'Handelscollegium fuer DC/Bonusaktionen',
        'Staedtischer Besitz fuer Goldbasis',
        'Werkstaetten/Domaenen nur wenn klarer RoI',
      ],
      guardrails: [
        'Goldreserve >= 2 (risikofreudig)',
        'Wenn Markt schlecht und Lager vorhanden: nicht verkaufen',
        'Akzeptiere Volatilitaet, priorisiere Chancen',
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
      'Du spielst eine stadtorientierte/unterwelt-Strategie: Fokus auf Unterweltcircel, Spionageringe, deren Einrichtungen, Klienten und Stadtbesitz. Danach Aemter, Geldgewinn, Werkstaetten/Lager und weitere Orgs/Collegien. Ziel: aehnlich stark wie Amtsfokus, aber volatiler.',
    strategyCard: {
      title: 'Stadt & Unterwelt',
      risk: 'aggressive',
      primary: [
        'Unterwelt-Organisation aufbauen (small -> medium -> large)',
        'Spionage-Organisation aufbauen/ausbauen',
        'Anhaenger/Klienten der Unterwelt priorisieren',
        'Staedtischen Besitz als HQ/Einflussbasis ausbauen',
      ],
      secondary: [
        'Einflussgewinn fuer Orga- und Anhaenger-Kosten',
        'Aemter und Geldgewinn nach Unterwelt medium',
        'Werkstaetten/Lager fuer Markt-Timing, wenn sinnvoll',
      ],
      avoid: [
        'Aemter vor Unterwelt medium',
        'Handelsunternehmungen vor Unterwelt medium',
        'Werkstaetten vor Unterwelt medium',
      ],
      guardrails: [
        'Goldreserve >= 6',
        'HQ-Anforderung fuer Orga beachten',
        'Wenn keine Unterwelt/Spionage-Org: AcquireOrganization priorisieren',
        'Unterwelt-Follower nachziehen, wenn Kapazitaet frei',
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
      'Du spielst eine werkstattfokussierte Strategie: Fokus Werkstaetten, deren Spezialisierung/Einrichtungen und Stadtbesitz. Sekundaer Circel/Collegien, Klienten/Paechter, Handelsunternehmungen und Domaenen. Tertiaer Markt-Timing.',
    strategyCard: {
      title: 'Werkstattfokus',
      risk: 'conservative',
      primary: [
        'Werkstaetten aufbauen/ausbauen',
        'Werkstaetten spezialisieren + Einrichtungen bauen',
        'Staedtischer Besitz fuer Produktionskapazitaet',
        'RM/SM puffern (Lager)',
      ],
      secondary: [
        'Handwerkscollegium/Orgs, wenn moeglich',
        'Paechter/Klienten, wenn moeglich (AK-Basis)',
        'Handelsunternehmungen/Domaenen, wenn sinnvoll',
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
      'Du spielst eine domaenenfokussierte Strategie: Fokus Domaenenerwerb, deren Einrichtungen und Ausbau sowie Domaenenverwaltung. Sekundaer Werkstaetten, Lager und Aemter wo sinnvoll. Ziel: stabil, langsam, langfristig stark.',
    strategyCard: {
      title: 'Domaenenfokus',
      risk: 'conservative',
      primary: [
        'Domaenen erwerben (small -> medium -> large)',
        'Domaenenverwaltung priorisieren',
        'Domaenen ausbauen + Einrichtungen',
        'Rohstoffe halten, wenn Markt schlecht',
      ],
      secondary: [
        'Werkstaetten/Lager, wenn sinnvoll',
        'Aemter als Nebenpfad, wenn bezahlbar',
        'Handel nur opportunistisch',
      ],
      guardrails: [
        'Goldreserve >= 6',
        'Wenn Inventar voll: MoneySell priorisieren',
        'Nicht in Stadt/Orga investieren, bevor grosse Domaene erreichbar ist',
      ],
    },
  },
];

const SOFT_GUARDRAILS: Record<string, string[]> = {
  Amtsfokus: [
    'Gold >= (Upkeep naechste Runde + 2) behalten',
    'Einfluss nur pushen, wenn in 1-2 Runden ein Amt geplant ist (temp reicht)',
    'Aemter nur, wenn Cap frei und Finanzierung realistisch',
    'Wenn Verkauf/Material klar besser, darf Einflusszug entfallen',
  ],
  'Handel & Geld': [
    'Gold >= (Upkeep naechste Runde + 2) behalten',
    'Wenn Markt schlecht und Lager vorhanden: nur verkaufen, wenn Gold < upkeep+2',
    'Nicht alles Gold binden, wenn bald Trade/Storage geplant',
  ],
  'Stadt & Unterwelt': [
    'Gold >= (Upkeep naechste Runde + 2) behalten',
    'Orga braucht HQ: erst Stadtbesitz sichern',
    'Domaenen nur, wenn Stadt/Orga nicht stockt',
  ],
  Werkstattfokus: [
    'Gold >= (Upkeep naechste Runde + 2) behalten',
    'Werkstatt-Input sichern: nicht unter 4 RM fuer Kern-Input fallen',
    'AK nicht unter 1 druecken',
  ],
  Domaenenfokus: [
    'Gold >= (Upkeep naechste Runde + 2) behalten',
    'Wenn Lager voll oder Markt gut: verkaufen; sonst RM halten',
    'Nicht in Stadt/Orga investieren, bevor grosse Domaene realistisch',
  ],
};

const TUNED_GUARDRAILS: Record<string, string[]> = {
  Amtsfokus: [
    'Gold >= (Upkeep naechste Runde + 4) behalten',
    'Wenn ein Amt bezahlbar + Cap frei: Amt priorisieren',
    'Temp-Einfluss nur, wenn Amtkauf in 1-2 Runden geplant ist',
    'Kein RM-Grind, wenn Amt oder Einflusskauf sinnvoll ist',
  ],
  'Handel & Geld': [
    'Gold >= (Upkeep naechste Runde + 2) behalten',
    'Wenn Markt schlecht und Lager vorhanden: nicht verkaufen',
    'Wenn Lager leer: Materialgewinn/Kauf priorisieren',
  ],
  'Stadt & Unterwelt': [
    'Gold >= (Upkeep naechste Runde + 4) behalten',
    'HQ/Staedtischer Besitz vor Orga sicherstellen',
    'Wenn Orga bezahlbar + HQ da: Orga priorisieren',
    'Domänen erst nach mind. 2 Stadtbesitz oder 1 Orga',
  ],
  Werkstattfokus: [
    'Gold >= (Upkeep naechste Runde + 1) behalten',
    'Werkstatt-Input sichern: mind. 4 RM fuer Kern-Input',
    'AK nicht unter 1 druecken',
  ],
  Domaenenfokus: [
    'Gold >= (Upkeep naechste Runde + 1) behalten',
    'Domänenausbau/Erwerb priorisieren, wenn bezahlbar',
    'Verkauf nur, wenn Lager voll oder Markt gut',
  ],
};

function applyGuardrails(
  players: PlayerProfile[],
  mode: 'none' | 'soft' | 'tuned'
): PlayerProfile[] {
  return players.map((profile) => {
    if (!profile.strategyCard) return { ...profile };
    const guardrails =
      mode === 'none'
        ? []
        : mode === 'tuned'
          ? (TUNED_GUARDRAILS[profile.strategyCard.title] ??
            profile.strategyCard.guardrails ??
            [])
          : (SOFT_GUARDRAILS[profile.strategyCard.title] ??
            profile.strategyCard.guardrails ??
            []);
    return {
      ...profile,
      strategyCard: {
        ...profile.strategyCard,
        guardrails: [...guardrails],
      },
    };
  });
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
    players: CORE_STRATEGY_PLAYERS,
  },
  {
    name: 'core-v1-strategies-no-guardrails',
    players: applyGuardrails(CORE_STRATEGY_PLAYERS, 'none'),
  },
  {
    name: 'core-v1-strategies-soft-guardrails',
    players: applyGuardrails(CORE_STRATEGY_PLAYERS, 'soft'),
  },
  {
    name: 'core-v1-strategies-tuned-guardrails',
    players: applyGuardrails(CORE_STRATEGY_PLAYERS, 'tuned'),
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
