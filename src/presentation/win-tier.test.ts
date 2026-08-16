import { describe, expect, it } from 'vitest';
import { classifyWin } from './win-tier';

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
});
