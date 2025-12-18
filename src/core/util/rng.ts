export type Rng = {
  nextIntInclusive: (min: number, max: number) => number;
};

export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    nextIntInclusive(min, max) {
      // LCG (Numerical Recipes) - deterministic and good enough for tests/sims.
      state = (1664525 * state + 1013904223) >>> 0;
      const range = max - min + 1;
      return min + (state % range);
    },
  };
}

export function cryptoRng(): Rng {
  return {
    nextIntInclusive(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new Error(`Invalid rng range: ${min}..${max}`);
      }
      const range = max - min + 1;
      const buffer = new Uint32Array(1);
      crypto.getRandomValues(buffer);
      return min + (buffer[0] % range);
    },
  };
}

