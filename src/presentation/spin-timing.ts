/** How long the reels are displayed running. Presentation only. */
export type SpinSpeed = 'standard' | 'turbo';

export interface SpinSpeedProfile {
  /** Settle duration of the first reel, from the start of the presentation. */
  readonly reelBaseMs: number;
  /** Additional settle time granted to each following reel. */
  readonly reelStaggerMs: number;
  /**
   * Extra time a reel keeps running while one further scatter would still complete the
   * trigger. The hold is presentation only: the result and every landing position are
   * already committed before the first frame is drawn.
   */
  readonly anticipationHoldMs: number;
  /**
   * Shorter hold used once the feature is already won and a further scatter would only
   * raise the award. The stake is smaller than a trigger, so the wait is shorter.
   */
  readonly awardAnticipationHoldMs: number;
  /** Settle time kept after the final reel lands before the next phase begins. */
  readonly presentationTailMs: number;
}

/**
 * `standard` runs the reels long enough to read as a spin rather than a cut. `turbo` keeps
 * the original quick presentation as an explicit choice for players who want throughput.
 * Only the display changes: both settle on the same committed result from the same seed.
 */
export const SPIN_SPEEDS: Readonly<Record<SpinSpeed, SpinSpeedProfile>> = {
  standard: {
    reelBaseMs: 750,
    reelStaggerMs: 150,
    anticipationHoldMs: 1_000,
    awardAnticipationHoldMs: 600,
    presentationTailMs: 120,
  },
  turbo: {
    reelBaseMs: 244,
    reelStaggerMs: 47,
    anticipationHoldMs: 700,
    awardAnticipationHoldMs: 420,
    presentationTailMs: 88,
  },
};

export const DEFAULT_SPIN_SPEED: SpinSpeed = 'standard';

export function isSpinSpeed(value: unknown): value is SpinSpeed {
  return value === 'standard' || value === 'turbo';
}

/** Why a reel is being held, if it is. */
export type ReelAnticipation = 'none' | 'trigger' | 'award';

export interface SpinTiming {
  readonly speed: SpinSpeed;
  /** Milliseconds from presentation start at which each reel finishes settling. */
  readonly reelStopMs: readonly number[];
  /** How long each reel spends settling, excluding any hold before it starts. */
  readonly reelDurationMs: readonly number[];
  /** Per reel: held for a possible trigger, for a larger award, or not held. */
  readonly anticipation: readonly ReelAnticipation[];
  /** Complete presentation length, including the settle tail. */
  readonly presentationMs: number;
  /** True when at least one reel holds for a possible trigger. */
  readonly hasAnticipation: boolean;
}

export interface SpinTimingOptions {
  readonly reels: number;
  /** Reel index of every scatter in the committed result; repeats are counted. */
  readonly scatterReelIndexes: readonly number[];
  readonly triggerScatters: number;
  /** Highest scatter count that still increases the award. Beyond it there is no wait. */
  readonly maxAwardScatters?: number;
  readonly speed?: SpinSpeed;
}

/**
 * Derives reel settle times from an already committed result.
 *
 * A reel is held for a `trigger` when the reels before it hold exactly one scatter fewer
 * than the trigger requires, so a single further scatter anywhere ahead opens the feature.
 * Once the trigger is met it is held for an `award` instead, because further scatters still
 * raise the number of free spins granted. That second case only ever applies to a spin that
 * has already triggered, so ordinary spins keep their plain cadence.
 *
 * Holds are presentation only. The result, every landing position, and the award are all
 * committed before the first frame is drawn.
 */
export function planSpinTiming(options: SpinTimingOptions): SpinTiming {
  const speed = options.speed ?? DEFAULT_SPIN_SPEED;
  const profile = SPIN_SPEEDS[speed];
  const reels = Math.max(0, Math.trunc(options.reels));
  const maxAwardScatters = options.maxAwardScatters ?? reels;
  const scattersPerReel = new Array<number>(reels).fill(0);
  for (const reel of options.scatterReelIndexes) {
    if (Number.isInteger(reel) && reel >= 0 && reel < reels) scattersPerReel[reel] += 1;
  }

  const reelStopMs: number[] = [];
  const reelDurationMs: number[] = [];
  const anticipation: ReelAnticipation[] = [];
  let scattersLanded = 0;
  let heldMs = 0;
  for (let reel = 0; reel < reels; reel += 1) {
    let kind: ReelAnticipation = 'none';
    if (reel > 0 && options.triggerScatters > 1) {
      if (scattersLanded === options.triggerScatters - 1) kind = 'trigger';
      else if (scattersLanded >= options.triggerScatters && scattersLanded < maxAwardScatters) kind = 'award';
    }
    if (kind === 'trigger') heldMs += profile.anticipationHoldMs;
    else if (kind === 'award') heldMs += profile.awardAnticipationHoldMs;
    anticipation.push(kind);
    const duration = profile.reelBaseMs + (reel * profile.reelStaggerMs);
    reelDurationMs.push(duration);
    reelStopMs.push(duration + heldMs);
    scattersLanded += scattersPerReel[reel];
  }

  const lastStop = reelStopMs.at(-1)
    ?? (profile.reelBaseMs + (Math.max(0, reels - 1) * profile.reelStaggerMs));
  return {
    speed,
    reelStopMs,
    reelDurationMs,
    anticipation,
    presentationMs: lastStop + profile.presentationTailMs,
    hasAnticipation: heldMs > 0,
  };
}

/** Plan for a spin with no scatter anticipation, used before any result exists. */
export function naturalSpinTiming(speed: SpinSpeed = DEFAULT_SPIN_SPEED, reels = 5): SpinTiming {
  return planSpinTiming({ reels, scatterReelIndexes: [], triggerScatters: 3, speed });
}

/** Presentation length of a spin with no scatter anticipation. */
export function defaultPresentationMs(speed: SpinSpeed = DEFAULT_SPIN_SPEED): number {
  return naturalSpinTiming(speed).presentationMs;
}

export const DEFAULT_PRESENTATION_MS = defaultPresentationMs();
