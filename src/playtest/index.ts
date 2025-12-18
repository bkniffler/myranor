import { runPlaytest } from './runner';
import { getScenario, listScenarioNames } from './scenarios';
import { formatPlaytestMarkdown } from './format';

type CliArgs = {
  runs: number;
  rounds: number;
  seed: number;
  scenario: string;
  out: string | null;
  mdOut: string | null;
  json: boolean;
  pretty: boolean;
  listScenarios: boolean;
  help: boolean;
};

function usage(): string {
  return [
    'Playtest Runner (Myranor Aufbausystem)',
    '',
    'Usage:',
    '  bun src/playtest/index.ts [options]',
    '',
    'Options:',
    '  --runs <n>         Anzahl Simulationen (default: 200)',
    '  --rounds <n>       Runden pro Simulation (default: 20)',
    '  --seed <n>         Start-Seed (default: 1)',
    '  --scenario <name>  Szenario-Name (default: core-v1-all5)',
    '  --out <file>       Report als JSON schreiben',
    '  --md-out <file>    Report als Markdown schreiben',
    '  --json             Report als JSON nach stdout',
    '  --pretty           JSON pretty-print (Indent=2)',
    '  --list-scenarios   Szenarien auflisten',
    '  --help             Hilfe anzeigen',
    '',
    'Examples:',
    '  bun src/playtest/index.ts --runs 500 --rounds 30 --seed 42 --scenario core-v1-specialists --out playtest.json',
    '  bun src/playtest/index.ts --json --pretty',
  ].join('\n');
}

function parseIntArg(value: string | undefined, name: string): number {
  if (!value) throw new Error(`Missing value for ${name}`);
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${name}: ${value}`);
  return parsed;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    runs: 200,
    rounds: 20,
    seed: 1,
    scenario: 'core-v1-all5',
    out: null,
    mdOut: null,
    json: false,
    pretty: false,
    listScenarios: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;

    const [flag, inline] = token.startsWith('--') && token.includes('=')
      ? token.split('=', 2)
      : [token, undefined];

    switch (flag) {
      case '--runs':
        args.runs = parseIntArg(inline ?? argv[++i], '--runs');
        break;
      case '--rounds':
        args.rounds = parseIntArg(inline ?? argv[++i], '--rounds');
        break;
      case '--seed':
        args.seed = parseIntArg(inline ?? argv[++i], '--seed');
        break;
      case '--scenario':
        args.scenario = inline ?? argv[++i] ?? args.scenario;
        break;
      case '--out':
        args.out = inline ?? argv[++i] ?? null;
        break;
      case '--md-out':
        args.mdOut = inline ?? argv[++i] ?? null;
        break;
      case '--json':
        args.json = true;
        break;
      case '--pretty':
        args.pretty = true;
        break;
      case '--list-scenarios':
        args.listScenarios = true;
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

function fmt(n: number, digits = 2): string {
  return n.toFixed(digits);
}

function printSummary(report: ReturnType<typeof runPlaytest>): void {
  console.log(
    `Playtest "${report.scenario.name}" — ${report.config.runs} Runs, ${report.config.rounds} Runden, Seed ${report.config.seed}`,
  );
  console.log(
    `Gini (Final-Gold): mean=${fmt(report.outcomes.giniGold.mean, 3)} p50=${fmt(report.outcomes.giniGold.p50, 3)} p90=${fmt(report.outcomes.giniGold.p90, 3)}`,
  );

  const agents = Object.entries(report.outcomes.byAgent);
  for (const [agentId, a] of agents) {
    console.log(
      `- ${agentId}: gold mean=${fmt(a.finalGold.mean)} p10=${fmt(a.finalGold.p10)} p50=${fmt(a.finalGold.p50)} p90=${fmt(a.finalGold.p90)} | winRate=${fmt(a.winRate, 3)} | idle=${fmt(a.idleActionRate, 3)} | officesGold/round mean=${fmt(a.finalOfficesGoldPerRound.mean)} p50=${fmt(a.finalOfficesGoldPerRound.p50)}`,
    );
    console.log(
      `  firstOffice: mean=${fmt(a.milestones.firstOfficeRound.mean)} p50=${fmt(a.milestones.firstOfficeRound.p50)} never=${fmt(a.milestones.firstOfficeRound.neverRate, 3)} | domainUpg: mean=${fmt(a.milestones.firstDomainUpgradeRound.mean)} p50=${fmt(a.milestones.firstDomainUpgradeRound.p50)} never=${fmt(a.milestones.firstDomainUpgradeRound.neverRate, 3)}`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(usage());
    process.exitCode = 0;
    return;
  }

  if (args.listScenarios) {
    for (const name of listScenarioNames()) console.log(name);
    return;
  }

  const scenario = getScenario(args.scenario);
  if (!scenario) {
    throw new Error(
      `Unknown scenario "${args.scenario}". Available: ${listScenarioNames().join(', ')}`,
    );
  }

  const report = runPlaytest(
    { runs: args.runs, rounds: args.rounds, seed: args.seed },
    scenario.name,
    scenario.players,
  );

  if (args.out) {
    const json = JSON.stringify(report, null, args.pretty ? 2 : 0);
    await Bun.write(args.out, json);
  }

  if (args.mdOut) {
    const md = formatPlaytestMarkdown(report);
    await Bun.write(args.mdOut, md);
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, args.pretty ? 2 : 0));
    return;
  }

  printSummary(report);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.log('');
  console.log(usage());
  process.exitCode = 1;
});
