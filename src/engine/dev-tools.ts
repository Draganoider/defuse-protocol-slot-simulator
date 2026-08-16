import type { BonusOffer, GameSession } from './types';

/**
 * DEVELOPMENT/QA ONLY. Fabricates a clearly marked pending bonus choice without
 * consuming RNG. This module is deliberately absent from the public engine index.
 */
export function createDeveloperCheatBonus(
  session: GameSession,
  scatterCount: 3 | 4 | 5 = 3,
): GameSession {
  if (session.phase !== 'base') throw new Error('Developer bonus injection requires a session in the base phase.');
  const bonusOffer: BonusOffer = {
    source: 'developer-cheat',
    scatterCount,
    alphaSpins: session.config.bonus.alphaSpinsByScatters[scatterCount],
    bravoSpins: session.config.bonus.bravoSpinsByScatters[scatterCount],
  };
  return {
    ...session,
    phase: 'bonus-choice',
    pendingBonus: bonusOffer,
    developerCheat: true,
  };
}

