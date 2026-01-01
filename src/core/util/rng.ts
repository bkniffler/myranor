export type Rng = {
  nextIntInclusive: (min: number, max: number) => number;
};

export function createSeededRng(seed: number): Rng {
  // Mulberry32: small, fast, deterministic PRNG with much better bit quality than LCG
  // (LCG low bits cause strong patterns, e.g. 2d6 sums always odd).
  let state = seed >>> 0;

  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };

  return {
    nextIntInclusive(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new Error(`Invalid rng range: ${min}..${max}`);
      }
      const range = max - min + 1;
      return min + (nextUint32() % range);
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
