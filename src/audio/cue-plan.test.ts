import { describe, expect, it } from 'vitest';
import type { SpinResult } from '../engine';
import { createFeatureCompleteCuePlan, createResultCuePlan, createRouteCuePlan, createSpinCuePlan } from './cue-plan';

function result(overrides: Partial<SpinResult> = {}): SpinResult {
  return {
    wager: 20,
    totalPayout: 0,
    ...overrides,
  } as SpinResult;
}

describe('audio cue planning', () => {
  it('schedules one drive and five ordered reel latches', () => {
    const plan = createSpinCuePlan();
    expect(plan.map((item) => item.cue)).toEqual([
      'spin-drive',
      'reel-latch-1',
      'reel-latch-2',
      'reel-latch-3',
      'reel-latch-4',
      'reel-latch-5',
    ]);
    expect(plan.map((item) => item.delayMs)).toEqual([...plan].map((item) => item.delayMs).sort((a, b) => a - b));
  });

  it('keeps dry results silent and uses the committed payout tiers', () => {
    expect(createResultCuePlan(result()).map((item) => item.cue)).toEqual([]);
    expect(createResultCuePlan(result({ totalPayout: 20 })).map((item) => item.cue)).toContain('win-small');
    expect(createResultCuePlan(result({ totalPayout: 40 })).map((item) => item.cue)).toContain('win-medium');
    expect(createResultCuePlan(result({ totalPayout: 100 })).map((item) => item.cue)).toContain('win-large');
    expect(createResultCuePlan(result({ totalPayout: 200 })).map((item) => item.cue)).toContain('win-big');
    expect(createResultCuePlan(result({ totalPayout: 500 })).map((item) => item.cue)).toContain('win-major');
  });

  it('adds a CORE cue only when the engine result reports a feature event', () => {
    expect(createResultCuePlan(result({ bonusOffer: { source: 'generated', scatterCount: 3, alphaSpins: 10, bravoSpins: 6 } }))).toEqual(expect.arrayContaining([
      expect.objectContaining({ cue: 'core-activation' }),
    ]));
    expect(createResultCuePlan(result()).some((item) => item.cue === 'core-activation')).toBe(false);
  });

  it('selects a distinct route confirmation without changing any game state', () => {
    expect(createRouteCuePlan('alpha')[0]?.cue).toBe('relay-alpha');
    expect(createRouteCuePlan('bravo')[0]?.cue).toBe('relay-bravo');
  });

  it('adds dedicated retrigger and feature-complete confirmations', () => {
    const retrigger = createResultCuePlan(result({ bonusEvent: { retriggered: true, coresCollected: 3 } } as Partial<SpinResult>));
    expect(retrigger.map((item) => item.cue)).toContain('feature-retrigger');
    expect(createFeatureCompleteCuePlan()[0]?.cue).toBe('feature-complete');
  });

  it('compresses presentation delays for reduced motion', () => {
    expect(createSpinCuePlan(true).at(-1)?.delayMs).toBeLessThan(createSpinCuePlan(false).at(-1)?.delayMs ?? 0);
    const winningResult = result({ totalPayout: 20 });
    expect(createResultCuePlan(winningResult, true)[0]?.delayMs).toBeLessThan(createResultCuePlan(winningResult, false)[0]?.delayMs ?? 0);
  });
});
