import {
  DEFAULT_CAMPAIGN_RULES,
  RULES_VERSION,
  baseInfluencePerRound,
  baseLaborTotal,
  cityGoldPerRound,
  cityInfluencePerRound,
  cityLaborPerRound,
  domainGoldUpkeep,
  domainLaborPerRound,
  domainRawPerRound,
  officesIncomePerRound,
  startingPlayerChecks,
  startingPlayerEconomy,
  startingPlayerHoldings,
  startingPlayerTurn,
  storageCapacity,
  storageUpkeep,
  workshopCapacity,
  workshopUpkeep,
} from '../core/rules/v1';

type CliArgs = {
  report: string | null;
  out: string | null;
  pretty: boolean;
  help: boolean;
};

function usage(): string {
  return [
    'Playtest Prompt Generator (Myranor Aufbausystem, v1)',
    '',
    'Usage:',
    '  bun src/playtest/analyzePrompt.ts --report <file> [--out <file>] [--pretty]',
    '',
    'Options:',
    '  --report <file>  Playtest-Report JSON (von `bun run playtest --out ...`)',
    '  --out <file>     Prompt in Datei schreiben (zusätzlich zu stdout)',
    '  --pretty         JSON-Blöcke schön formatieren (Indent=2)',
    '  --help           Hilfe anzeigen',
    '',
    'Example:',
    '  bun src/playtest/index.ts --runs 500 --rounds 20 --seed 42 --scenario core-v1-strategies --out playtest.json',
    '  bun src/playtest/analyzePrompt.ts --report playtest.json --out analysis-prompt.md',
  ].join('\n');
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { report: null, out: null, pretty: false, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;

    const [flag, inline] =
      token.startsWith('--') && token.includes('=')
        ? token.split('=', 2)
        : [token, undefined];

    switch (flag) {
      case '--report':
        args.report = inline ?? argv[++i] ?? null;
        break;
      case '--out':
        args.out = inline ?? argv[++i] ?? null;
        break;
      case '--pretty':
        args.pretty = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        if (flag.startsWith('--')) {
          throw new Error(`Unknown flag: ${flag}`);
        }
        break;
    }
  }

  return args;
}

function jsonBlock(value: unknown, pretty: boolean): string {
  const json = JSON.stringify(value, null, pretty ? 2 : 0);
  return ['```json', json, '```'].join('\n');
}

function rulesSnapshot(): unknown {
  const holdings = startingPlayerHoldings();
  const checks = startingPlayerChecks();
  const economy = startingPlayerEconomy();
  const turn = startingPlayerTurn(holdings, DEFAULT_CAMPAIGN_RULES);

  return {
    rulesVersion: RULES_VERSION,
    campaignRules: DEFAULT_CAMPAIGN_RULES,
    starting: {
      checks,
      economy,
      holdings,
      turn,
      baseLaborTotal: baseLaborTotal(holdings),
      baseInfluencePerRound: baseInfluencePerRound(holdings),
    },
    posts: {
      domain: {
        starter: { upkeepGold: domainGoldUpkeep('starter'), labor: domainLaborPerRound('starter'), raw: domainRawPerRound('starter') },
        small: { upkeepGold: domainGoldUpkeep('small'), labor: domainLaborPerRound('small'), raw: domainRawPerRound('small') },
        medium: { upkeepGold: domainGoldUpkeep('medium'), labor: domainLaborPerRound('medium'), raw: domainRawPerRound('medium') },
        large: { upkeepGold: domainGoldUpkeep('large'), labor: domainLaborPerRound('large'), raw: domainRawPerRound('large') },
      },
      cityPropertyLeased: {
        small: { labor: cityLaborPerRound('small', 'leased'), influence: cityInfluencePerRound('small', 'leased'), gold: cityGoldPerRound('small', 'leased') },
        medium: { labor: cityLaborPerRound('medium', 'leased'), influence: cityInfluencePerRound('medium', 'leased'), gold: cityGoldPerRound('medium', 'leased') },
        large: { labor: cityLaborPerRound('large', 'leased'), influence: cityInfluencePerRound('large', 'leased'), gold: cityGoldPerRound('large', 'leased') },
      },
      office: {
        smallInfluence: officesIncomePerRound('small', 'influence', DEFAULT_CAMPAIGN_RULES),
        smallGold: officesIncomePerRound('small', 'gold', DEFAULT_CAMPAIGN_RULES),
        smallSplit: officesIncomePerRound('small', 'split', DEFAULT_CAMPAIGN_RULES),
      },
      workshop: {
        small: { upkeep: workshopUpkeep('small'), cap: workshopCapacity('small') },
        medium: { upkeep: workshopUpkeep('medium'), cap: workshopCapacity('medium') },
        large: { upkeep: workshopUpkeep('large'), cap: workshopCapacity('large') },
      },
      storage: {
        small: { upkeep: storageUpkeep('small'), cap: storageCapacity('small', DEFAULT_CAMPAIGN_RULES) },
        medium: { upkeep: storageUpkeep('medium'), cap: storageCapacity('medium', DEFAULT_CAMPAIGN_RULES) },
        large: { upkeep: storageUpkeep('large'), cap: storageCapacity('large', DEFAULT_CAMPAIGN_RULES) },
      },
    },
    notes: {
      market: 'Pro Runde werden Märkte gerollt (lokal + je Handelsunternehmung eigene Märkte). Geldgewinn: Verkauf/Kauf nutzt Markt-Modifikatoren pro Materialgruppe.',
      events: 'Pro Abschnitt (5 Runden) werden 2 Ereignisse gerollt und im State gespeichert. Viele Effekte wirken als Modifikatoren auf Upkeep/Ertrag/DC oder als Nebeneffekte (LO, Schaden, etc.).',
      visibility: 'Engine-Events haben public/private visibility; Playtest nutzt volle private Events.',
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(usage());
    process.exitCode = 0;
    return;
  }

  if (!args.report) {
    throw new Error('Missing --report <file>');
  }

  const raw = await Bun.file(args.report).text();
  const report = JSON.parse(raw) as any;

  const subset = {
    generatedAt: report.generatedAt,
    config: report.config,
    scenario: report.scenario,
    outcomes: report.outcomes,
    systems: report.systems,
  };

  const prompt = [
    '# System Prompt (Analyse)',
    '',
    'Du bist ein **Spieldesign-Analyst** für ein rundenbasiertes Aufbau-/Wirtschaftssystem.',
    'Sprache: **Deutsch**. Sei kritisch, präzise und schlage konkrete Zahlenänderungen vor.',
    '',
    '## Ziel',
    '- Finde übermäßig starke/schwache Aktionen/Strategien/Posten (relativ zueinander).',
    '- Prüfe, ob Markt + Zufallsereignisse tatsächlich relevante Entscheidungen erzeugen.',
    '- Gib Vorschläge für nächste Playtests (Hypothesen, Experimente, Metriken).',
    '',
    '## Kontext & Annahmen',
    '- D&D 5e Level-3 Baseline: Checks typischerweise +5.',
    '- Simulation ist deterministisch + RNG; kein Rollenspiel, nur Ökonomie/Actions.',
    '',
    '## Regelsystem-Snapshot (Engine v1)',
    jsonBlock(rulesSnapshot(), args.pretty),
    '',
    '## Playtest-Report (aggregiert)',
    jsonBlock(subset, args.pretty),
    '',
    '## Analyse-Aufgaben (bitte in dieser Struktur antworten)',
    '1) **Meta/Balance**: Wer dominiert? Warum? Welche Metriken belegen das (winRate, finalGold, actions, sell/conversion)?',
    '2) **Aktionen**: Welche Aktionen haben bestes Risiko/Ertrag? Wo sind DCs zu hoch/niedrig? Gibt es “no-brainer” Züge?',
    '3) **Lager/Werkstatt**: Lohnt sich Lager? Wenn nicht: wieso (Upkeep, Opportunity Cost, Market-Varianz)?',
    '4) **Markt**: Sind die Markt-Modifikatoren zu swingy? Beeinflussen sie Verhalten (market-aware Agenten)?',
    '5) **Zufallsereignisse**: Welche Ereignisse verzerren Balancing (Steuern, DC, Multiplikatoren, Upkeep)?',
    '6) **Konkrete Patches**: Gib 5–10 konkrete Balance-Änderungen (Zahlen), jeweils mit erwarteter Wirkung.',
    '7) **Nächster Testplan**: 3–5 Experimente (Seeds, Parameter-Sweeps, neue Personas/Heuristiken, längere Runs).',
  ].join('\n');

  if (args.out) {
    await Bun.write(args.out, prompt);
  }

  console.log(prompt);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.log('');
  console.log(usage());
  process.exitCode = 1;
});

