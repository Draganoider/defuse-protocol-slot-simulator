export type WinTier = 'none' | 'standard' | 'strong' | 'big' | 'major';

export interface WinPresentation {
  readonly tier: WinTier;
  readonly multiple: number;
  readonly headline: string;
  readonly durationMs: number;
}

/** Presentation-only classification derived from an already committed return. */
export function classifyWin(totalPayout: number, wager: number): WinPresentation {
  const multiple = wager > 0 && totalPayout > 0 ? totalPayout / wager : 0;
  if (multiple >= 25) return { tier: 'major', multiple, headline: 'Major recovery', durationMs: 2_600 };
  if (multiple >= 10) return { tier: 'big', multiple, headline: 'Big win', durationMs: 2_150 };
  if (multiple >= 5) return { tier: 'strong', multiple, headline: 'Strong return', durationMs: 1_350 };
  if (multiple > 0) return { tier: 'standard', multiple, headline: 'Return confirmed', durationMs: 850 };
  return { tier: 'none', multiple: 0, headline: 'No return', durationMs: 0 };
}
