export type WinTier = 'none' | 'standard' | 'strong' | 'big' | 'major';

export interface WinPresentation {
  readonly tier: WinTier;
  readonly multiple: number;
  readonly headline: string;
  readonly durationMs: number;
  /** How long the celebration counter takes to reach the committed payout. */
  readonly countDurationMs: number;
}

/**
 * How long each tier holds its celebration. Larger returns stay on screen long enough to
 * be read before play continues, and the same values gate the canvas effects and the
 * automatic feature-spin interval so every layer clears together.
 */
export const WIN_TIER_DURATION_MS: Readonly<Record<WinTier, number>> = {
  none: 0,
  standard: 850,
  strong: 1_900,
  big: 3_600,
  major: 5_200,
};

/** How long the counted total takes to reach the committed payout, per tier. */
export const WIN_TIER_COUNT_MS: Readonly<Record<WinTier, number>> = {
  none: 0,
  standard: 520,
  strong: 950,
  big: 1_950,
  major: 2_900,
};

const HEADLINES: Readonly<Record<WinTier, string>> = {
  none: 'No return',
  standard: 'Return confirmed',
  strong: 'Strong return',
  big: 'Big win',
  major: 'Major recovery',
};

function present(tier: WinTier, multiple: number): WinPresentation {
  return {
    tier,
    multiple,
    headline: HEADLINES[tier],
    durationMs: WIN_TIER_DURATION_MS[tier],
    countDurationMs: WIN_TIER_COUNT_MS[tier],
  };
}

/** Presentation-only classification derived from an already committed return. */
export function classifyWin(totalPayout: number, wager: number): WinPresentation {
  const multiple = wager > 0 && totalPayout > 0 ? totalPayout / wager : 0;
  if (multiple >= 25) return present('major', multiple);
  if (multiple >= 10) return present('big', multiple);
  if (multiple >= 5) return present('strong', multiple);
  if (multiple > 0) return present('standard', multiple);
  return present('none', 0);
}
