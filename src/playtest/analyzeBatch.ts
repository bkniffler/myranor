import type { PlaytestReport } from './runner';

type SummaryStats = { mean: number; p10: number; p50: number; p90: number };
type AgentOutcome = PlaytestReport['outcomes']['byAgent'][keyof PlaytestReport['outcomes']['byAgent']];

function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(digits);
}

function mdTable(headers: string[], rows: string[][]): string {
  const escape = (v: string) => v.replace(/\|/g, '\\|');
  const out: string[] = [];
  out.push(`| ${headers.map(escape).join(' | ')} |`);
  out.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const row of rows) out.push(`| ${row.map(escape).join(' | ')} |`);
  return out.join('\n');
}

function eventCount(report: PlaytestReport, rollTotal: number): number {
  return report.systems.events.byRoll[String(rollTotal)] ?? 0;
}

function byAgentDisplayName(report: PlaytestReport): Record<string, string> {
  return Object.fromEntries(
    report.scenario.players.map((p) => [p.agentId, p.displayName]),
  );
}

function sumByAgent(report: PlaytestReport, pick: (a: AgentOutcome) => number): number {
  let sum = 0;
  for (const a of Object.values(report.outcomes.byAgent)) sum += pick(a);
  return sum;
}

function meanOrZero(stats: SummaryStats): number {
  return Number.isFinite(stats.mean) ? stats.mean : 0;
}

async function readReport(path: string): Promise<PlaytestReport> {
  const text = await Bun.file(path).text();
  return JSON.parse(text) as PlaytestReport;
}

function sectionForReport(report: PlaytestReport, label: string): string {
  const lines: string[] = [];
  const names = byAgentDisplayName(report);

  lines.push(`## ${label}`);
  lines.push(`Config: runs=${report.config.runs}, rounds=${report.config.rounds}, seed=${report.config.seed}..${report.config.seed + report.config.runs - 1}`);
  lines.push('');
  lines.push(
    `- Gini Gold: mean=${fmt(report.outcomes.giniGold.mean, 3)} p50=${fmt(report.outcomes.giniGold.p50, 3)} p90=${fmt(report.outcomes.giniGold.p90, 3)}`,
  );
  lines.push(
    `- Gini GoldEq-Score: mean=${fmt(report.outcomes.giniScoreGoldEq.mean, 3)} p50=${fmt(report.outcomes.giniScoreGoldEq.p50, 3)} p90=${fmt(report.outcomes.giniScoreGoldEq.p90, 3)}`,
  );
  lines.push('');

  const rows = Object.entries(report.outcomes.byAgent)
    .map(([agentId, a]) => ({
      agentId,
      name: names[agentId] ?? agentId,
      a,
      score: meanOrZero(a.finalScoreGoldEq),
    }))
    .sort((x, y) => y.score - x.score || x.agentId.localeCompare(y.agentId));

  lines.push(mdTable(
    [
      'Strategie',
      'winRate (GoldEq)',
      'Score mean',
      'Score p10',
      'Score p50',
      'Score p90',
      'Gold mean',
      'Holdings mean (d/c/o/org/trade/ws/store)',
      'Sell via trade',
      'Cargo incidents',
      'Cargo loss (total)',
      'TE dmg/lost',
    ],
    rows.map(({ name, a }) => {
      const h = a.finalHoldings;
      const holdings = `${fmt(h.domains.mean, 2)}/${fmt(h.cities.mean, 2)}/${fmt(h.offices.mean, 2)}/${fmt(h.organizations.mean, 2)}/${fmt(h.tradeEnterprises.mean, 2)}/${fmt(h.workshops.mean, 2)}/${fmt(h.storages.mean, 2)}`;
      const teEvents = `${a.sell.tradeEnterpriseDamagedEvents}/${a.sell.tradeEnterpriseLostEvents}`;
      return [
        name,
        fmt(a.winRateScore, 3),
        fmt(a.finalScoreGoldEq.mean, 1),
        fmt(a.finalScoreGoldEq.p10, 1),
        fmt(a.finalScoreGoldEq.p50, 1),
        fmt(a.finalScoreGoldEq.p90, 1),
        fmt(a.finalGold.mean, 2),
        holdings,
        `${a.sell.viaTradeMarkets}/${a.sell.samples}`,
        `${a.sell.cargoIncidents}`,
        `${a.sell.cargoLossGoldTotal}`,
        teEvents,
      ];
    }),
  ));
  lines.push('');

  lines.push('### Stadtbesitz (final, mean)');
  lines.push('- Mode: `verpachtet` = Gold+Einfluss+AK, `Eigenproduktion` = AK (mit Gold-Unterhalt), öffnet Werkstatt/Lager im Stadtbesitz.');
  for (const { name, a } of rows) {
    const c = a.finalHoldings.citiesByTierMode;
    const leased = `S=${fmt(c.smallLeased.mean, 1)} M=${fmt(c.mediumLeased.mean, 1)} L=${fmt(c.largeLeased.mean, 1)}`;
    const prod = `S=${fmt(c.smallProduction.mean, 1)} M=${fmt(c.mediumProduction.mean, 1)} L=${fmt(c.largeProduction.mean, 1)}`;
    const acq = a.cityAcquisition;
    const income = a.finalHoldings;
    lines.push(
      `- ${name}: leased(${leased}) prod(${prod}) | Kauf: ${fmt(acq.goldSpent.mean, 1)}g (n=${fmt(acq.count.mean, 1)}, ~${fmt(acq.costPerCity, 1)}g/Stk) | Ertrag/R: ${fmt(income.cityIncomeGoldPerRound.mean, 1)}g +${fmt(income.cityIncomeInfluencePerRound.mean, 1)} Inf +${fmt(income.cityIncomeLaborPerRound.mean, 1)} AK | Unterhalt/R (prod): ${fmt(income.cityProductionUpkeepGoldPerRound.mean, 1)}g`,
    );
  }
  lines.push('');

  const totalTradeSales = sumByAgent(report, (a) => a.sell.viaTradeMarkets);
  const totalSales = sumByAgent(report, (a) => a.sell.samples);
  const totalCargoIncidents = sumByAgent(report, (a) => a.sell.cargoIncidents);
  const totalCargoLoss = sumByAgent(report, (a) => a.sell.cargoLossGoldTotal);
  const totalTeDamaged = sumByAgent(report, (a) => a.sell.tradeEnterpriseDamagedEvents);
  const totalTeLost = sumByAgent(report, (a) => a.sell.tradeEnterpriseLostEvents);

  lines.push('**Trade-Nerf Coverage**');
  lines.push(
    `- Events: 15(storm)=${eventCount(report, 15)}, 16(raiders/pirates)=${eventCount(report, 16)}, 26(conflict)=${eventCount(report, 26)}, 31(econ)=${eventCount(report, 31)}`,
  );
  lines.push(
    `- Verkäufe: tradeMarkets=${totalTradeSales}/${totalSales}; CargoIncidents=${totalCargoIncidents}; CargoLossGold=${totalCargoLoss}; TE damaged/lost=${totalTeDamaged}/${totalTeLost}`,
  );
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outPath = outIdx !== -1 ? args[outIdx + 1] : null;
  const paths = outIdx === -1 ? args : args.slice(0, outIdx);
  if (paths.length === 0) {
    console.error('Usage: bun src/playtest/analyzeBatch.ts <report.json>... [--out <file.md>]');
    process.exitCode = 1;
    return;
  }

  const reports = await Promise.all(paths.map((p) => readReport(p)));
  reports.sort((a, b) => a.config.rounds - b.config.rounds);

  const lines: string[] = [];
  lines.push('# Playtest Batch Analysis (GoldEq + Trade-Risiken)');
  lines.push('');
  lines.push('Diese Auswertung nutzt den Playtest-Runner (Planner-Agenten, keine LLM-Calls) und bewertet den Erfolg über GoldEq-Score.');
  lines.push('');

  for (const report of reports) {
    lines.push(sectionForReport(report, `${report.config.rounds} Runden`));
  }

  // Cross-horizon comparison table
  const byRounds: Record<number, PlaytestReport> = Object.fromEntries(
    reports.map((r) => [r.config.rounds, r]),
  );
  const horizons = reports.map((r) => r.config.rounds);

  const agentIds = Array.from(
    new Set(reports.flatMap((r) => Object.keys(r.outcomes.byAgent))),
  ).sort((a, b) => a.localeCompare(b));

  const nameByAgentId = Object.fromEntries(
    reports.flatMap((r) => r.scenario.players.map((p) => [p.agentId, p.displayName] as const)),
  );

  lines.push('## Vergleich über Zeit (Score mean / winRate)');
  lines.push('');
  const headers = ['Strategie', ...horizons.flatMap((h) => [`${h}R Score`, `${h}R win`])];
  const rows = agentIds.map((id) => {
    const row: string[] = [nameByAgentId[id] ?? id];
    for (const h of horizons) {
      const rep = byRounds[h];
      const a = rep?.outcomes.byAgent[id];
      row.push(a ? fmt(a.finalScoreGoldEq.mean, 1) : '-');
      row.push(a ? fmt(a.winRateScore, 3) : '-');
    }
    return row;
  });
  lines.push(mdTable(headers, rows));
  lines.push('');

  const md = lines.join('\n');
  if (outPath) {
    await Bun.write(outPath, md);
  } else {
    console.log(md);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
