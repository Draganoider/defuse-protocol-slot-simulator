import type { CSSProperties } from 'react';
import type { WinPresentation } from '../presentation/win-tier';
import { useCountUp } from './useCountUp';

function formatCredits(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export function WinCelebration({ payout, presentation, replayId, reducedMotion = false }: {
  readonly payout: number;
  readonly presentation: WinPresentation;
  readonly replayId?: string;
  readonly reducedMotion?: boolean;
}) {
  const shownValue = useCountUp(payout, presentation.countDurationMs, reducedMotion, replayId);

  if (presentation.tier !== 'big' && presentation.tier !== 'major') return null;
  return (
    <div className={`dp-win-celebration dp-win-celebration--${presentation.tier}`} aria-hidden="true">
      <span className="dp-win-celebration__wash" />
      <span className="dp-win-celebration__ring" />
      <span className="dp-win-celebration__ring dp-win-celebration__ring--late" />
      <div className="dp-win-celebration__sparks">
        {Array.from({ length: presentation.tier === 'major' ? 18 : 12 }, (_, index) => (
          <i key={index} style={{
            left: `${(index * 37) % 100}%`,
            animationDelay: `${(index % 6) * 90}ms`,
            '--spark-drift': `${((index % 5) - 2) * 18}px`,
          } as CSSProperties} />
        ))}
      </div>
      <p>{presentation.headline}</p>
      <strong>+{formatCredits(shownValue)}</strong>
      <small>virtual credits · {presentation.multiple.toFixed(1)}× wager</small>
    </div>
  );
}
