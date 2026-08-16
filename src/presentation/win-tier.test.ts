import { describe, expect, it } from 'vitest';
import { classifyWin, WIN_TIER_COUNT_MS, WIN_TIER_DURATION_MS } from './win-tier';

describe('committed win presentation tiers', () => {
  it('classifies boundaries from payout divided by wager', () => {
    expect(classifyWin(0, 20).tier).toBe('none');
    expect(classifyWin(99, 20).tier).toBe('standard');
    expect(classifyWin(100, 20).tier).toBe('strong');
    expect(classifyWin(200, 20).tier).toBe('big');
    expect(classifyWin(500, 20).tier).toBe('major');
  });

  it('does not classify invalid zero-wager input as a win', () => {
    expect(classifyWin(500, 0)).toMatchObject({ tier: 'none', multiple: 0 });
  });

  it('gives larger returns a longer hold and a longer counted total', () => {
    const tiers = ['standard', 'strong', 'big', 'major'] as const;
    const durations = tiers.map((tier) => WIN_TIER_DURATION_MS[tier]);
    const counts = tiers.map((tier) => WIN_TIER_COUNT_MS[tier]);
    expect(durations).toEqual([...durations].sort((left, right) => left - right));
    expect(counts).toEqual([...counts].sort((left, right) => left - right));
    tiers.forEach((tier, index) => expect(counts[index]).toBeLessThan(durations[index]));
    expect(WIN_TIER_DURATION_MS.none).toBe(0);
    expect(WIN_TIER_COUNT_MS.none).toBe(0);
  });

  it('reports the tier hold and count duration on every classification', () => {
    expect(classifyWin(500, 20)).toMatchObject({
      durationMs: WIN_TIER_DURATION_MS.major,
      countDurationMs: WIN_TIER_COUNT_MS.major,
    });
  });
});
