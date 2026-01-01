import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { mean, percentile } from './stats';

type LedgerTotals = { total: number; byType: Record<string, number> };

type NetWorthBreakdown = {
  inventoryGoldEq: number;
  assetsGoldEq: number;
  influence: number;
  permanentInfluence: number;
};

type PlayerLedger = {
  goldGained: LedgerTotals;
  goldSpent: LedgerTotals;
  goldLost: LedgerTotals;
  influenceGained: LedgerTotals;
  influenceSpent: LedgerTotals;
  laborSpent: LedgerTotals;
};

type LlmPlayReport = {
  generatedAt: string;
  config: { rounds: number; seed: number; scenario: string; model: string | null };
  players: Array<{ playerId: string; displayName: string; strategyTitle?: string }>;
  steps: Array<{
    round: number;
    playerId: string;
    playerName: string;
    kind: 'facility' | 'action';
    command: { type: string; [k: string]: unknown };
    ok: boolean;
    outcome?: { actionKey: string; tier: string };
  }>;
  final: {
    byPlayer: Array<{
      playerId: string;
      displayName: string;
      gold: number;
      scoreTotal: number;
      scoreBase: number;
      scoreEarnedInfluenceGoldEq: number;
      scoreBreakdown: NetWorthBreakdown;
      ledger: PlayerLedger;
      holdings: {
        domains: unknown[];
        cityProperties: Array<{ mode: string }>;
        offices: Array<{ yieldMode: string }>;
        organizations: Array<{ kind: string; tier: string }>;
        tradeEnterprises: Array<{ mode: string; tier: string }>;
        workshops: unknown[];
        storages: unknown[];
      };
    }>;
  };
};

type SummaryStats = { mean: number; p10: number; p50: number; p90: number };

function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(digits);
}

function stats(values: number[]): SummaryStats {
  return {
    mean: mean(values),
    p10: percentile(values, 0.1),
    p50: percentile(values, 0.5),
    p90: percentile(values, 0.9),
  };
}

function mdTable(headers: string[], rows: string[][]): string {
  const escape = (v: string) => v.replace(/\|/g, '\\|');
  const out: string[] = [];
  out.push(`| ${headers.map(escape).join(' | ')} |`);
  out.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const row of rows) out.push(`| ${row.map(escape).join(' | ')} |`);
  return out.join('\n');
}

async function readReport(path: string): Promise<LlmPlayReport> {
  const text = await Bun.file(path).text();
  return JSON.parse(text) as LlmPlayReport;
}

async function collectJsonFiles(path: string): Promise<string[]> {
  try {
    const s = await stat(path);
    if (s.isFile()) {
      return path.toLowerCase().endsWith('.json') ? [path] : [];
    }
    if (!s.isDirectory()) return [];

    // Directory: list direct children and recurse 1 level for convenience.
    // (We keep it simple; batch runner already organizes by <scenario>/<rounds>r.)
    const entries = await readdir(path, { withFileTypes: true });
    const out: string[] = [];
    for (const e of entries) {
      const p = join(path, e.name);
      if (e.isFile() && e.name.toLowerCase().endsWith('.json')) out.push(p);
      if (e.isDirectory()) {
        const nested = await readdir(p, { withFileTypes: true });
        for (const n of nested) {
          if (n.isFile() && n.name.toLowerCase().endsWith('.json'))
            out.push(join(p, n.name));
        }
      }
    }
    return out.sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

type StrategyAgg = {
  name: string;
  runs: number;
  winShare: number;
  score: number[];
  baseScore: number[];
  earnedInfluenceGoldEq: number[];
  gold: number[];
  inventoryGoldEq: number[];
  assetsGoldEq: number[];
  influence: number[];
  permInfluence: number[];
  holdings: {
    domains: number[];
    cities: number[];
    offices: number[];
    orgs: number[];
    trade: number[];
    workshops: number[];
    storages: number[];
  };
  cityModes: Record<string, number>;
  officeYieldModes: Record<string, number>;
  orgKinds: Record<string, number>;
  actionCounts: Record<string, number>;
  facilityCounts: Record<string, number>;
  outcomeTiers: Record<string, number>;
  goldGainedTotal: number;
  goldSpentTotal: number;
  influenceGainedTotal: number;
  influenceSpentTotal: number;
  goldGainedByType: Record<string, number>;
  goldSpentByType: Record<string, number>;
  influenceGainedByType: Record<string, number>;
  influenceSpentByType: Record<string, number>;
};

function emptyAgg(name: string): StrategyAgg {
  return {
    name,
    runs: 0,
    winShare: 0,
    score: [],
    baseScore: [],
    earnedInfluenceGoldEq: [],
    gold: [],
    inventoryGoldEq: [],
    assetsGoldEq: [],
    influence: [],
    permInfluence: [],
    holdings: {
      domains: [],
      cities: [],
      offices: [],
      orgs: [],
      trade: [],
      workshops: [],
      storages: [],
    },
    cityModes: {},
    officeYieldModes: {},
    orgKinds: {},
    actionCounts: {},
    facilityCounts: {},
    outcomeTiers: {},
    goldGainedTotal: 0,
    goldSpentTotal: 0,
    influenceGainedTotal: 0,
    influenceSpentTotal: 0,
    goldGainedByType: {},
    goldSpentByType: {},
    influenceGainedByType: {},
    influenceSpentByType: {},
  };
}

function addTotalsByType(
  target: Record<string, number>,
  totals: LedgerTotals
): void {
  for (const [k, v] of Object.entries(totals.byType ?? {})) {
    target[k] = (target[k] ?? 0) + (v ?? 0);
  }
}

function addCounts(
  target: Record<string, number>,
  key: string,
  delta = 1
): void {
  target[key] = (target[key] ?? 0) + delta;
}

function percent(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}

function sectionForRounds(reports: LlmPlayReport[], rounds: number): string {
  const byStrategy = new Map<string, StrategyAgg>();

  const getAgg = (name: string) => {
    const existing = byStrategy.get(name);
    if (existing) return existing;
    const a = emptyAgg(name);
    byStrategy.set(name, a);
    return a;
  };

  // Per report: track winners (by scoreTotal).
  for (const report of reports) {
    const players = report.final.byPlayer;
    const maxScore = Math.max(...players.map((p) => p.scoreTotal));
    const winners = players.filter((p) => p.scoreTotal === maxScore);
    const winShare = winners.length > 0 ? 1 / winners.length : 0;

    for (const p of players) {
      const a = getAgg(p.displayName);
      a.runs += 1;
      a.score.push(p.scoreTotal);
      a.baseScore.push(p.scoreBase);
      a.earnedInfluenceGoldEq.push(p.scoreEarnedInfluenceGoldEq);
      a.gold.push(p.gold);
      a.inventoryGoldEq.push(p.scoreBreakdown.inventoryGoldEq);
      a.assetsGoldEq.push(p.scoreBreakdown.assetsGoldEq);
      a.influence.push(p.scoreBreakdown.influence);
      a.permInfluence.push(p.scoreBreakdown.permanentInfluence);

      a.holdings.domains.push(p.holdings.domains.length);
      a.holdings.cities.push(p.holdings.cityProperties.length);
      a.holdings.offices.push(p.holdings.offices.length);
      a.holdings.orgs.push(p.holdings.organizations.length);
      a.holdings.trade.push(p.holdings.tradeEnterprises.length);
      a.holdings.workshops.push(p.holdings.workshops.length);
      a.holdings.storages.push(p.holdings.storages.length);

      for (const c of p.holdings.cityProperties) addCounts(a.cityModes, c.mode);
      for (const o of p.holdings.offices)
        addCounts(a.officeYieldModes, o.yieldMode);
      for (const o of p.holdings.organizations) addCounts(a.orgKinds, o.kind);

      addTotalsByType(a.goldGainedByType, p.ledger.goldGained);
      addTotalsByType(a.goldSpentByType, p.ledger.goldSpent);
      addTotalsByType(a.influenceGainedByType, p.ledger.influenceGained);
      addTotalsByType(a.influenceSpentByType, p.ledger.influenceSpent);
      a.goldGainedTotal += p.ledger.goldGained.total ?? 0;
      a.goldSpentTotal += p.ledger.goldSpent.total ?? 0;
      a.influenceGainedTotal += p.ledger.influenceGained.total ?? 0;
      a.influenceSpentTotal += p.ledger.influenceSpent.total ?? 0;

      if (winners.some((w) => w.playerId === p.playerId)) {
        a.winShare += winShare;
      }
    }

    // Steps: action/facility counts + outcome tiers.
    for (const step of report.steps) {
      const a = getAgg(step.playerName);
      const cmdType = step.command?.type ?? 'Unknown';
      if (step.kind === 'action') addCounts(a.actionCounts, cmdType);
      if (step.kind === 'facility') addCounts(a.facilityCounts, cmdType);
      if (step.outcome?.tier) addCounts(a.outcomeTiers, step.outcome.tier);
    }
  }

  const strategies = [...byStrategy.values()].sort((a, b) => {
    const scoreA = mean(a.score);
    const scoreB = mean(b.score);
    return scoreB - scoreA || a.name.localeCompare(b.name);
  });

  const lines: string[] = [];
  const seeds = reports.map((r) => r.config.seed).sort((a, b) => a - b);
  const seedLabel =
    seeds.length > 0
      ? seeds.length === 1
        ? String(seeds[0])
        : `${seeds[0]}..${seeds[seeds.length - 1]}`
      : '-';
  lines.push(`## ${rounds} Runden`);
  lines.push(
    `Runs: ${reports.length} (seeds: ${seedLabel}) | Scenario: ${reports[0]?.config.scenario ?? '-'}`
  );
  lines.push('');

  lines.push(
    mdTable(
      [
        'Strategie',
        'winRate',
        'Score mean',
        'Score p10',
        'Score p50',
        'Score p90',
        'InfPool (GoldEq) mean',
        'Gold mean',
        'Inv≈ mean',
        'Einfluss mean (perm)',
        'Assets≈ mean',
        'Holdings mean (d/c/o/org/trade/ws/store)',
      ],
      strategies.map((a) => {
        const sScore = stats(a.score);
        const sInfPool = stats(a.earnedInfluenceGoldEq);
        const sGold = stats(a.gold);
        const sInv = stats(a.inventoryGoldEq);
        const sAssets = stats(a.assetsGoldEq);
        const sInf = stats(a.influence);
        const sPerm = stats(a.permInfluence);
        const holdings = `${fmt(mean(a.holdings.domains), 2)}/${fmt(mean(a.holdings.cities), 2)}/${fmt(mean(a.holdings.offices), 2)}/${fmt(mean(a.holdings.orgs), 2)}/${fmt(mean(a.holdings.trade), 2)}/${fmt(mean(a.holdings.workshops), 2)}/${fmt(mean(a.holdings.storages), 2)}`;
        return [
          a.name,
          fmt(a.winShare / Math.max(1, reports.length), 3),
          fmt(sScore.mean, 1),
          fmt(sScore.p10, 1),
          fmt(sScore.p50, 1),
          fmt(sScore.p90, 1),
          fmt(sInfPool.mean, 1),
          fmt(sGold.mean, 1),
          fmt(sInv.mean, 1),
          `${fmt(sInf.mean, 1)} (perm ${fmt(sPerm.mean, 1)})`,
          fmt(sAssets.mean, 1),
          holdings,
        ];
      })
    )
  );
  lines.push('');

  lines.push('### Aktionen (mean per run)');
  const actionKeys = [
    'MoneyLend',
    'MoneySell',
    'MoneyBuy',
    'MoneySellBuy',
    'GainInfluence',
    'GainMaterials',
    'AcquireOffice',
    'AcquireTradeEnterprise',
    'AcquireOrganization',
    'AcquireCityProperty',
    'AcquireDomain',
    'AcquireTenants',
    'BuildFacility',
    'BuildWorkshop',
    'BuildStorage',
    'UpgradeStarterDomain',
  ];
  lines.push(
    mdTable(
      ['Strategie', ...actionKeys.map((k) => k)],
      strategies.map((a) => {
        const perRun = (key: string) => {
          const total = a.actionCounts[key] ?? 0;
          return fmt(total / Math.max(1, reports.length), 2);
        };
        return [a.name, ...actionKeys.map((k) => perRun(k))];
      })
    )
  );
  lines.push('');

  lines.push('### Sonderaktion (Facilities, mean per run)');
  const facilityKeys = [
    'BuildFacility',
    'BuildWorkshop',
    'BuildStorage',
    'UpgradeStarterDomain',
    'UpgradeWorkshop',
    'UpgradeStorage',
    'SetCityPropertyMode',
    'SetOfficeYieldMode',
    'SetTradeEnterpriseMode',
    'SetDomainSpecialization',
  ];
  lines.push(
    mdTable(
      ['Strategie', ...facilityKeys.map((k) => k)],
      strategies.map((a) => {
        const perRun = (key: string) => {
          const total = a.facilityCounts[key] ?? 0;
          return fmt(total / Math.max(1, reports.length), 2);
        };
        return [a.name, ...facilityKeys.map((k) => perRun(k))];
      })
    )
  );
  lines.push('');

  lines.push('### Economy (mean totals per run)');
  lines.push(
    mdTable(
      [
        'Strategie',
        'Gold+ income',
        'Gold+ sell',
        'Gold+ conversion',
        'Gold- lend',
        'Gold- buy',
        'Gold- acquire',
        'Gold- facilities',
        'Gold- upkeep',
        'InfPool (GoldEq)',
        'Einfluss- spend',
      ],
      strategies.map((a) => {
        const div = Math.max(1, reports.length);
        const gIn = a.goldGainedByType;
        const gOut = a.goldSpentByType;
        const goldLend = gOut['money.lend'] ?? 0;
        const goldBuy = gOut['money.buy'] ?? 0;
        const acquireGold =
          (gOut['acquire.domain'] ?? 0) +
          (gOut['acquire.city'] ?? 0) +
          (gOut['acquire.office'] ?? 0) +
          (gOut['acquire.org'] ?? 0) +
          (gOut['acquire.trade'] ?? 0) +
          (gOut['acquire.tenants'] ?? 0) +
          (gOut['acquire.troops'] ?? 0);
        const facilityGold =
          (gOut['build.facility'] ?? 0) +
          (gOut['build.workshop'] ?? 0) +
          (gOut['build.storage'] ?? 0) +
          (gOut['upgrade.starter'] ?? 0) +
          (gOut['upgrade.workshop'] ?? 0) +
          (gOut['upgrade.storage'] ?? 0);
        return [
          a.name,
          fmt((gIn.income ?? 0) / div, 1),
          fmt((gIn['money.sell'] ?? 0) / div, 1),
          fmt((gIn.conversion ?? 0) / div, 1),
          fmt(goldLend / div, 1),
          fmt(goldBuy / div, 1),
          fmt(acquireGold / div, 1),
          fmt(facilityGold / div, 1),
          fmt((gOut.upkeep ?? 0) / div, 1),
          fmt(mean(a.earnedInfluenceGoldEq), 1),
          fmt(a.influenceSpentTotal / div, 1),
        ];
      })
    )
  );
  lines.push('');

  lines.push('### Posten-Modi (final, mean per run)');
  for (const a of strategies) {
    const div = Math.max(1, reports.length);
    const cityLeased = (a.cityModes.leased ?? 0) / div;
    const cityProd = (a.cityModes.production ?? 0) / div;
    const officeInf = (a.officeYieldModes.influence ?? 0) / div;
    const officeGold = (a.officeYieldModes.gold ?? 0) / div;
    const officeSplit = (a.officeYieldModes.split ?? 0) / div;
    const orgTop = Object.entries(a.orgKinds)
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .slice(0, 6)
      .map(([k, v]) => `${k}=${fmt(v / div, 2)}`);
    lines.push(
      `- ${a.name}: cityMode leased=${fmt(cityLeased, 2)} prod=${fmt(cityProd, 2)} | officeYield inf=${fmt(officeInf, 2)} gold=${fmt(officeGold, 2)} split=${fmt(officeSplit, 2)} | orgKinds [${orgTop.join(', ')}]`
    );
  }
  lines.push('');

  lines.push('### Notizen (qualitativ)');
  for (const a of strategies) {
    const winRate = a.winShare / Math.max(1, reports.length);
    const actionTop = Object.entries(a.actionCounts)
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .slice(0, 5)
      .map(([k, v]) => `${k}=${fmt(v / Math.max(1, reports.length), 2)}`);
    const tiers = Object.entries(a.outcomeTiers)
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .slice(0, 5)
      .map(([k, v]) => `${k}=${v}`);
    lines.push(`- ${a.name}: winRate=${percent(winRate)} | topActions=[${actionTop.join(', ')}] | tiers=[${tiers.join(', ')}]`);
  }
  lines.push('');

  return lines.join('\n');
}

function usage(): string {
  return [
    'LLM Batch Analysis (Myranor Aufbausystem)',
    '',
    'Usage:',
    '  bun src/playtest/analyzeLlmBatch.ts <report.json|dir>... [--out <file.md>]',
    '',
    'Notes:',
    '  - Du kannst einzelne JSON-Dateien oder Ordner angeben (es werden *.json gesammelt).',
  ].join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf('--out');
  const outPath = outIdx !== -1 ? argv[outIdx + 1] : null;
  const rawPaths = outIdx === -1 ? argv : argv.slice(0, outIdx);
  if (rawPaths.length === 0 || rawPaths.includes('--help')) {
    console.log(usage());
    process.exitCode = rawPaths.length === 0 ? 1 : 0;
    return;
  }

  const paths: string[] = [];
  for (const p of rawPaths) {
    for (const file of await collectJsonFiles(p)) paths.push(file);
  }

  if (paths.length === 0) {
    throw new Error('No JSON reports found.');
  }

  const reports = await Promise.all(paths.map((p) => readReport(p)));
  reports.sort((a, b) => a.config.rounds - b.config.rounds || a.config.seed - b.config.seed);

  const byRounds = new Map<number, LlmPlayReport[]>();
  for (const r of reports) {
    const list = byRounds.get(r.config.rounds) ?? [];
    list.push(r);
    byRounds.set(r.config.rounds, list);
  }

  const lines: string[] = [];
  const scenario = reports[0]?.config.scenario ?? '-';
  lines.push(`# LLM Batch Analysis — ${scenario}`);
  lines.push('');
  lines.push(`Reports: ${reports.length}`);
  lines.push('');

  const roundsSorted = [...byRounds.keys()].sort((a, b) => a - b);
  for (const rounds of roundsSorted) {
    const group = byRounds.get(rounds) ?? [];
    if (group.length === 0) continue;
    lines.push(sectionForRounds(group, rounds));
  }

  // Cross-horizon comparison (score mean + winRate)
  {
    const strategies = new Set<string>();
    for (const group of byRounds.values()) {
      for (const p of group[0]?.final.byPlayer ?? []) strategies.add(p.displayName);
    }
    const strategyNames = [...strategies].sort((a, b) => a.localeCompare(b));
    lines.push('## Vergleich über Zeit (Score mean / winRate)');
    lines.push('');
    const headers = ['Strategie'];
    for (const r of roundsSorted) {
      headers.push(`${r}R Score`);
      headers.push(`${r}R win`);
    }
    const rows: string[][] = [];
    for (const name of strategyNames) {
      const row: string[] = [name];
      for (const r of roundsSorted) {
        const group = byRounds.get(r) ?? [];
        const scores: number[] = [];
        let winShare = 0;
        for (const rep of group) {
          const me = rep.final.byPlayer.find((p) => p.displayName === name);
          if (!me) continue;
          scores.push(me.scoreTotal);
          const max = Math.max(...rep.final.byPlayer.map((p) => p.scoreTotal));
          const winners = rep.final.byPlayer.filter((p) => p.scoreTotal === max);
          if (winners.some((w) => w.displayName === name)) {
            winShare += winners.length > 0 ? 1 / winners.length : 0;
          }
        }
        row.push(fmt(mean(scores), 1));
        row.push(fmt(winShare / Math.max(1, group.length), 3));
      }
      rows.push(row);
    }
    lines.push(mdTable(headers, rows));
    lines.push('');
  }

  const out = lines.join('\n');
  if (outPath) {
    await Bun.write(outPath, out);
  } else {
    console.log(out);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.log('');
  console.log(usage());
  process.exitCode = 1;
});
