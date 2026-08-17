/** Settle duration of the first reel, measured from the start of the presentation. */
export const REEL_BASE_MS = 244;
/** Additional settle time granted to each following reel. */
export const REEL_STAGGER_MS = 47;
/**
 * Extra time a reel keeps running while one further scatter would still complete the
 * trigger. The hold is presentation only: the result and every landing position are
 * already committed before the first frame is drawn.
 */
export const ANTICIPATION_HOLD_MS = 700;
/**
 * Shorter hold used once the feature is already won and a further scatter would only
 * raise the award. The stake is smaller than a trigger, so the wait is shorter, and it
 * only ever applies to the rare spins that have already triggered.
 */
export const AWARD_ANTICIPATION_HOLD_MS = 420;
/** Settle time kept after the final reel lands before the next phase begins. */
export const PRESENTATION_TAIL_MS = 88;

/** Why a reel is being held, if it is. */
export type ReelAnticipation = 'none' | 'trigger' | 'award';

export interface SpinTiming {
  /** Milliseconds from presentation start at which each reel finishes settling. */
  readonly reelStopMs: readonly number[];
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
}

function naturalStopMs(reel: number): number {
  return REEL_BASE_MS + reel * REEL_STAGGER_MS;
}

/** Presentation length of a spin with no scatter anticipation. */
export const DEFAULT_PRESENTATION_MS = naturalStopMs(4) + PRESENTATION_TAIL_MS;

/**
 * Derives reel settle times from an already committed result.
 *
 * A reel is held for a `trigger` when the reels before it hold exactly one scatter fewer
 * than the trigger requires, so a single further scatter anywhere ahead opens the feature.
 * Once the trigger is met it is held for an `award` instead, because further scatters
 * still raise the number of free spins granted. That second case only ever applies to a
 * spin that has already triggered, so ordinary spins keep their short presentation.
 *
 * Holds are presentation only. The result, every landing position, and the award are all
 * committed before the first frame is drawn.
 */
export function planSpinTiming(options: SpinTimingOptions): SpinTiming {
  const reels = Math.max(0, Math.trunc(options.reels));
  const maxAwardScatters = options.maxAwardScatters ?? reels;
  const scattersPerReel = new Array<number>(reels).fill(0);
  for (const reel of options.scatterReelIndexes) {
    if (Number.isInteger(reel) && reel >= 0 && reel < reels) scattersPerReel[reel] += 1;
  }

  const reelStopMs: number[] = [];
  const anticipation: ReelAnticipation[] = [];
  let scattersLanded = 0;
  let heldMs = 0;
  for (let reel = 0; reel < reels; reel += 1) {
    let kind: ReelAnticipation = 'none';
    if (reel > 0 && options.triggerScatters > 1) {
      if (scattersLanded === options.triggerScatters - 1) kind = 'trigger';
      else if (scattersLanded >= options.triggerScatters && scattersLanded < maxAwardScatters) kind = 'award';
    }
    if (kind === 'trigger') heldMs += ANTICIPATION_HOLD_MS;
    else if (kind === 'award') heldMs += AWARD_ANTICIPATION_HOLD_MS;
    anticipation.push(kind);
    reelStopMs.push(naturalStopMs(reel) + heldMs);
    scattersLanded += scattersPerReel[reel];
  }

  return {
    reelStopMs,
    anticipation,
    presentationMs: (reelStopMs.at(-1) ?? naturalStopMs(4)) + PRESENTATION_TAIL_MS,
    hasAnticipation: heldMs > 0,
  };
}
