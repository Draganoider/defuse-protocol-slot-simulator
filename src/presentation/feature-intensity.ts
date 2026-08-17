import type { BonusRoute } from '../engine';

export interface FeatureIntensityInput {
  readonly route: BonusRoute;
  readonly spinsRemaining?: number;
  readonly totalAwarded?: number;
  /** Alpha: containment charges collected so far. */
  readonly alphaCharges?: number;
  /** Alpha: reels already secured for the Extraction Spin. */
  readonly securedReels?: number;
  readonly reels?: number;
  /** Bravo: the current win multiplier. */
  readonly bravoMultiplier?: number;
  readonly multiplierSteps?: readonly number[];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/**
 * Maps live feature state onto how much of the music's intensity layer should be audible.
 *
 * Each route escalates on the thing that actually matters in it: Alpha on the reels it has
 * secured for the Extraction Spin, Bravo on the multiplier ladder. Both lift as the spins
 * run out, so a feature tightens towards its end rather than stopping flat. The value is
 * presentation only and never affects a result.
 */
export function featureIntensity(input: FeatureIntensityInput): number {
  const reels = Math.max(1, input.reels ?? 5);
  const totalAwarded = Math.max(1, input.totalAwarded ?? 1);
  const spinsRemaining = Math.max(0, input.spinsRemaining ?? totalAwarded);
  // Rises from 0 at the first spin to 1 on the last one.
  const urgency = clamp01(1 - ((spinsRemaining - 1) / totalAwarded));

  let progress: number;
  if (input.route === 'alpha') {
    const secured = clamp01((input.securedReels ?? 0) / reels);
    // Partial charges towards the next reel count for a little of the next step.
    const charge = clamp01((input.alphaCharges ?? 0) / 3) / reels;
    progress = clamp01(secured + charge);
  } else {
    const steps = input.multiplierSteps?.length ? input.multiplierSteps : [1];
    const index = steps.indexOf(input.bravoMultiplier ?? steps[0]);
    progress = steps.length > 1 ? clamp01(Math.max(0, index) / (steps.length - 1)) : 0;
  }

  // Route progress leads; the closing spins add a lift of their own.
  return clamp01((progress * 0.72) + (urgency * 0.28));
}
