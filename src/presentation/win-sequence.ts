/** How long each winning payline holds before the next one is traced. */
export const WIN_PATH_CYCLE_MS = 900;
/** Longest payline route drawn in one cycle, in milliseconds. */
export const WIN_PATH_DRAW_MS = 620;
/** Delay before a route starts drawing, so its cell lands before the line moves. */
export const WIN_PATH_LEAD_MS = 90;
/** Winning paylines presented per result. The ledger still lists every one. */
export const MAX_PRESENTED_WIN_PATHS = 4;

export interface WinSequenceFrame {
  /** Index into the presented paths, or -1 once the sequence is over. */
  readonly activeIndex: number;
  /** How much of the active route is drawn, from 0 to 1. */
  readonly drawProgress: number;
  /** True once every presented path has had its slot. */
  readonly finished: boolean;
}

const FINISHED: WinSequenceFrame = { activeIndex: -1, drawProgress: 0, finished: true };

/** Total time the presented sequence occupies, in milliseconds. */
export function winSequenceDurationMs(pathCount: number, reducedMotion = false): number {
  const presented = Math.min(Math.max(0, Math.trunc(pathCount)), MAX_PRESENTED_WIN_PATHS);
  if (presented === 0) return 0;
  return reducedMotion ? WIN_PATH_CYCLE_MS : presented * WIN_PATH_CYCLE_MS;
}

function easeOutCubic(value: number) {
  return 1 - ((1 - value) ** 3);
}

/**
 * Decides which payline is being traced and how far along it is. Reduced motion holds the
 * single strongest route fully drawn instead of advancing through the others, which keeps
 * the same committed information on screen without any movement.
 */
export function planWinSequence(elapsedMs: number, pathCount: number, reducedMotion = false): WinSequenceFrame {
  const presented = Math.min(Math.max(0, Math.trunc(pathCount)), MAX_PRESENTED_WIN_PATHS);
  if (presented === 0) return FINISHED;
  if (reducedMotion) return { activeIndex: 0, drawProgress: 1, finished: false };

  const elapsed = Math.max(0, elapsedMs);
  if (elapsed >= presented * WIN_PATH_CYCLE_MS) return FINISHED;

  const activeIndex = Math.min(presented - 1, Math.floor(elapsed / WIN_PATH_CYCLE_MS));
  const cycleElapsed = elapsed - (activeIndex * WIN_PATH_CYCLE_MS);
  const drawProgress = easeOutCubic(
    Math.min(1, Math.max(0, (cycleElapsed - WIN_PATH_LEAD_MS) / WIN_PATH_DRAW_MS)),
  );
  return { activeIndex, drawProgress, finished: false };
}
