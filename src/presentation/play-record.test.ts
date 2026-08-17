import { describe, expect, it } from 'vitest';
import {
  createPlayRecord,
  parsePlayRecord,
  playRecordNet,
  playRecordRtp,
  recordSpin,
} from './play-record';

const BUILD = 'build-a';

describe('local play record', () => {
  it('starts empty and reports no observed return until something is staked', () => {
    const record = createPlayRecord(BUILD, '2026-08-17T00:00:00.000Z');
    expect(record).toMatchObject({ paidSpins: 0, wagered: 0, returned: 0, featuresEntered: 0, biggestWin: 0 });
    expect(playRecordNet(record)).toBe(0);
    expect(playRecordRtp(record)).toBeUndefined();
  });

  it('accumulates stake, return, features, and the largest single win', () => {
    let record = createPlayRecord(BUILD);
    record = recordSpin(record, { wager: 20, payout: 0, paid: true });
    record = recordSpin(record, { wager: 20, payout: 140, paid: true, enteredFeature: true });
    record = recordSpin(record, { wager: 20, payout: 60, paid: true });

    expect(record).toMatchObject({ paidSpins: 3, wagered: 60, returned: 200, featuresEntered: 1, biggestWin: 140 });
    expect(playRecordNet(record)).toBe(140);
    expect(playRecordRtp(record)).toBeCloseTo(200 / 60, 10);
  });

  it('counts free feature spins as return without adding a new stake', () => {
    let record = createPlayRecord(BUILD);
    record = recordSpin(record, { wager: 20, payout: 0, paid: true });
    record = recordSpin(record, { wager: 20, payout: 500, paid: false });

    expect(record).toMatchObject({ paidSpins: 1, wagered: 20, returned: 500 });
    expect(playRecordRtp(record)).toBe(25);
  });

  it('reports a negative net when the device is down overall', () => {
    let record = createPlayRecord(BUILD);
    for (let spin = 0; spin < 10; spin += 1) record = recordSpin(record, { wager: 20, payout: 4, paid: true });
    expect(playRecordNet(record)).toBe(-160);
    expect(playRecordRtp(record)).toBeCloseTo(0.2, 10);
  });

  it('never records a developer-forced result', () => {
    const record = createPlayRecord(BUILD);
    const forced = recordSpin(record, { wager: 20, payout: 5_000, paid: false, developerGenerated: true });
    expect(forced).toEqual(record);
  });

  it('ignores a stored record from a different build', () => {
    const stored = createPlayRecord('build-a');
    expect(parsePlayRecord(stored, 'build-a')).toEqual(stored);
    expect(parsePlayRecord(stored, 'build-b')).toBeUndefined();
  });

  it('rejects malformed or incomplete stored values', () => {
    expect(parsePlayRecord(null, BUILD)).toBeUndefined();
    expect(parsePlayRecord('not an object', BUILD)).toBeUndefined();
    expect(parsePlayRecord({ buildId: BUILD }, BUILD)).toBeUndefined();
    expect(parsePlayRecord({ ...createPlayRecord(BUILD), wagered: -5 }, BUILD)).toBeUndefined();
    expect(parsePlayRecord({ ...createPlayRecord(BUILD), returned: Number.NaN }, BUILD)).toBeUndefined();
  });
});
