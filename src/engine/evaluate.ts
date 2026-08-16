import type { GameConfig, GridPosition, LineWin, ScatterSummary } from './types';

export interface EvaluationResult {
  readonly lineWins: readonly LineWin[];
  readonly scatter: ScatterSummary;
  readonly baseLinePayout: number;
  readonly totalPayout: number;
}

export function evaluateGrid(
  config: GameConfig,
  grid: readonly (readonly string[])[],
  lineBet: number,
  multiplier = 1,
): EvaluationResult {
  if (!Number.isSafeInteger(lineBet) || lineBet <= 0) throw new Error('Line bet must be a positive safe integer.');
  if (!Number.isSafeInteger(multiplier) || multiplier <= 0) throw new Error('Multiplier must be a positive safe integer.');
  if (grid.length !== config.reels || grid.some((reel) => reel.length !== config.rows)) throw new Error('Grid dimensions do not match the configuration.');

  const lineWins: LineWin[] = [];
  const regularIds = config.symbols.filter((symbol) => symbol.role === 'regular').map((symbol) => symbol.id);

  config.paylines.forEach((line, lineIndex) => {
    let best: LineWin | undefined;
    for (const symbolId of regularIds) {
      let count = 0;
      for (let reel = 0; reel < config.reels; reel += 1) {
        const value = grid[reel][line[reel]];
        if (value !== symbolId && value !== config.wildSymbolId) break;
        count += 1;
      }
      if (count < 3) continue;
      const paidCount = count as 3 | 4 | 5;
      const paytableAward = config.paytable[symbolId][paidCount];
      const payout = paytableAward * lineBet * multiplier;
      if (!Number.isSafeInteger(payout)) throw new Error('Line payout exceeds safe integer range.');
      const candidate: LineWin = {
        lineIndex,
        symbolId,
        count: paidCount,
        positions: Array.from({ length: count }, (_, reel): GridPosition => ({ reel, row: line[reel] })),
        lineBet,
        paytableAward,
        multiplier,
        payout,
      };
      if (!best || candidate.payout > best.payout || (candidate.payout === best.payout && candidate.count > best.count)) best = candidate;
    }
    if (best && best.payout > 0) lineWins.push(best);
  });

  const scatterPositions: GridPosition[] = [];
  grid.forEach((reel, reelIndex) => reel.forEach((symbolId, row) => {
    if (symbolId === config.scatterSymbolId) scatterPositions.push({ reel: reelIndex, row });
  }));
  const scatter: ScatterSummary = {
    count: scatterPositions.length,
    positions: scatterPositions,
    triggered: scatterPositions.length >= config.bonus.triggerScatters,
  };
  const baseLinePayout = lineWins.reduce((sum, win) => sum + win.paytableAward * win.lineBet, 0);
  const totalPayout = lineWins.reduce((sum, win) => sum + win.payout, 0);
  if (!Number.isSafeInteger(baseLinePayout) || !Number.isSafeInteger(totalPayout)) throw new Error('Spin payout exceeds safe integer range.');
  return { lineWins, scatter, baseLinePayout, totalPayout };
}

export function expandWildReels(
  grid: readonly (readonly string[])[],
  securedReels: readonly number[],
  wildSymbolId: string,
): readonly (readonly string[])[] {
  const secured = new Set(securedReels);
  return grid.map((reel, index) => secured.has(index) ? reel.map(() => wildSymbolId) : [...reel]);
}

