import { describe, expect, it } from 'vitest';
import {
  defaultPresentationMs,
  DEFAULT_SPIN_SPEED,
  isSpinSpeed,
  naturalSpinTiming,
  planSpinTiming,
  SPIN_SPEEDS,
  type SpinSpeed,
} from './spin-timing';

const STANDARD = SPIN_SPEEDS.standard;

function plan(scatterReelIndexes: readonly number[], speed: SpinSpeed = 'standard') {
  return planSpinTiming({ reels: 5, scatterReelIndexes, triggerScatters: 3, maxAwardScatters: 5, speed });
}

describe('committed spin timing', () => {
  it('keeps the natural cadence when no trigger is pending', () => {
    const timing = plan([]);
    expect(timing.anticipation).toEqual(['none', 'none', 'none', 'none', 'none']);
    expect(timing.reelStopMs).toEqual([0, 1, 2, 3, 4].map((reel) => STANDARD.reelBaseMs + reel * STANDARD.reelStaggerMs));
    expect(timing.reelDurationMs).toEqual(timing.reelStopMs);
    expect(timing.presentationMs).toBe(defaultPresentationMs('standard'));
    expect(timing.hasAnticipation).toBe(false);
  });

  it('holds only the reels that follow the second scatter', () => {
    const timing = plan([1, 2]);
    expect(timing.anticipation).toEqual(['none', 'none', 'none', 'trigger', 'trigger']);
    expect(timing.reelStopMs[2]).toBe(STANDARD.reelBaseMs + 2 * STANDARD.reelStaggerMs);
    expect(timing.reelStopMs[3]).toBe(STANDARD.reelBaseMs + 3 * STANDARD.reelStaggerMs + STANDARD.anticipationHoldMs);
    expect(timing.reelStopMs[4]).toBe(STANDARD.reelBaseMs + 4 * STANDARD.reelStaggerMs + 2 * STANDARD.anticipationHoldMs);
    expect(timing.presentationMs).toBeGreaterThan(defaultPresentationMs('standard'));
    // A held reel still settles over its own duration; only its start is pushed back.
    expect(timing.reelDurationMs[4]).toBe(STANDARD.reelBaseMs + 4 * STANDARD.reelStaggerMs);
  });

  it('switches to the shorter award hold once the trigger is committed', () => {
    // Cores on the first three reels: reel three waited for the trigger, and reels four
    // and five then wait for a fourth and fifth Core, which award more free spins.
    const timing = plan([0, 1, 2]);
    expect(timing.anticipation).toEqual(['none', 'none', 'trigger', 'award', 'award']);
    expect(timing.reelStopMs[4]).toBe(
      STANDARD.reelBaseMs + (4 * STANDARD.reelStaggerMs) + STANDARD.anticipationHoldMs + (2 * STANDARD.awardAnticipationHoldMs),
    );
  });

  it('stops waiting once no further scatter can raise the award', () => {
    const capped = planSpinTiming({ reels: 5, scatterReelIndexes: [0, 1, 2, 3], triggerScatters: 3, maxAwardScatters: 4 });
    expect(capped.anticipation).toEqual(['none', 'none', 'trigger', 'award', 'none']);
    expect(plan([0, 1, 2, 3]).anticipation.at(-1)).toBe('award');
  });

  it('anticipates from the second reel when both scatters land first', () => {
    expect(plan([0, 0]).anticipation).toEqual(['none', 'trigger', 'trigger', 'trigger', 'trigger']);
  });

  it('never anticipates the opening reel and keeps stop times increasing', () => {
    for (const speed of ['standard', 'turbo'] as const) {
      for (const scatters of [[], [0], [4], [0, 4], [1, 3], [0, 1, 2, 3, 4]]) {
        const timing = plan(scatters, speed);
        expect(timing.anticipation[0]).toBe('none');
        for (let reel = 1; reel < timing.reelStopMs.length; reel += 1) {
          expect(timing.reelStopMs[reel]).toBeGreaterThan(timing.reelStopMs[reel - 1]);
        }
      }
    }
  });

  it('ignores scatter positions outside the declared reel count', () => {
    expect(plan([-1, 9, 42]).hasAnticipation).toBe(false);
  });
});

describe('spin speed', () => {
  it('defaults to the longer presentation', () => {
    expect(DEFAULT_SPIN_SPEED).toBe('standard');
    expect(naturalSpinTiming().speed).toBe('standard');
  });

  it('makes turbo shorter than standard at every stage', () => {
    const { standard, turbo } = SPIN_SPEEDS;
    expect(turbo.reelBaseMs).toBeLessThan(standard.reelBaseMs);
    expect(turbo.reelStaggerMs).toBeLessThan(standard.reelStaggerMs);
    expect(turbo.anticipationHoldMs).toBeLessThan(standard.anticipationHoldMs);
    expect(turbo.awardAnticipationHoldMs).toBeLessThan(standard.awardAnticipationHoldMs);
    expect(defaultPresentationMs('turbo')).toBeLessThan(defaultPresentationMs('standard'));
  });

  it('keeps the award hold shorter than the trigger hold in both speeds', () => {
    for (const profile of Object.values(SPIN_SPEEDS)) {
      expect(profile.awardAnticipationHoldMs).toBeLessThan(profile.anticipationHoldMs);
    }
  });

  it('reports which speed a plan was built for, and applies that speed throughout', () => {
    const turbo = plan([1, 2], 'turbo');
    expect(turbo.speed).toBe('turbo');
    expect(turbo.reelStopMs[3]).toBe(
      SPIN_SPEEDS.turbo.reelBaseMs + 3 * SPIN_SPEEDS.turbo.reelStaggerMs + SPIN_SPEEDS.turbo.anticipationHoldMs,
    );
    expect(turbo.presentationMs).toBeLessThan(plan([1, 2], 'standard').presentationMs);
  });

  it('only accepts declared speeds', () => {
    expect(isSpinSpeed('standard')).toBe(true);
    expect(isSpinSpeed('turbo')).toBe(true);
    for (const value of ['fast', '', null, undefined, 2]) expect(isSpinSpeed(value)).toBe(false);
  });
});
