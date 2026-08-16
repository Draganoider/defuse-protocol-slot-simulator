import { useEffect, useState } from 'react';

/**
 * Rolls a display value up to an already committed payout. This is presentation only:
 * the authoritative total is applied to the balance and announced before the roll starts,
 * so nothing depends on the animation completing.
 */
export function useCountUp(target: number, durationMs: number, reducedMotion = false, resetKey?: string): number {
  const [shown, setShown] = useState(reducedMotion ? target : 0);

  useEffect(() => {
    if (reducedMotion || durationMs <= 0 || target <= 0) {
      setShown(target);
      return undefined;
    }
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      // Ease in and out so a long count builds instead of resolving in its first third.
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - (((-2 * progress) + 2) ** 2) / 2;
      setShown(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [durationMs, reducedMotion, resetKey, target]);

  return shown;
}
