import { describe, expect, it } from 'vitest';
import {
  ANTICIPATION_HOLD_MS,
  DEFAULT_PRESENTATION_MS,
  planSpinTiming,
  REEL_BASE_MS,
  REEL_STAGGER_MS,
} from './spin-timing';

function plan(scatterReelIndexes: readonly number[]) {
  return planSpinTiming({ reels: 5, scatterReelIndexes, triggerScatters: 3 });
}

describe('committed spin timing', () => {
  it('keeps the natural cadence when no trigger is pending', () => {
    const timing = plan([]);
    expect(timing.anticipatedReels).toEqual([false, false, false, false, false]);
    expect(timing.reelStopMs).toEqual([0, 1, 2, 3, 4].map((reel) => REEL_BASE_MS + reel * REEL_STAGGER_MS));
    expect(timing.presentationMs).toBe(DEFAULT_PRESENTATION_MS);
    expect(timing.hasAnticipation).toBe(false);
  });

  it('holds only the reels that follow the second scatter', () => {
    const timing = plan([1, 2]);
    expect(timing.anticipatedReels).toEqual([false, false, false, true, true]);
    expect(timing.reelStopMs[2]).toBe(REEL_BASE_MS + 2 * REEL_STAGGER_MS);
    expect(timing.reelStopMs[3]).toBe(REEL_BASE_MS + 3 * REEL_STAGGER_MS + ANTICIPATION_HOLD_MS);
    expect(timing.reelStopMs[4]).toBe(REEL_BASE_MS + 4 * REEL_STAGGER_MS + 2 * ANTICIPATION_HOLD_MS);
    expect(timing.presentationMs).toBeGreaterThan(DEFAULT_PRESENTATION_MS);
  });

  it('stops anticipating once the trigger is already committed', () => {
    const timing = plan([0, 1, 2]);
    expect(timing.anticipatedReels).toEqual([false, false, true, false, false]);
    expect(timing.reelStopMs[4]).toBe(REEL_BASE_MS + 4 * REEL_STAGGER_MS + ANTICIPATION_HOLD_MS);
  });

  it('anticipates from the second reel when both scatters land first', () => {
    expect(plan([0, 0]).anticipatedReels).toEqual([false, true, true, true, true]);
  });

  it('never anticipates the opening reel and keeps stop times increasing', () => {
    for (const scatters of [[], [0], [4], [0, 4], [1, 3], [0, 1, 2, 3, 4]]) {
      const timing = plan(scatters);
      expect(timing.anticipatedReels[0]).toBe(false);
      for (let reel = 1; reel < timing.reelStopMs.length; reel += 1) {
        expect(timing.reelStopMs[reel]).toBeGreaterThan(timing.reelStopMs[reel - 1]);
      }
    }
  });

  it('ignores scatter positions outside the declared reel count', () => {
    expect(plan([-1, 9, 42]).hasAnticipation).toBe(false);
  });
});
