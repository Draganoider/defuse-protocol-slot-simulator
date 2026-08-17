import { describe, expect, it } from 'vitest';
import {
  ANTICIPATION_HOLD_MS,
  AWARD_ANTICIPATION_HOLD_MS,
  DEFAULT_PRESENTATION_MS,
  planSpinTiming,
  REEL_BASE_MS,
  REEL_STAGGER_MS,
} from './spin-timing';

function plan(scatterReelIndexes: readonly number[]) {
  return planSpinTiming({ reels: 5, scatterReelIndexes, triggerScatters: 3, maxAwardScatters: 5 });
}

describe('committed spin timing', () => {
  it('keeps the natural cadence when no trigger is pending', () => {
    const timing = plan([]);
    expect(timing.anticipation).toEqual(['none', 'none', 'none', 'none', 'none']);
    expect(timing.reelStopMs).toEqual([0, 1, 2, 3, 4].map((reel) => REEL_BASE_MS + reel * REEL_STAGGER_MS));
    expect(timing.presentationMs).toBe(DEFAULT_PRESENTATION_MS);
    expect(timing.hasAnticipation).toBe(false);
  });

  it('holds only the reels that follow the second scatter', () => {
    const timing = plan([1, 2]);
    expect(timing.anticipation).toEqual(['none', 'none', 'none', 'trigger', 'trigger']);
    expect(timing.reelStopMs[2]).toBe(REEL_BASE_MS + 2 * REEL_STAGGER_MS);
    expect(timing.reelStopMs[3]).toBe(REEL_BASE_MS + 3 * REEL_STAGGER_MS + ANTICIPATION_HOLD_MS);
    expect(timing.reelStopMs[4]).toBe(REEL_BASE_MS + 4 * REEL_STAGGER_MS + 2 * ANTICIPATION_HOLD_MS);
    expect(timing.presentationMs).toBeGreaterThan(DEFAULT_PRESENTATION_MS);
  });

  it('switches to the shorter award hold once the trigger is committed', () => {
    // Cores on the first three reels: reel three waited for the trigger, and reels four
    // and five then wait for a fourth and fifth Core, which award more free spins.
    const timing = plan([0, 1, 2]);
    expect(timing.anticipation).toEqual(['none', 'none', 'trigger', 'award', 'award']);
    expect(timing.reelStopMs[4]).toBe(
      REEL_BASE_MS + (4 * REEL_STAGGER_MS) + ANTICIPATION_HOLD_MS + (2 * AWARD_ANTICIPATION_HOLD_MS),
    );
  });

  it('stops waiting once no further scatter can raise the award', () => {
    // With the award capped at four, a reel that follows four landed Cores has nothing
    // left to wait for, while the same layout under a cap of five still waits.
    const capped = planSpinTiming({ reels: 5, scatterReelIndexes: [0, 1, 2, 3], triggerScatters: 3, maxAwardScatters: 4 });
    expect(capped.anticipation).toEqual(['none', 'none', 'trigger', 'award', 'none']);
    expect(plan([0, 1, 2, 3]).anticipation.at(-1)).toBe('award');
  });

  it('keeps the award hold shorter than the trigger hold', () => {
    expect(AWARD_ANTICIPATION_HOLD_MS).toBeLessThan(ANTICIPATION_HOLD_MS);
  });

  it('anticipates from the second reel when both scatters land first', () => {
    expect(plan([0, 0]).anticipation).toEqual(['none', 'trigger', 'trigger', 'trigger', 'trigger']);
  });

  it('never anticipates the opening reel and keeps stop times increasing', () => {
    for (const scatters of [[], [0], [4], [0, 4], [1, 3], [0, 1, 2, 3, 4]]) {
      const timing = plan(scatters);
      expect(timing.anticipation[0]).toBe('none');
      for (let reel = 1; reel < timing.reelStopMs.length; reel += 1) {
        expect(timing.reelStopMs[reel]).toBeGreaterThan(timing.reelStopMs[reel - 1]);
      }
    }
  });

  it('ignores scatter positions outside the declared reel count', () => {
    expect(plan([-1, 9, 42]).hasAnticipation).toBe(false);
  });
});
