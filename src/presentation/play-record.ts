/**
 * A running record of ordinary play on one device.
 *
 * This is browser-local only. It is not shared between visitors, devices, or browsers, and
 * nothing is transmitted anywhere. It resets whenever the build identifier changes, so a
 * new deployment starts from zero rather than mixing figures across game versions.
 *
 * Developer-forced results are never recorded. They consume no randomness and are excluded
 * from simulation, so counting them would misreport the observed return.
 */

export const PLAY_RECORD_STORAGE_KEY = 'defuse-protocol:play-record:v1';

export interface PlayRecord {
  readonly buildId: string;
  /** Paid base spins. Free feature spins are returns, not new stakes. */
  readonly paidSpins: number;
  readonly wagered: number;
  readonly returned: number;
  readonly featuresEntered: number;
  readonly biggestWin: number;
  readonly startedAt: string;
}

export interface RecordedSpin {
  readonly wager: number;
  readonly payout: number;
  readonly paid: boolean;
  readonly enteredFeature?: boolean;
  readonly developerGenerated?: boolean;
}

export function createPlayRecord(buildId: string, startedAt = new Date().toISOString()): PlayRecord {
  return { buildId, paidSpins: 0, wagered: 0, returned: 0, featuresEntered: 0, biggestWin: 0, startedAt };
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Accepts a stored record only when it is complete and matches the current build. */
export function parsePlayRecord(value: unknown, buildId: string): PlayRecord | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Partial<PlayRecord>;
  if (record.buildId !== buildId) return undefined;
  if (!isFiniteNonNegative(record.paidSpins)
    || !isFiniteNonNegative(record.wagered)
    || !isFiniteNonNegative(record.returned)
    || !isFiniteNonNegative(record.featuresEntered)
    || !isFiniteNonNegative(record.biggestWin)
    || typeof record.startedAt !== 'string') return undefined;
  return {
    buildId,
    paidSpins: record.paidSpins,
    wagered: record.wagered,
    returned: record.returned,
    featuresEntered: record.featuresEntered,
    biggestWin: record.biggestWin,
    startedAt: record.startedAt,
  };
}

export function recordSpin(record: PlayRecord, spin: RecordedSpin): PlayRecord {
  if (spin.developerGenerated) return record;
  const wager = spin.paid && isFiniteNonNegative(spin.wager) ? spin.wager : 0;
  const payout = isFiniteNonNegative(spin.payout) ? spin.payout : 0;
  return {
    ...record,
    paidSpins: record.paidSpins + (spin.paid ? 1 : 0),
    wagered: record.wagered + wager,
    returned: record.returned + payout,
    featuresEntered: record.featuresEntered + (spin.enteredFeature ? 1 : 0),
    biggestWin: Math.max(record.biggestWin, payout),
  };
}

/** Returned minus wagered. Negative means the device is down overall. */
export function playRecordNet(record: PlayRecord): number {
  return record.returned - record.wagered;
}

/** Observed return, or undefined until something has actually been staked. */
export function playRecordRtp(record: PlayRecord): number | undefined {
  return record.wagered > 0 ? record.returned / record.wagered : undefined;
}
