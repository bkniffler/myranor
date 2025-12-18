import type { PlaytestReport } from './runner';

function fmt(n: number, digits = 2): string {
  return Number.isFinite(n) ? n.toFixed(digits) : String(n);
}

function topEntries(
  obj: Record<string, number>,
  n: number,
): Array<{ key: string; value: number }> {
  return Object.entries(obj)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

export function formatPlaytestMarkdown(report: PlaytestReport): string {
  const lines: string[] = [];

  lines.push(`# Playtest Report — ${report.scenario.name}`);
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(
    `Config: runs=${report.config.runs}, rounds=${report.config.rounds}, seed=${report.config.seed}`,
  );
  lines.push('');

  lines.push('## Überblick');
  lines.push(
    `- Gini (Final-Gold): mean=${fmt(report.outcomes.giniGold.mean, 3)} p50=${fmt(report.outcomes.giniGold.p50, 3)} p90=${fmt(report.outcomes.giniGold.p90, 3)}`,
  );

  const agents = Object.entries(report.outcomes.byAgent);
  const byWinRate = [...agents].sort((a, b) => b[1].winRate - a[1].winRate);
  const top = byWinRate[0];
  const second = byWinRate[1];
  if (top) {
    const topName = top[0];
    const topWin = top[1].winRate;
    const secondWin = second?.[1].winRate ?? 0;
    const gap = topWin - secondWin;
    lines.push(
      `- Dominanzindikator: top=${topName} (winRate=${fmt(topWin, 3)}) gap=${fmt(gap, 3)}`,
    );
  }
  lines.push('');

  lines.push('## Outcomes (pro Strategie)');
  lines.push('| Agent | winRate | FinalGold mean | p10 | p50 | p90 | Sell Gold/Inv mean | Sell Market/Inv mean | Conv Gold/Run mean |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const [agentId, a] of byWinRate) {
    lines.push(
      `| ${agentId} | ${fmt(a.winRate, 3)} | ${fmt(a.finalGold.mean)} | ${fmt(a.finalGold.p10)} | ${fmt(a.finalGold.p50)} | ${fmt(a.finalGold.p90)} | ${fmt(a.sell.goldPerInvestment.mean)} | ${fmt(a.sell.marketModifierPerInvestment.mean)} | ${fmt(a.conversion.goldFromConversionMean)} |`,
    );
  }
  lines.push('');

  lines.push('## Aktionen (Top-Counts)');
  for (const [agentId, a] of byWinRate) {
    const actions = Object.entries(a.actions)
      .map(([key, v]) => ({ key, count: v.count }))
      .sort((x, y) => y.count - x.count)
      .slice(0, 8);
    lines.push(`- ${agentId}: ${actions.map((x) => `${x.key}=${x.count}`).join(', ')}`);
  }
  lines.push('');

  lines.push('## Markt (Verteilung)');
  lines.push(`- Markt-Rohmaterial: samples=${report.systems.market.raw.samples}`);
  lines.push(
    `  - Modifiers basic: mean=${fmt(report.systems.market.raw.modifiers.basic.mean)} p10=${fmt(report.systems.market.raw.modifiers.basic.p10)} p50=${fmt(report.systems.market.raw.modifiers.basic.p50)} p90=${fmt(report.systems.market.raw.modifiers.basic.p90)}`,
  );
  lines.push(`- Markt-Sondermaterial: samples=${report.systems.market.special.samples}`);
  lines.push(
    `  - Modifiers basic: mean=${fmt(report.systems.market.special.modifiers.basic.mean)} p10=${fmt(report.systems.market.special.modifiers.basic.p10)} p50=${fmt(report.systems.market.special.modifiers.basic.p50)} p90=${fmt(report.systems.market.special.modifiers.basic.p90)}`,
  );
  lines.push('');

  lines.push('## Ereignisse (Verteilung & aktive Modifiers)');
  lines.push(
    `- Sections=${report.systems.events.sections} Events=${report.systems.events.events}`,
  );
  {
    const topEvents = topEntries(report.systems.events.byName, 12);
    lines.push(
      `- Häufigste Ereignisse: ${topEvents.map((e) => `${e.key}(${e.value})`).join(', ')}`,
    );
  }
  {
    const m = report.systems.events.modifiers;
    lines.push(
      `- Modifiers (mean): taxGoldPerRound=${fmt(m.taxGoldPerRound.mean)}, officeGoldMult=${fmt(m.officeGoldIncomeMultiplier.mean, 3)}, officeGoldBonusPerTier=${fmt(m.officeGoldIncomeBonusPerTier.mean)}, sellDcBonus=${fmt(m.sellMaterialsDcBonus.mean)}, rawAutoConvertDivFood=${fmt(m.rawAutoConvertDivisorFood.mean)}, bonusGold/2inv=${fmt(m.moneyBonusGoldPerTwoInvestments.mean)}`,
    );
  }
  lines.push('');

  lines.push('## Bewertung (heuristisch)');
  if (top && second) {
    const topWin = top[1].winRate;
    const gap = topWin - second[1].winRate;
    if (topWin >= 0.6 && gap >= 0.2) {
      lines.push(
        `- Sehr starke Dominanz von \`${top[0]}\` (winRate=${fmt(topWin, 3)}, gap=${fmt(gap, 3)}). Balancing-Änderung wahrscheinlich nötig.`,
      );
    } else if (topWin >= 0.5 && gap >= 0.1) {
      lines.push(
        `- Moderate Dominanz von \`${top[0]}\` (winRate=${fmt(topWin, 3)}, gap=${fmt(gap, 3)}).`,
      );
    } else {
      lines.push(
        `- Keine klare Dominanz nach winRate (top=${fmt(topWin, 3)}, gap=${fmt(gap, 3)}).`,
      );
    }
  }

  const spec = report.outcomes.byAgent.speculator;
  if (spec && spec.sell.marketModifierPerInvestment.mean > 2) {
    lines.push(
      `- Markt-Timing-Effekt sichtbar: \`speculator\` verkauft überwiegend bei gutem Markt (market/Inv mean=${fmt(spec.sell.marketModifierPerInvestment.mean)}).`,
    );
  }
  lines.push('');

  lines.push('## Vorschläge (nächste Iteration)');
  lines.push('- Agenten verbessern: Zielgerichteter Marktverkauf (Trade-Märkte), gezielte Pächter/Anhänger-Rekrutierung, Truppen-/Unterwelt-Synergien.');
  lines.push('- Ereignisabdeckung erweitern (z.B. Amts-spezifische Effekte, Domänen-Angriffe, Provinzinspektion) – oder diese explizit als „nicht modelliert“ markieren.');
  lines.push('- Facility-Katalog (Einrichtungen der Domänen/Stadt/Circel/Ämter/Handel) als Datenmodell abbilden und Ertrags-/Upkeep-Effekte in Maintenance verdrahten.');
  lines.push('- Politische Schritte (Aktion 5) später implementieren, sobald Kernökonomie stabil ist.');
  lines.push('');

  return lines.join('\n');
}
