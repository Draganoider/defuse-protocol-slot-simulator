import { describe, expect, it } from 'vitest';
import {
  MAX_PRESENTED_WIN_PATHS,
  planWinSequence,
  WIN_PATH_CYCLE_MS,
  winSequenceDurationMs,
} from './win-sequence';

describe('winning payline sequence', () => {
  it('reports nothing to trace without a winning line', () => {
    expect(planWinSequence(0, 0)).toMatchObject({ activeIndex: -1, finished: true });
    expect(winSequenceDurationMs(0)).toBe(0);
  });

  it('advances one payline per cycle in order', () => {
    expect(planWinSequence(0, 3).activeIndex).toBe(0);
    expect(planWinSequence(WIN_PATH_CYCLE_MS - 1, 3).activeIndex).toBe(0);
    expect(planWinSequence(WIN_PATH_CYCLE_MS, 3).activeIndex).toBe(1);
    expect(planWinSequence(WIN_PATH_CYCLE_MS * 2, 3).activeIndex).toBe(2);
  });

  it('draws each route from its start to its full length within a cycle', () => {
    expect(planWinSequence(0, 2).drawProgress).toBe(0);
    const middle = planWinSequence(WIN_PATH_CYCLE_MS * 0.5, 2).drawProgress;
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(1);
    expect(planWinSequence(WIN_PATH_CYCLE_MS - 1, 2).drawProgress).toBe(1);
    // Each new cycle restarts its own route rather than continuing the previous one.
    expect(planWinSequence(WIN_PATH_CYCLE_MS, 2).drawProgress).toBe(0);
  });

  it('finishes once every presented path has had its slot', () => {
    expect(planWinSequence(WIN_PATH_CYCLE_MS * 2 - 1, 2).finished).toBe(false);
    expect(planWinSequence(WIN_PATH_CYCLE_MS * 2, 2)).toEqual({ activeIndex: -1, drawProgress: 0, finished: true });
    expect(winSequenceDurationMs(2)).toBe(WIN_PATH_CYCLE_MS * 2);
  });

  it('presents at most four paylines however many the result contains', () => {
    expect(winSequenceDurationMs(20)).toBe(WIN_PATH_CYCLE_MS * MAX_PRESENTED_WIN_PATHS);
    expect(planWinSequence(WIN_PATH_CYCLE_MS * MAX_PRESENTED_WIN_PATHS, 20).finished).toBe(true);
    expect(planWinSequence(WIN_PATH_CYCLE_MS * (MAX_PRESENTED_WIN_PATHS - 1), 20).activeIndex)
      .toBe(MAX_PRESENTED_WIN_PATHS - 1);
  });

  it('holds the strongest route fully drawn for reduced motion', () => {
    for (const elapsed of [0, 500, 10_000]) {
      expect(planWinSequence(elapsed, 4, true)).toEqual({ activeIndex: 0, drawProgress: 1, finished: false });
    }
    expect(winSequenceDurationMs(4, true)).toBe(WIN_PATH_CYCLE_MS);
  });
});
