import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG, SYMBOL_IDS } from './config';
import { createDeveloperCheatBonus } from './dev-tools';
import { buyFeature, chooseBonusRoute, createSession, featureBuyCost, spinBase, spinBonus } from './session';
import { constantStrips, makeConfig, NO_WIN_STRIPS, scatterStrips } from './test-fixtures';
import type { BonusRoute, BonusState, GameConfig, GameSession } from './types';

const S = SYMBOL_IDS;

function enterBonus(
  route: BonusRoute,
  config: GameConfig,
  overrides: Partial<BonusState> = {},
  cheat = true,
): GameSession {
  const base = createSession({ config, seed: 0x0badc0de });
  const offered = createDeveloperCheatBonus(base, 3);
  const active = chooseBonusRoute(offered, route);
  return {
    ...active,
    developerCheat: cheat,
    bonusState: { ...active.bonusState!, ...overrides },
  };
}

describe('base bonus offers and development boundary', () => {
  it.each([
    [3, 10, 6],
    [4, 13, 8],
    [5, 16, 10],
  ] as const)('offers declared routes for %i generated COREs', (cores, alphaSpins, bravoSpins) => {
    const config = makeConfig({ baseReelStrips: scatterStrips(cores) });
    const transition = spinBase(createSession({ config, seed: 91 }));
    expect(transition.result.scatter.count).toBe(cores);
    expect(transition.result.bonusOffer).toEqual({
      source: 'generated', scatterCount: cores, alphaSpins, bravoSpins,
    });
    expect(transition.result.developerGenerated).toBe(false);
    expect(transition.session.phase).toBe('bonus-choice');
  });

  it('injects a marked offer without consuming RNG and marks every resulting feature spin', () => {
    const base = createSession({ seed: 'qa-cheat' });
    const offered = createDeveloperCheatBonus(base, 4);
    expect(offered.rng).toEqual(base.rng);
    expect(offered.pendingBonus).toMatchObject({ source: 'developer-cheat', scatterCount: 4 });
    const active = chooseBonusRoute(offered, 'bravo');
    expect(active.bonusState?.spinsRemaining).toBe(8);
    const spin = spinBonus(active);
    expect(spin.result.developerGenerated).toBe(true);
  });
});

describe('Relay Alpha', () => {
  it('turns charges into randomly selected unique secured reels and expands them on final extraction', () => {
    const config = makeConfig({
      bonusReelStrips: { ...DEFAULT_GAME_CONFIG.bonusReelStrips, alpha: scatterStrips(1) },
    });
    const active = enterBonus('alpha', config, {
      spinsRemaining: 1,
      totalAwarded: 30,
      alphaCharges: 5,
      alphaSecuredReels: [1],
    });
    const transition = spinBonus(active);
    expect(transition.result.replay.bonusStateBefore).toEqual(active.bonusState);
    const event = transition.result.bonusEvent!;
    expect(event).toMatchObject({
      route: 'alpha', isExtractionSpin: true, coresCollected: 1, retriggered: false,
    });
    expect(event.newlySecuredReels).toHaveLength(2);
    expect(new Set([1, ...event.newlySecuredReels]).size).toBe(3);
    expect(event.newlySecuredReels).not.toContain(1);
    expect(event.expandedWildReels).toEqual([1, ...event.newlySecuredReels]);
    event.expandedWildReels.forEach((reel) => {
      expect(transition.result.evaluatedGrid[reel]).toEqual([S.WILD, S.WILD, S.WILD]);
    });
    expect(transition.result.replay.rngAfter.position - transition.result.replay.rngBefore.position).toBe(7);
    expect(transition.result.developerGenerated).toBe(true);
    expect(transition.session).toMatchObject({ phase: 'base', developerCheat: false });
  });

  it('honors partial retriggers and terminates at the 30-spin award cap', () => {
    const config = makeConfig({
      bonusReelStrips: { ...DEFAULT_GAME_CONFIG.bonusReelStrips, alpha: scatterStrips(3) },
    });
    let session = enterBonus('alpha', config, { spinsRemaining: 1, totalAwarded: 29 });
    const first = spinBonus(session);
    expect(first.result.bonusEvent).toMatchObject({ retriggered: true, retriggerSpinsAwarded: 1 });
    expect(first.session.bonusState).toMatchObject({ spinsRemaining: 1, totalAwarded: 30 });
    const final = spinBonus(first.session);
    expect(final.result.bonusEvent).toMatchObject({ retriggered: false, retriggerSpinsAwarded: 0, isExtractionSpin: true });
    expect(final.session.phase).toBe('base');
  });

  it('plays exactly 30 feature spins under repeated retriggers', () => {
    const config = makeConfig({
      bonusReelStrips: { ...DEFAULT_GAME_CONFIG.bonusReelStrips, alpha: scatterStrips(3) },
    });
    let session = enterBonus('alpha', config);
    let played = 0;
    let awarded = session.bonusState!.totalAwarded;
    while (session.phase === 'bonus') {
      const transition = spinBonus(session);
      awarded += transition.result.bonusEvent!.retriggerSpinsAwarded;
      played += 1;
      session = transition.session;
    }
    expect(awarded).toBe(30);
    expect(played).toBe(30);
  });
});

describe('Relay Bravo', () => {
  it('advances its 1x/2x/3x/5x multiplier after wins and applies the current step', () => {
    const winStrips = constantStrips([S.RADIO, S.RADIO, S.RADIO, S.RADIO, S.RADIO]);
    const config = makeConfig({
      bonusReelStrips: { ...DEFAULT_GAME_CONFIG.bonusReelStrips, bravo: winStrips },
    });
    const active = enterBonus('bravo', config, { bravoMultiplier: 3 });
    const transition = spinBonus(active);
    expect(transition.result.replay.bonusStateBefore).toEqual(active.bonusState);
    expect(transition.result).toMatchObject({ appliedMultiplier: 3 });
    expect(transition.result.totalPayout).toBe(transition.result.baseLinePayout * 3);
    expect(transition.result.bonusEvent).toMatchObject({ multiplierBefore: 3, multiplierAfter: 5 });
  });

  it('resets after a miss, or consumes a protection charge to preserve the multiplier', () => {
    const config = makeConfig({
      bonusReelStrips: { ...DEFAULT_GAME_CONFIG.bonusReelStrips, bravo: NO_WIN_STRIPS },
    });
    const reset = spinBonus(enterBonus('bravo', config, { bravoMultiplier: 3, bravoShields: 0 }));
    expect(reset.result.totalPayout).toBe(0);
    expect(reset.result.bonusEvent).toMatchObject({ multiplierAfter: 1, shieldConsumed: false });
    const protectedMiss = spinBonus(enterBonus('bravo', config, { bravoMultiplier: 3, bravoShields: 1 }));
    expect(protectedMiss.result.bonusEvent).toMatchObject({ multiplierAfter: 3, shieldConsumed: true });
    expect(protectedMiss.session.bonusState?.bravoShields).toBe(0);
  });

  it('grants one shield per collected CORE up to the configured cap', () => {
    const threeCoreStrips = [[S.CORE, S.CORE, S.CORE], [S.RADIO], [S.RADIO], [S.RADIO], [S.RADIO]];
    const config = makeConfig({
      bonusReelStrips: { ...DEFAULT_GAME_CONFIG.bonusReelStrips, bravo: threeCoreStrips },
    });
    const transition = spinBonus(enterBonus('bravo', config));
    expect(transition.result.scatter.count).toBe(3);
    expect(transition.result.totalPayout).toBe(0);
    expect(transition.result.bonusEvent).toMatchObject({ shieldGranted: true, shieldConsumed: true, multiplierAfter: 1 });
    expect(transition.session.bonusState?.bravoShields).toBe(2);
  });

  it('banks a CORE shield when the same spin wins', () => {
    const config = makeConfig({
      bonusReelStrips: { ...DEFAULT_GAME_CONFIG.bonusReelStrips, bravo: scatterStrips(1) },
    });
    const transition = spinBonus(enterBonus('bravo', config));
    expect(transition.result.totalPayout).toBeGreaterThan(0);
    expect(transition.result.bonusEvent).toMatchObject({ shieldGranted: true, shieldConsumed: false, multiplierAfter: 2 });
    expect(transition.session.bonusState?.bravoShields).toBe(1);
  });
});

describe('virtual-credit feature buy', () => {
  const session = createSession({ seed: 'feature-buy' });

  it('prices each route as a whole multiple of the total wager', () => {
    expect(featureBuyCost(session, 'alpha')).toBe(session.wager * 83);
    expect(featureBuyCost(session, 'bravo')).toBe(session.wager * 79);
    const raised = { ...session, wager: session.wager * 5 };
    expect(featureBuyCost(raised, 'alpha')).toBe(raised.wager * 83);
  });

  it('opens the chosen route without consuming randomness', () => {
    const bought = buyFeature(session, 'alpha', 100_000);
    expect(bought.session.phase).toBe('bonus');
    expect(bought.session.bonusState?.route).toBe('alpha');
    expect(bought.spinsAwarded).toBe(10);
    // A seeded session stays exactly where it was, so replay is unaffected by a purchase.
    expect(bought.session.rng).toEqual(session.rng);
  });

  it('marks a purchased entry so it is never counted as ordinary play', () => {
    expect(buyFeature(session, 'bravo', 100_000).session.bonusState?.entry).toBe('purchased');
    const triggered = chooseBonusRoute(
      { ...session, phase: 'bonus-choice', pendingBonus: { source: 'generated', scatterCount: 3, alphaSpins: 10, bravoSpins: 6 } },
      'bravo',
    );
    expect(triggered.bonusState?.entry).toBe('triggered');
  });

  it('refuses a purchase the balance cannot cover', () => {
    expect(() => buyFeature(session, 'alpha', featureBuyCost(session, 'alpha') - 1)).toThrow(/does not cover/);
    expect(() => buyFeature(session, 'alpha', Number.NaN)).toThrow(/does not cover/);
    expect(() => buyFeature(session, 'alpha', featureBuyCost(session, 'alpha'))).not.toThrow();
  });

  it('refuses a purchase outside the base phase', () => {
    const inFeature = buyFeature(session, 'alpha', 100_000).session;
    expect(() => buyFeature(inFeature, 'alpha', 100_000)).toThrow(/base phase/);
  });

  it('plays a purchased feature to completion like a triggered one', () => {
    let current = buyFeature(session, 'alpha', 100_000).session;
    let spins = 0;
    while (current.phase === 'bonus') {
      current = spinBonus(current).session;
      spins += 1;
    }
    expect(spins).toBeGreaterThanOrEqual(10);
    expect(current.phase).toBe('base');
  });
});
