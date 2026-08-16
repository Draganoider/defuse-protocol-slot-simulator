import { assertValidConfig, assertValidWager } from './config';
import type { GameConfig } from './types';

export interface BaseTheoreticalStats {
  readonly statisticKind: 'theoretical';
  readonly baseGameRtp: number;
  readonly expectedBasePayout: number;
  readonly bonusEntryProbability: number;
  readonly spinsPerBonus: number;
}

function bestLineAward(config: GameConfig, symbols: readonly string[]): number {
  let best = 0;
  for (const [symbolId, entry] of Object.entries(config.paytable)) {
    let count = 0;
    for (const value of symbols) {
      if (value !== symbolId && value !== config.wildSymbolId) break;
      count += 1;
    }
    if (count >= 3) best = Math.max(best, entry[Math.min(5, count) as 3 | 4 | 5]);
  }
  return best;
}

/** Exact base-line RTP and exact base bonus-entry probability for this math model. */
export function calculateBaseTheoreticalStats(config: GameConfig, wager = config.baseWager): BaseTheoreticalStats {
  assertValidConfig(config);
  const lineBet = assertValidWager(config, wager);
  const reelFrequencies = config.baseReelStrips.map((strip) => {
    const frequencies = new Map<string, number>();
    strip.forEach((symbolId) => frequencies.set(symbolId, (frequencies.get(symbolId) ?? 0) + 1));
    return [...frequencies.entries()] as readonly (readonly [string, number])[];
  });
  let expectedLineAward = 0;
  const values = new Array<string>(config.reels);
  const enumerateLine = (reel: number, probability: number) => {
    if (reel === config.reels) {
      expectedLineAward += probability * bestLineAward(config, values);
      return;
    }
    const length = config.baseReelStrips[reel].length;
    for (const [symbolId, frequency] of reelFrequencies[reel]) {
      values[reel] = symbolId;
      enumerateLine(reel + 1, probability * frequency / length);
    }
  };
  enumerateLine(0, 1);
  const expectedBasePayout = expectedLineAward * lineBet * config.paylines.length;

  let scatterDistribution = [1];
  config.baseReelStrips.forEach((strip) => {
    const reelDistribution = Array.from({ length: config.rows + 1 }, () => 0);
    for (let stop = 0; stop < strip.length; stop += 1) {
      let count = 0;
      for (let row = 0; row < config.rows; row += 1) {
        if (strip[(stop + row) % strip.length] === config.scatterSymbolId) count += 1;
      }
      reelDistribution[count] += 1 / strip.length;
    }
    const combined = Array.from({ length: scatterDistribution.length + config.rows }, () => 0);
    scatterDistribution.forEach((leftProbability, leftCount) => reelDistribution.forEach((rightProbability, rightCount) => {
      combined[leftCount + rightCount] += leftProbability * rightProbability;
    }));
    scatterDistribution = combined;
  });
  const bonusEntryProbability = scatterDistribution.reduce(
    (sum, probability, count) => sum + (count >= config.bonus.triggerScatters ? probability : 0),
    0,
  );
  return {
    statisticKind: 'theoretical',
    baseGameRtp: expectedBasePayout / wager,
    expectedBasePayout,
    bonusEntryProbability,
    spinsPerBonus: 1 / bonusEntryProbability,
  };
}

