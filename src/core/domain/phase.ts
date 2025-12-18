export const PHASES = [
  'maintenance',
  'actions',
  'conversion',
  'reset',
] as const;

export type Phase = (typeof PHASES)[number];

export function isPhase(value: string): value is Phase {
  return (PHASES as readonly string[]).includes(value);
}

export function nextPhase(current: Phase): Phase {
  switch (current) {
    case 'maintenance':
      return 'actions';
    case 'actions':
      return 'conversion';
    case 'conversion':
      return 'reset';
    case 'reset':
      return 'maintenance';
  }
}

