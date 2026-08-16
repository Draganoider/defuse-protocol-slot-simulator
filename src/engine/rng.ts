import { RNG_ALGORITHM, type RngSnapshot } from './types';

const UINT32_RANGE = 0x1_0000_0000;
const MULBERRY_INCREMENT = 0x6d2b79f5;

export interface DeterministicRng {
  readonly seed: string;
  nextUint32(): number;
  nextFloat(): number;
  nextInt(exclusiveMax: number): number;
  snapshot(): RngSnapshot;
}

function hashSeedText(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function normalizeSeed(seed: number | string): { numeric: number; canonical: string } {
  let numeric: number;
  if (typeof seed === 'number') {
    if (!Number.isSafeInteger(seed)) {
      throw new Error('Seed numbers must be safe integers.');
    }
    numeric = seed >>> 0;
  } else {
    if (seed.length === 0) {
      throw new Error('Seed strings must not be empty.');
    }
    numeric = hashSeedText(seed);
  }
  return { numeric, canonical: `0x${numeric.toString(16).padStart(8, '0')}` };
}

/**
 * Mulberry32 v1. This stable 32-bit generator is for deterministic simulation,
 * replay and tests; it is not a cryptographic random-number generator.
 */
export function createRng(seed: number | string | RngSnapshot): DeterministicRng {
  const initial = typeof seed === 'object' ? seed : undefined;
  if (initial && initial.algorithm !== RNG_ALGORITHM) {
    throw new Error(`Unsupported RNG algorithm: ${initial.algorithm as string}`);
  }
  if (initial && (!Number.isInteger(initial.state) || initial.state < 0 || initial.state >= UINT32_RANGE)) {
    throw new Error('RNG snapshot state must be an unsigned 32-bit integer.');
  }
  if (initial && (!Number.isSafeInteger(initial.position) || initial.position < 0)) {
    throw new Error('RNG snapshot position must be a non-negative safe integer.');
  }
  if (initial && !/^0x[0-9a-f]{8}$/.test(initial.seed)) {
    throw new Error('RNG snapshot seed must use canonical 0x00000000 encoding.');
  }
  const normalized = initial ? { numeric: initial.state >>> 0, canonical: initial.seed } : normalizeSeed(seed as number | string);
  let state = normalized.numeric >>> 0;
  let position = initial?.position ?? 0;

  const nextUint32 = (): number => {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    position += 1;
    return (value ^ (value >>> 14)) >>> 0;
  };

  return {
    seed: normalized.canonical,
    nextUint32,
    nextFloat: () => nextUint32() / UINT32_RANGE,
    nextInt: (exclusiveMax: number): number => {
      if (!Number.isSafeInteger(exclusiveMax) || exclusiveMax <= 0 || exclusiveMax > UINT32_RANGE) {
        throw new Error('exclusiveMax must be an integer in [1, 2^32].');
      }
      const acceptedRange = Math.floor(UINT32_RANGE / exclusiveMax) * exclusiveMax;
      let value = nextUint32();
      while (value >= acceptedRange) value = nextUint32();
      return value % exclusiveMax;
    },
    snapshot: () => ({
      algorithm: RNG_ALGORITHM,
      seed: normalized.canonical,
      state: state >>> 0,
      position,
    }),
  };
}
