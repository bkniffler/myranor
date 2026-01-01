export const SUCCESS_TIERS = [
  'veryGood',
  'good',
  'success',
  'poor',
  'fail',
] as const;

export type SuccessTier = (typeof SUCCESS_TIERS)[number];

export function resolveSuccessTier(dc: number, rollTotal: number): SuccessTier {
  if (rollTotal >= dc + 10) return 'veryGood';
  if (rollTotal >= dc + 5) return 'good';
  if (rollTotal >= dc) return 'success';
  if (rollTotal >= dc - 5) return 'poor';
  return 'fail';
}

export function successTierLabelDe(tier: SuccessTier): string {
  switch (tier) {
    case 'veryGood':
      return 'Sehr gut geschafft';
    case 'good':
      return 'Gut geschafft';
    case 'success':
      return 'Geschafft';
    case 'poor':
      return 'Schlecht geschafft';
    case 'fail':
      return 'Fehlschlag';
  }
}
