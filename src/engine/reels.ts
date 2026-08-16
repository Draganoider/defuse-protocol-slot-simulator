import type { DeterministicRng } from './rng';

export function selectStops(
  reelStrips: readonly (readonly string[])[],
  rng: DeterministicRng,
): readonly number[] {
  return reelStrips.map((strip) => rng.nextInt(strip.length));
}

/** Grid orientation is grid[reel][row], reading downward from each stop. */
export function buildGrid(
  reelStrips: readonly (readonly string[])[],
  stops: readonly number[],
  rows: number,
): readonly (readonly string[])[] {
  if (reelStrips.length !== stops.length) {
    throw new Error('A stop is required for every reel strip.');
  }
  return reelStrips.map((strip, reel) => {
    if (strip.length === 0) throw new Error(`Reel ${reel} is empty.`);
    const stop = stops[reel];
    if (!Number.isInteger(stop) || stop < 0 || stop >= strip.length) {
      throw new Error(`Stop ${String(stop)} is out of range for reel ${reel}.`);
    }
    return Array.from({ length: rows }, (_, row) => strip[(stop + row) % strip.length]);
  });
}

