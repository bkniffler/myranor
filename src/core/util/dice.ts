import type { Rng } from './rng';

export type DiceRoll = {
  expression: string;
  rolls: number[];
  total: number;
};

export function rollDice(expression: string, rng: Rng): DiceRoll {
  const match = /^(\d+)d(\d+)$/.exec(expression.trim());
  if (!match) throw new Error(`Unsupported dice expression: ${expression}`);

  const count = Number.parseInt(match[1], 10);
  const sides = Number.parseInt(match[2], 10);
  if (count <= 0 || sides <= 0) throw new Error(`Invalid dice: ${expression}`);

  const rolls: number[] = [];
  for (let i = 0; i < count; i += 1) {
    rolls.push(rng.nextIntInclusive(1, sides));
  }

  const total = rolls.reduce((sum, value) => sum + value, 0);
  return { expression: `${count}d${sides}`, rolls, total };
}

export function rollD20(rng: Rng): DiceRoll {
  return rollDice('1d20', rng);
}
