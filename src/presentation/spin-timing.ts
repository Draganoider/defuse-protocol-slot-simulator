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
/** Settle time kept after the final reel lands before the next phase begins. */
export const PRESENTATION_TAIL_MS = 88;

export interface SpinTiming {
  /** Milliseconds from presentation start at which each reel finishes settling. */
  readonly reelStopMs: readonly number[];
  /** True for reels that hold longer because one more scatter still triggers the feature. */
  readonly anticipatedReels: readonly boolean[];
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
}

function naturalStopMs(reel: number): number {
  return REEL_BASE_MS + reel * REEL_STAGGER_MS;
}

/** Presentation length of a spin with no scatter anticipation. */
export const DEFAULT_PRESENTATION_MS = naturalStopMs(4) + PRESENTATION_TAIL_MS;

/**
 * Derives reel settle times from an already committed result. A reel is anticipated when
 * the reels before it hold exactly one scatter fewer than the trigger requires, so a
 * single further scatter — anywhere ahead — would open the feature. Anticipation stops
 * once the trigger is already met, because there is no longer anything to wait for.
 */
export function planSpinTiming(options: SpinTimingOptions): SpinTiming {
  const reels = Math.max(0, Math.trunc(options.reels));
  const scattersPerReel = new Array<number>(reels).fill(0);
  for (const reel of options.scatterReelIndexes) {
    if (Number.isInteger(reel) && reel >= 0 && reel < reels) scattersPerReel[reel] += 1;
  }

  const reelStopMs: number[] = [];
  const anticipatedReels: boolean[] = [];
  let scattersLanded = 0;
  let heldMs = 0;
  for (let reel = 0; reel < reels; reel += 1) {
    const anticipated = reel > 0
      && options.triggerScatters > 1
      && scattersLanded === options.triggerScatters - 1;
    if (anticipated) heldMs += ANTICIPATION_HOLD_MS;
    anticipatedReels.push(anticipated);
    reelStopMs.push(naturalStopMs(reel) + heldMs);
    scattersLanded += scattersPerReel[reel];
  }

  return {
    reelStopMs,
    anticipatedReels,
    presentationMs: (reelStopMs.at(-1) ?? naturalStopMs(4)) + PRESENTATION_TAIL_MS,
    hasAnticipation: heldMs > 0,
  };
}
