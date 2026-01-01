import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

type CliArgs = {
  scenario: string;
  rounds: number[];
  runs: number;
  seed: number;
  model: string | null;
  outDir: string;
  md: boolean;
  force: boolean;
  quiet: boolean;
  help: boolean;
};

function usage(): string {
  return [
    'LLM Batch Runner (Myranor Aufbausystem)',
    '',
    'Usage:',
    '  bun src/playtest/llmBatch.ts [options]',
    '',
    'Options:',
    '  --scenario <name>   Szenario-Name (default: core-v1-strategies)',
    '  --rounds <n>        Runden pro Partie (repeatable, default: 20)',
    '  --runs <n>          Anzahl Seeds pro Rundenwert (default: 5)',
    '  --seed <n>          Start-Seed (default: 1000)',
    '  --model <id>        Model-ID überschreiben (optional)',
    '  --out-dir <dir>     Output-Ordner (default: reports/llm-batch)',
    '  --md               Pro Seed auch Markdown schreiben',
    '  --force            Vorhandene Reports überschreiben',
    '  --quiet            Unterdrückt per-run stdout (setzt --quiet an llm.ts)',
    '  --help             Hilfe anzeigen',
    '',
    'Example:',
    '  bun src/playtest/llmBatch.ts --scenario core-v1-strategies --rounds 20 --runs 5 --seed 500 --md',
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
    scenario: 'core-v1-strategies',
    rounds: [],
    runs: 5,
    seed: 1000,
    model: null,
    outDir: 'reports/llm-batch',
    md: false,
    force: false,
    quiet: true,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;

    const [flag, inline] =
      token.startsWith('--') && token.includes('=')
        ? token.split('=', 2)
        : [token, undefined];

    switch (flag) {
      case '--scenario':
        args.scenario = inline ?? argv[++i] ?? args.scenario;
        break;
      case '--rounds':
        args.rounds.push(parseIntArg(inline ?? argv[++i], '--rounds'));
        break;
      case '--runs':
        args.runs = parseIntArg(inline ?? argv[++i], '--runs');
        break;
      case '--seed':
        args.seed = parseIntArg(inline ?? argv[++i], '--seed');
        break;
      case '--model':
        args.model = inline ?? argv[++i] ?? null;
        break;
      case '--out-dir':
        args.outDir = inline ?? argv[++i] ?? args.outDir;
        break;
      case '--md':
        args.md = true;
        break;
      case '--force':
        args.force = true;
        break;
      case '--quiet':
        args.quiet = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        if (flag.startsWith('--')) throw new Error(`Unknown flag: ${flag}`);
        break;
    }
  }

  if (args.rounds.length === 0) args.rounds = [20];
  args.rounds = [...new Set(args.rounds)].sort((a, b) => a - b);

  return args;
}

async function fileExists(path: string): Promise<boolean> {
  const f = Bun.file(path);
  return await f.exists();
}

async function runOne(options: {
  scenario: string;
  rounds: number;
  seed: number;
  outJson: string;
  outMd: string | null;
  model: string | null;
  quiet: boolean;
}): Promise<{ ok: true } | { ok: false; exitCode: number }> {
  const cmd: string[] = [
    'bun',
    '--env-file',
    '.env',
    'src/playtest/llm.ts',
    '--rounds',
    String(options.rounds),
    '--seed',
    String(options.seed),
    '--scenario',
    options.scenario,
    '--out',
    options.outJson,
    '--pretty',
  ];

  if (options.outMd) {
    cmd.push('--md-out', options.outMd);
  }
  if (options.model) {
    cmd.push('--model', options.model);
  }
  if (options.quiet) {
    cmd.push('--quiet');
  }

  const proc = Bun.spawn({
    cmd,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await proc.exited;
  return exitCode === 0 ? { ok: true } : { ok: false, exitCode };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exitCode = 0;
    return;
  }

  let anyFailure = false;
  const runsTotal = args.rounds.length * args.runs;
  let runIndex = 0;

  for (const rounds of args.rounds) {
    const dir = join(args.outDir, args.scenario, `${rounds}r`);
    await mkdir(dir, { recursive: true });

    for (let i = 0; i < args.runs; i += 1) {
      const seed = args.seed + i;
      runIndex += 1;

      const outJson = join(dir, `seed${seed}.json`);
      const outMd = args.md ? join(dir, `seed${seed}.md`) : null;

      if (!args.force) {
        const existsJson = await fileExists(outJson);
        const existsMd = outMd ? await fileExists(outMd) : true;
        if (existsJson && existsMd) {
          console.log(
            `[${runIndex}/${runsTotal}] skip (exists): rounds=${rounds} seed=${seed}`
          );
          continue;
        }
      }

      console.log(`[${runIndex}/${runsTotal}] run: rounds=${rounds} seed=${seed}`);
      const res = await runOne({
        scenario: args.scenario,
        rounds,
        seed,
        outJson,
        outMd,
        model: args.model,
        quiet: args.quiet,
      });
      if (res.ok === false) {
        anyFailure = true;
        console.log(
          `[${runIndex}/${runsTotal}] FAIL: rounds=${rounds} seed=${seed} exit=${res.exitCode}`
        );
      }
    }
  }

  if (anyFailure) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.log('');
  console.log(usage());
  process.exitCode = 1;
});
