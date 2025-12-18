import {
  RULES_VERSION,
  baseInfluencePerRound,
  baseLaborTotal,
  domainGoldUpkeep,
  domainRawMaterialsPerRound,
  officesGoldIncomePerRound,
  roundGoldIncome,
  startingPlayerChecks,
  startingPlayerEconomy,
  startingPlayerInfrastructure,
  storageCapacity,
  storageUpkeep,
  workforceRawMaterialsUpkeep,
  workshopCapacity,
  workshopUpkeep,
} from '../core/rules/v0';

type CliArgs = {
  report: string | null;
  out: string | null;
  pretty: boolean;
  help: boolean;
};

function usage(): string {
  return [
    'Playtest Prompt Generator (Myranor Aufbausystem)',
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
    '  bun src/playtest/index.ts --runs 500 --rounds 20 --seed 42 --scenario core-v0-marketaware --out playtest.json',
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
  const infra = startingPlayerInfrastructure();
  const checks = startingPlayerChecks();
  const economy = startingPlayerEconomy();

  return {
    rulesVersion: RULES_VERSION,
    starting: {
      checks,
      economy,
      infrastructure: infra,
      baseLaborTotal: baseLaborTotal(infra),
      baseInfluencePerRound: baseInfluencePerRound(),
      roundGoldIncome: roundGoldIncome(infra),
      roundRawMaterialsIncome: domainRawMaterialsPerRound(infra.domainTier),
      workforceRawMaterialsUpkeep: workforceRawMaterialsUpkeep(baseLaborTotal(infra)),
    },
    domain: {
      starter: { upkeepGold: domainGoldUpkeep('starter'), rmPerRound: domainRawMaterialsPerRound('starter') },
      small: { upkeepGold: domainGoldUpkeep('small'), rmPerRound: domainRawMaterialsPerRound('small') },
      medium: { upkeepGold: domainGoldUpkeep('medium'), rmPerRound: domainRawMaterialsPerRound('medium') },
      large: { upkeepGold: domainGoldUpkeep('large'), rmPerRound: domainRawMaterialsPerRound('large') },
    },
    workshop: {
      none: { upkeep: workshopUpkeep('none'), cap: workshopCapacity('none') },
      small: { upkeep: workshopUpkeep('small'), cap: workshopCapacity('small') },
      medium: { upkeep: workshopUpkeep('medium'), cap: workshopCapacity('medium') },
      large: { upkeep: workshopUpkeep('large'), cap: workshopCapacity('large') },
    },
    storage: {
      none: { upkeep: storageUpkeep('none'), cap: storageCapacity('none') },
      small: { upkeep: storageUpkeep('small'), cap: storageCapacity('small') },
      medium: { upkeep: storageUpkeep('medium'), cap: storageCapacity('medium') },
      large: { upkeep: storageUpkeep('large'), cap: storageCapacity('large') },
    },
    offices: {
      goldPerOfficePerRound: officesGoldIncomePerRound(1),
    },
    simplifications: {
      market: 'Market roll exists (raw+special). Engine sell uses basic-tier modifier only (no typed materials yet).',
      events: '2 events per 5 rounds. Effects parsed via regex into a limited modifier set (taxes, DC shifts, upkeep shifts, conversion ratio, payouts).',
      storage: 'When maintained, stored materials are kept (not auto-converted).',
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
    '- Finde übermäßig starke/schwache Aktionen/Strategien/Einrichtungen (relativ zueinander).',
    '- Prüfe, ob Markt + Zufallsereignisse tatsächlich relevante Entscheidungen erzeugen.',
    '- Gib Vorschläge für nächste Playtests (Hypothesen, Experimente, Metriken).',
    '',
    '## Kontext & Annahmen',
    '- D&D 5e Level-3 Baseline: Checks typischerweise +5.',
    '- Simulation ist deterministisch + RNG; kein Rollenspiel, nur Ökonomie/Actions.',
    '',
    '## Regelsystem-Snapshot (Engine v0)',
    jsonBlock(rulesSnapshot(), args.pretty),
    '',
    '## Playtest-Report (aggregiert)',
    jsonBlock(subset, args.pretty),
    '',
    '## Analyse-Aufgaben (bitte in dieser Struktur antworten)',
    '1) **Meta/Balance**: Wer dominiert? Warum? Welche Metriken belegen das (winRate, finalGold, actions, sell/conversion)?',
    '2) **Aktionen**: Welche Aktionen haben bestes Risiko/Ertrag? Wo sind DCs zu hoch/niedrig? Gibt es “no-brainer” Züge?',
    '3) **Lager/Werkstatt**: Lohnt sich Lager? Wenn nicht: wieso (Upkeep, Opportunity Cost, Action-Cap, Market-Varianz)?',
    '4) **Markt**: Sind die Markt-Modifikatoren zu swingy? Beeinflussen sie Verhalten (market-aware Agenten)?',
    '5) **Zufallsereignisse**: Welche Modifiers treten häufig auf und verzerren Balancing (Steuern, DC, Multiplikatoren)?',
    '6) **Konkrete Patches**: Gib 5–10 konkrete Balance-Änderungen (Zahlen), jeweils mit erwarteter Wirkung.',
    '7) **Nächster Testplan**: 3–5 Experimente (z.B. mehr Runs, andere Seeds, neue Personas, Parameter-Sweeps).',
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

