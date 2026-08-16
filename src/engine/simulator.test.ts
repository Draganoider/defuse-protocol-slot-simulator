import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG, SYMBOL_IDS } from './config';
import { runSimulation } from './simulator';
import { constantStrips, makeConfig } from './test-fixtures';
import { handleSimulationWorkerRequest } from '../worker/simulation-protocol';

const S = SYMBOL_IDS;

describe('high-volume simulator and worker boundary', () => {
  it('reports exact aggregates and zero sampling error for a constant-return fixture', () => {
    const config = makeConfig({
      baseReelStrips: constantStrips([S.RADIO, S.RADIO, S.RADIO, S.RADIO, S.RADIO]),
    });
    const report = runSimulation({ config, seed: 7, paidSpins: 25, route: 'alpha' });
    expect(report).toMatchObject({
      statisticKind: 'observed',
      requestedPaidSpins: 25,
      completedPaidSpins: 25,
      observedRtp: 25,
      returnStdDev: 0,
      rtpStandardError: 0,
      anyPayHitRate: 1,
      profitableHitRate: 1,
      bonusFrequency: 0,
      spinsPerBonus: null,
      maxWin: 500,
    });
    expect(report.routeStats.alpha).toMatchObject({
      totalWagered: 500,
      totalPayout: 12_500,
      bonusEntries: 0,
      featurePayout: 0,
      averageFeaturePayout: 0,
    });
    expect(report.routeStats.bravo).toBeNull();
  });

  it('is deterministic for a fixed request and records a stable aggregate vector', () => {
    const request = { seed: 'simulation-golden', paidSpins: 1_000, route: 'bravo' as const };
    const first = runSimulation(request);
    const second = runSimulation(request);
    expect(second).toEqual(first);
    expect(first.seed).toBe('0x961a6a30');
    expect(first.routeStats.bravo).toMatchObject({
      paidSpins: 1_000,
      totalWagered: 20_000,
      totalPayout: 10_296,
      observedRtp: 0.5148,
      bonusEntries: 5,
      bonusSpins: 34,
      retriggers: 1,
      maxWin: 2_899,
      featurePayout: 4_788,
      averageFeaturePayout: 957.6,
    });
    expect(first.returnStdDev).toBeGreaterThanOrEqual(0);
    expect(first.rtpStandardError).toBe(first.returnStdDev / Math.sqrt(1_000));
    expect(JSON.stringify(first)).not.toContain('developerGenerated');
  });

  it('produces byte-for-byte identical main-thread and pure worker-boundary reports', () => {
    const payload = { seed: 'worker-parity', paidSpins: 333, route: 'alpha' as const };
    const workerResponse = handleSimulationWorkerRequest({ type: 'simulate', requestId: 'qa-1', payload });
    expect(workerResponse).toEqual({
      type: 'complete',
      requestId: 'qa-1',
      report: runSimulation(payload),
    });
  });

  it('rejects invalid sizes/routes and maps errors at the worker boundary', () => {
    expect(() => runSimulation({ seed: 1, paidSpins: 0, route: 'alpha' })).toThrow(/positive safe integer/);
    expect(() => runSimulation({ seed: 1, paidSpins: 1, route: 'invalid' as 'alpha' })).toThrow(/alpha or bravo/);
    expect(() => runSimulation({ seed: 1, paidSpins: Number.MAX_SAFE_INTEGER, route: 'alpha' })).toThrow(/total wager/);
    const response = handleSimulationWorkerRequest({
      type: 'simulate',
      requestId: 'qa-error',
      payload: { seed: 1, paidSpins: 1, route: 'alpha', config: { ...DEFAULT_GAME_CONFIG, rows: 2 } as unknown as typeof DEFAULT_GAME_CONFIG },
    });
    expect(response).toMatchObject({
      type: 'error',
      requestId: 'qa-error',
      error: {
        code: 'INVALID_CONFIG',
        issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_LAYOUT', path: 'reels/rows' })]),
      },
    });
  });
});
