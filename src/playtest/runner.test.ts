import { describe, expect, test } from 'bun:test';

import { getScenario } from './scenarios';
import { runPlaytest } from './runner';

describe('playtest runner', () => {
  test('runs and returns aggregated metrics', () => {
    const scenario = getScenario('core-v1-all5');
    expect(scenario).not.toBeNull();
    if (!scenario) return;

    const report = runPlaytest({ runs: 5, rounds: 6, seed: 1 }, scenario.name, scenario.players);
    expect(report.scenario.name).toBe('core-v1-all5');
    expect(report.outcomes.giniGold.mean).toBeGreaterThanOrEqual(0);
    expect(Object.keys(report.outcomes.byAgent).length).toBeGreaterThan(0);
  });
});
