import { type SuccessTier, resolveSuccessTier } from '../core';

export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export function tierProbabilities(
  dc: number,
  modifier: number,
  mode: RollMode = 'normal'
): Record<SuccessTier, number> {
  const counts: Record<SuccessTier, number> = {
    veryGood: 0,
    good: 0,
    success: 0,
    poor: 0,
    fail: 0,
  };

  const bump = (rollTotal: number, weight: number) => {
    const tier = resolveSuccessTier(dc, rollTotal);
    counts[tier] += weight;
  };

  if (mode === 'normal') {
    const weight = 1 / 20;
    for (let r = 1; r <= 20; r += 1) {
      bump(r + modifier, weight);
    }
    return counts;
  }

  const weight = 1 / 400;
  for (let r1 = 1; r1 <= 20; r1 += 1) {
    for (let r2 = 1; r2 <= 20; r2 += 1) {
      const chosen = mode === 'advantage' ? Math.max(r1, r2) : Math.min(r1, r2);
      bump(chosen + modifier, weight);
    }
  }
  return counts;
}
