import { describe, expect, it } from 'vitest';
import * as publicEngine from './index';
import { calculateBaseTheoreticalStats } from './analysis';
import { DEFAULT_GAME_CONFIG, SYMBOL_IDS, assertValidWager, hashConfig, validateConfig } from './config';
import { evaluateGrid } from './evaluate';
import { PAYLINES_20 } from './paylines';
import { buildGrid } from './reels';
import { createRng, normalizeSeed } from './rng';
import { createSession, spinBase } from './session';
import { constantStrips, makeConfig } from './test-fixtures';
import { RNG_ALGORITHM, type GameConfig, type RngSnapshot } from './types';

const S = SYMBOL_IDS;

function issueCodes(config: GameConfig): readonly string[] {
  const result = validateConfig(config);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('configuration and declared line model', () => {
  it('accepts the standard config with a stable hash and exactly 20 unique paylines', () => {
    const result = validateConfig(DEFAULT_GAME_CONFIG);
    expect(result).toEqual({ ok: true, configHash: hashConfig(DEFAULT_GAME_CONFIG) });
    expect(PAYLINES_20).toHaveLength(20);
    expect(new Set(PAYLINES_20.map((line) => line.join(','))).size).toBe(20);
    expect(PAYLINES_20[0]).toEqual([0, 0, 0, 0, 0]);
    expect(PAYLINES_20[19]).toEqual([0, 2, 2, 2, 0]);
  });

  it('reports structured issues for unsupported versions, references, dimensions and values', () => {
    expect(issueCodes({ ...DEFAULT_GAME_CONFIG, schemaVersion: '2' } as unknown as GameConfig)).toContain('UNSUPPORTED_SCHEMA');
    expect(issueCodes({ ...DEFAULT_GAME_CONFIG, rows: 0 } as unknown as GameConfig)).toContain('INVALID_LAYOUT');
    expect(issueCodes(makeConfig({ baseReelStrips: [['UNKNOWN'], ...DEFAULT_GAME_CONFIG.baseReelStrips.slice(1)] }))).toContain('UNKNOWN_SYMBOL');
    expect(issueCodes(makeConfig({ bonusReelStrips: { ...DEFAULT_GAME_CONFIG.bonusReelStrips, alpha: [[], ...DEFAULT_GAME_CONFIG.bonusReelStrips.alpha.slice(1)] } }))).toContain('EMPTY_REEL');
    expect(issueCodes(makeConfig({ paylines: [PAYLINES_20[0], ...PAYLINES_20.slice(0, 19)] }))).toContain('DUPLICATE_PAYLINE');
    expect(issueCodes({ ...DEFAULT_GAME_CONFIG, bonus: { ...DEFAULT_GAME_CONFIG.bonus, maxAwardedSpins: 0 } })).toContain('INVALID_BONUS_CAP');
    expect(issueCodes({ ...DEFAULT_GAME_CONFIG, bonus: { ...DEFAULT_GAME_CONFIG.bonus, alphaChargesPerSecuredReel: 1 } })).toContain('INVALID_ALPHA_CHARGES');
    expect(issueCodes(makeConfig({ baseReelStrips: constantStrips([S.CORE, S.CORE, S.CORE, S.CORE, S.CORE]) }))).toContain('AMBIGUOUS_BASE_SCATTERS');
  });
  it('returns a structured issue for malformed runtime configuration data', () => {
    const malformed = validateConfig({ ...DEFAULT_GAME_CONFIG, symbols: undefined } as unknown as GameConfig);
    expect(malformed).toEqual({
      ok: false,
      issues: [{ code: 'MALFORMED_CONFIG', path: '', message: expect.any(String) }],
    });
  });

  it('rejects invalid paytable awards, unsafe payouts and wagers', () => {
    const negativePaytable = { ...DEFAULT_GAME_CONFIG.paytable, [S.RADIO]: { 3: -1, 4: 8, 5: 25 } };
    expect(issueCodes(makeConfig({ paytable: negativePaytable }))).toContain('INVALID_AWARD');
    const unsafePaytable = { ...DEFAULT_GAME_CONFIG.paytable, [S.RECOVERY]: { 3: 35, 4: 150, 5: Number.MAX_SAFE_INTEGER } };
    expect(issueCodes(makeConfig({ paytable: unsafePaytable }))).toContain('PAYOUT_OVERFLOW');
    expect(() => assertValidWager(DEFAULT_GAME_CONFIG, 21)).toThrow(/integer multiple/);
    expect(assertValidWager(DEFAULT_GAME_CONFIG, 40)).toBe(2);
  });

  it('exactly analyzes a constant toy configuration', () => {
    const config = makeConfig({ baseReelStrips: constantStrips([S.RADIO, S.RADIO, S.RADIO, S.RADIO, S.RADIO]) });
    const stats = calculateBaseTheoreticalStats(config);
    expect(stats.expectedBasePayout).toBe(500);
    expect(stats.baseGameRtp).toBe(25);
    expect(stats.bonusEntryProbability).toBe(0);
    expect(stats.spinsPerBonus).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('payline, wild and scatter evaluation', () => {
  it('pays the longest left-to-right match on each declared line and scales the multiplier', () => {
    const grid = [
      [S.RADIO, S.KEYCARD, S.ARMOR],
      [S.RADIO, S.OPTIC, S.SIDEARM],
      [S.RADIO, S.KNIFE, S.CARBINE],
      [S.RADIO, S.PRECISION, S.RECOVERY],
      [S.RADIO, S.KEYCARD, S.ARMOR],
    ];
    const evaluation = evaluateGrid(DEFAULT_GAME_CONFIG, grid, 2, 3);
    const top = evaluation.lineWins.find((win) => win.lineIndex === 0);
    expect(top).toMatchObject({ symbolId: S.RADIO, count: 5, lineBet: 2, multiplier: 3, payout: 150 });
  });

  it('uses leading wilds as substitutes and values an all-wild prefix by its best award', () => {
    const substitutionGrid = [
      [S.WILD, S.KEYCARD, S.ARMOR],
      [S.WILD, S.OPTIC, S.SIDEARM],
      [S.PRECISION, S.KNIFE, S.CARBINE],
      [S.PRECISION, S.RADIO, S.KEYCARD],
      [S.RADIO, S.ARMOR, S.OPTIC],
    ];
    expect(evaluateGrid(DEFAULT_GAME_CONFIG, substitutionGrid, 1).lineWins.find((win) => win.lineIndex === 0))
      .toMatchObject({ symbolId: S.PRECISION, count: 4, payout: 100 });
    const allWildGrid = substitutionGrid.map((reel, index) => index < 3
      ? [S.WILD, ...reel.slice(1)]
      : index === 3 ? [S.CORE, ...reel.slice(1)] : reel);
    expect(evaluateGrid(DEFAULT_GAME_CONFIG, allWildGrid, 1).lineWins.find((win) => win.lineIndex === 0))
      .toMatchObject({ symbolId: S.RECOVERY, count: 3, payout: 35 });
  });

  it('counts scatter positions independently and never substitutes scatters on lines', () => {
    const grid = [
      [S.CORE, S.RADIO, S.CORE],
      [S.CORE, S.KEYCARD, S.ARMOR],
      [S.RADIO, S.OPTIC, S.SIDEARM],
      [S.RADIO, S.KNIFE, S.CARBINE],
      [S.RADIO, S.PRECISION, S.RECOVERY],
    ];
    const evaluation = evaluateGrid(DEFAULT_GAME_CONFIG, grid, 1);
    expect(evaluation.scatter).toMatchObject({ count: 3, triggered: true });
    expect(evaluation.scatter.positions).toEqual([
      { reel: 0, row: 0 }, { reel: 0, row: 2 }, { reel: 1, row: 0 },
    ]);
    expect(evaluation.lineWins.find((win) => win.lineIndex === 0)).toBeUndefined();
  });
});

describe('reel windows and deterministic PRNG', () => {
  it('wraps downward at the last and penultimate strip indexes', () => {
    const strips = [['A', 'B', 'C'], ['D', 'E', 'F']];
    expect(buildGrid(strips, [2, 1], 3)).toEqual([['C', 'A', 'B'], ['E', 'F', 'D']]);
    expect(() => buildGrid(strips, [3, 0], 3)).toThrow(/out of range/);
  });

  it('matches the mulberry32-v1 golden vector and restores snapshots exactly', () => {
    const rng = createRng(0x12345678);
    expect(Array.from({ length: 6 }, () => rng.nextUint32())).toEqual([
      455_919_406, 4_042_750_857, 4_036_713_555, 1_004_527_575, 3_885_174_651, 3_342_903_291,
    ]);
    const restored = createRng(rng.snapshot());
    expect(restored.nextUint32()).toBe(rng.nextUint32());
    expect(normalizeSeed('defuse')).toEqual({ numeric: 0x1899efc7, canonical: '0x1899efc7' });
  });

  it('rejects malformed replay snapshots', () => {
    const valid = createRng(1).snapshot();
    expect(() => createRng({ ...valid, state: -1 })).toThrow(/unsigned 32-bit/);
    expect(() => createRng({ ...valid, position: -1 })).toThrow(/non-negative/);
    expect(() => createRng({ ...valid, seed: '1' })).toThrow(/canonical/);
    expect(() => createRng({ ...valid, algorithm: 'other' } as unknown as RngSnapshot)).toThrow(/Unsupported/);
  });

  it('replays a complete base spin from stable seed and stream metadata', () => {
    const first = spinBase(createSession({ seed: 0x12345678 }));
    const second = spinBase(createSession({ seed: 0x12345678 }));
    expect(second).toEqual(first);
    expect(first.result.stops).toEqual([16, 27, 15, 15, 21]);
    expect(first.result.replay.rngBefore).toMatchObject({ algorithm: RNG_ALGORITHM, seed: '0x12345678', position: 0 });
    expect(first.result.replay.rngAfter.position).toBe(5);
    expect(first.result.developerGenerated).toBe(false);
  });

  it('keeps development cheats outside the public engine index', () => {
    expect('createDeveloperCheatBonus' in publicEngine).toBe(false);
  });
});
