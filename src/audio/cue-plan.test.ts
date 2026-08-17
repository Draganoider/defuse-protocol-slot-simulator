import { describe, expect, it } from 'vitest';
import type { SpinResult } from '../engine';
import { createFeatureCompleteCuePlan, createResultCuePlan, createRouteCuePlan, createSpinCuePlan } from './cue-plan';
import { planSpinTiming } from '../presentation/spin-timing';

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

  it('follows the committed reel plan and keeps the mechanism audible while a reel holds', () => {
    const timing = planSpinTiming({ reels: 5, scatterReelIndexes: [0, 1], triggerScatters: 3 });
    const plan = createSpinCuePlan(false, timing);
    const latches = plan.filter((item) => item.cue.startsWith('reel-latch'));
    expect(latches.map((item) => item.delayMs)).toEqual([...timing.reelStopMs]);
    // Reels 3, 4 and 5 all wait on a possible third Signal Core, and each held reel is
    // marked by its own pass of the mechanism as the hold begins.
    const drives = plan.filter((item) => item.cue === 'spin-drive');
    for (const reel of [2, 3, 4]) {
      expect(drives.some((item) => item.delayMs === timing.reelStopMs[reel - 1] + 40)).toBe(true);
    }
    // The mechanism never falls silent while a reel is still turning.
    const driveTimes = [...new Set(drives.map((item) => item.delayMs))].sort((a, b) => a - b);
    for (let index = 1; index < driveTimes.length; index += 1) {
      expect(driveTimes[index] - driveTimes[index - 1]).toBeLessThanOrEqual(700);
    }
    expect(timing.reelStopMs.at(-1)! - driveTimes.at(-1)!).toBeLessThanOrEqual(700);
    expect(plan.map((item) => item.delayMs)).toEqual([...plan].map((item) => item.delayMs).sort((a, b) => a - b));
  });

  it('delays the result cues until the committed presentation ends', () => {
    const winningResult = result({ totalPayout: 20 });
    const held = createResultCuePlan(winningResult, false, 2_000);
    expect(held[0]?.delayMs).toBeGreaterThan(createResultCuePlan(winningResult)[0]?.delayMs ?? 0);
    expect(held[0]?.delayMs).toBeLessThan(2_000);
  });

  it('compresses presentation delays for reduced motion', () => {
    expect(createSpinCuePlan(true).at(-1)?.delayMs).toBeLessThan(createSpinCuePlan(false).at(-1)?.delayMs ?? 0);
    const winningResult = result({ totalPayout: 20 });
    expect(createResultCuePlan(winningResult, true)[0]?.delayMs).toBeLessThan(createResultCuePlan(winningResult, false)[0]?.delayMs ?? 0);
  });
});
