import { assertValidConfig, assertValidWager, DEFAULT_GAME_CONFIG } from './config';
import { evaluateGrid, expandWildReels } from './evaluate';
import { buildGrid, selectStops } from './reels';
import { createRng } from './rng';
import {
  ENGINE_VERSION,
  MATH_VERSION,
  type BonusOffer,
  type BonusRoute,
  type BonusSpinEvent,
  type BonusState,
  type GameConfig,
  type GameSession,
  type ReplayMetadata,
  type RngSnapshot,
  type SpinResult,
  type SpinTransition,
} from './types';

export interface CreateSessionOptions {
  readonly config?: GameConfig;
  readonly seed: number | string;
  readonly wager?: number;
}

function replay(
  config: GameConfig,
  configHash: string,
  before: RngSnapshot,
  after: RngSnapshot,
  bonusStateBefore?: BonusState,
): ReplayMetadata {
  return {
    engineVersion: ENGINE_VERSION,
    mathVersion: MATH_VERSION,
    configId: config.id,
    configHash,
    rngBefore: before,
    rngAfter: after,
    ...(bonusStateBefore ? { bonusStateBefore } : {}),
  };
}

function offeredScatterCount(count: number): 3 | 4 | 5 {
  if (count !== 3 && count !== 4 && count !== 5) {
    throw new Error(`Generated bonus scatter count ${count} is outside the validated 3-5 range.`);
  }
  return count;
}

export function createSession(options: CreateSessionOptions): GameSession {
  const config = options.config ?? DEFAULT_GAME_CONFIG;
  const configHash = assertValidConfig(config);
  const wager = options.wager ?? config.baseWager;
  assertValidWager(config, wager);
  return {
    sessionVersion: '1',
    config,
    configHash,
    wager,
    rng: createRng(options.seed).snapshot(),
    phase: 'base',
    developerCheat: false,
  };
}

export function spinBase(session: GameSession): SpinTransition {
  if (session.phase !== 'base') throw new Error(`Cannot make a base spin while session phase is ${session.phase}.`);
  const lineBet = assertValidWager(session.config, session.wager);
  const rng = createRng(session.rng);
  const before = rng.snapshot();
  const stops = selectStops(session.config.baseReelStrips, rng);
  const rawGrid = buildGrid(session.config.baseReelStrips, stops, session.config.rows);
  const evaluation = evaluateGrid(session.config, rawGrid, lineBet);
  let bonusOffer: BonusOffer | undefined;
  if (evaluation.scatter.triggered) {
    const count = offeredScatterCount(evaluation.scatter.count);
    bonusOffer = {
      source: 'generated',
      scatterCount: count,
      alphaSpins: session.config.bonus.alphaSpinsByScatters[count],
      bravoSpins: session.config.bonus.bravoSpinsByScatters[count],
    };
  }
  const after = rng.snapshot();
  const result: SpinResult = {
    resultVersion: '1',
    mode: 'base',
    wager: session.wager,
    lineBet,
    stops,
    rawGrid,
    evaluatedGrid: rawGrid,
    lineWins: evaluation.lineWins,
    scatter: evaluation.scatter,
    baseLinePayout: evaluation.baseLinePayout,
    appliedMultiplier: 1,
    totalPayout: evaluation.totalPayout,
    bonusOffer,
    developerGenerated: false,
    replay: replay(session.config, session.configHash, before, after),
  };
  return {
    result,
    session: {
      ...session,
      rng: after,
      phase: bonusOffer ? 'bonus-choice' : 'base',
      pendingBonus: bonusOffer,
    },
  };
}

function openBonusState(route: BonusRoute, totalAwarded: number, entry: BonusState['entry']): BonusState {
  return {
    route,
    entry,
    spinsRemaining: totalAwarded,
    totalAwarded,
    totalPlayed: 0,
    retriggers: 0,
    alphaCharges: 0,
    alphaSecuredReels: [],
    bravoMultiplier: 1,
    bravoShields: 0,
  };
}

/** Cost of entering a route directly, in virtual credits, for the session's wager. */
export function featureBuyCost(session: GameSession, route: BonusRoute): number {
  const multiplier = session.config.bonus.featureBuyCostByRoute[route];
  const cost = session.wager * multiplier;
  if (!Number.isSafeInteger(cost) || cost <= 0) throw new Error('Feature-buy cost is outside the safe integer range.');
  return cost;
}

export interface FeatureBuyTransition {
  readonly session: GameSession;
  readonly cost: number;
  readonly route: BonusRoute;
  readonly spinsAwarded: number;
}

/**
 * Enters a route directly for a fixed cost instead of waiting for a Signal Core trigger.
 *
 * No randomness is consumed: the award is fully determined by the route and the declared
 * purchased scatter count, so the deterministic stream is left exactly where it was and a
 * seeded session stays reproducible. The resulting bonus state records that it was
 * purchased so a purchased feature is never counted as ordinary play.
 */
export function buyFeature(session: GameSession, route: BonusRoute, balance: number): FeatureBuyTransition {
  if (session.phase !== 'base') throw new Error(`A feature can only be bought from the base phase, not ${session.phase}.`);
  if (route !== 'alpha' && route !== 'bravo') throw new Error('A feature buy requires the alpha or bravo route.');
  assertValidWager(session.config, session.wager);
  const cost = featureBuyCost(session, route);
  if (Number.isNaN(balance) || balance < cost) throw new Error('The balance does not cover the feature-buy cost.');
  const scatters = session.config.bonus.featureBuyScatterCount;
  const spinsAwarded = route === 'alpha'
    ? session.config.bonus.alphaSpinsByScatters[scatters]
    : session.config.bonus.bravoSpinsByScatters[scatters];
  return {
    cost,
    route,
    spinsAwarded,
    session: {
      ...session,
      phase: 'bonus',
      pendingBonus: undefined,
      bonusState: openBonusState(route, spinsAwarded, 'purchased'),
      developerCheat: false,
    },
  };
}

export function chooseBonusRoute(session: GameSession, route: BonusRoute): GameSession {
  if (session.phase !== 'bonus-choice' || !session.pendingBonus) throw new Error('No pending bonus is available to choose.');
  const offer = session.pendingBonus;
  const totalAwarded = route === 'alpha' ? offer.alphaSpins : offer.bravoSpins;
  const bonusState: BonusState = {
    route,
    entry: 'triggered',
    spinsRemaining: totalAwarded,
    totalAwarded,
    totalPlayed: 0,
    retriggers: 0,
    alphaCharges: 0,
    alphaSecuredReels: [],
    bravoMultiplier: 1,
    bravoShields: 0,
  };
  return { ...session, phase: 'bonus', pendingBonus: undefined, bonusState };
}

function alphaProgress(
  session: GameSession,
  starting: BonusState,
  coreCount: number,
  retriggerAward: number,
  chooseAvailableReel: (exclusiveMax: number) => number,
): { state: BonusState; newReels: readonly number[]; extraction: boolean } {
  let charges = starting.alphaCharges + coreCount;
  const secured = [...starting.alphaSecuredReels];
  const newReels: number[] = [];
  while (charges >= session.config.bonus.alphaChargesPerSecuredReel && secured.length < session.config.reels) {
    charges -= session.config.bonus.alphaChargesPerSecuredReel;
    const available = Array.from({ length: session.config.reels }, (_, index) => index).filter((index) => !secured.includes(index));
    const nextReel = available[chooseAvailableReel(available.length)];
    secured.push(nextReel);
    newReels.push(nextReel);
  }
  const spinsRemaining = starting.spinsRemaining - 1 + retriggerAward;
  return {
    state: {
      ...starting,
      spinsRemaining,
      totalAwarded: starting.totalAwarded + retriggerAward,
      totalPlayed: starting.totalPlayed + 1,
      retriggers: starting.retriggers + (retriggerAward > 0 ? 1 : 0),
      alphaCharges: charges,
      alphaSecuredReels: secured,
    },
    newReels,
    extraction: spinsRemaining === 0,
  };
}

function nextBravoMultiplier(steps: readonly number[], current: number): number {
  const index = Math.max(0, steps.indexOf(current));
  return steps[Math.min(steps.length - 1, index + 1)];
}

export function spinBonus(session: GameSession): SpinTransition {
  if (session.phase !== 'bonus' || !session.bonusState) throw new Error('No active bonus spin is available.');
  const starting = session.bonusState;
  if (starting.spinsRemaining <= 0) throw new Error('The bonus has no spins remaining.');
  const lineBet = assertValidWager(session.config, session.wager);
  const rng = createRng(session.rng);
  const before = rng.snapshot();
  const strips = session.config.bonusReelStrips[starting.route];
  const stops = selectStops(strips, rng);
  const rawGrid = buildGrid(strips, stops, session.config.rows);
  const rawScatter = evaluateGrid(session.config, rawGrid, lineBet).scatter;
  const canRetrigger = rawScatter.count >= session.config.bonus.retriggerScatters;
  const retriggerAward = canRetrigger
    ? Math.min(session.config.bonus.retriggerSpins, session.config.bonus.maxAwardedSpins - starting.totalAwarded)
    : 0;

  let state: BonusState;
  let evaluatedGrid = rawGrid;
  let multiplier = 1;
  let event: BonusSpinEvent;

  if (starting.route === 'alpha') {
    const progress = alphaProgress(session, starting, rawScatter.count, retriggerAward, (exclusiveMax) => rng.nextInt(exclusiveMax));
    state = progress.state;
    if (progress.extraction) evaluatedGrid = expandWildReels(rawGrid, state.alphaSecuredReels, session.config.wildSymbolId);
    event = {
      route: 'alpha',
      isExtractionSpin: progress.extraction,
      coresCollected: rawScatter.count,
      newlySecuredReels: progress.newReels,
      expandedWildReels: progress.extraction ? state.alphaSecuredReels : [],
      retriggered: retriggerAward > 0,
      retriggerSpinsAwarded: retriggerAward,
      multiplierBefore: 1,
      multiplierAfter: 1,
      shieldGranted: false,
      shieldConsumed: false,
    };
  } else {
    multiplier = starting.bravoMultiplier;
    const shieldsGranted = Math.min(
      rawScatter.count,
      session.config.bonus.bravoMaxShields - starting.bravoShields,
    );
    const shieldGranted = shieldsGranted > 0;
    let shields = starting.bravoShields + shieldsGranted;
    const preliminary = evaluateGrid(session.config, rawGrid, lineBet, multiplier);
    const won = preliminary.totalPayout > 0;
    let shieldConsumed = false;
    let multiplierAfter: number;
    if (won) {
      multiplierAfter = nextBravoMultiplier(session.config.bonus.bravoMultiplierSteps, multiplier);
    } else if (shields > 0) {
      shields -= 1;
      shieldConsumed = true;
      multiplierAfter = multiplier;
    } else {
      multiplierAfter = session.config.bonus.bravoMultiplierSteps[0];
    }
    state = {
      ...starting,
      spinsRemaining: starting.spinsRemaining - 1 + retriggerAward,
      totalAwarded: starting.totalAwarded + retriggerAward,
      totalPlayed: starting.totalPlayed + 1,
      retriggers: starting.retriggers + (retriggerAward > 0 ? 1 : 0),
      bravoMultiplier: multiplierAfter,
      bravoShields: shields,
    };
    event = {
      route: 'bravo',
      isExtractionSpin: false,
      coresCollected: rawScatter.count,
      newlySecuredReels: [],
      expandedWildReels: [],
      retriggered: retriggerAward > 0,
      retriggerSpinsAwarded: retriggerAward,
      multiplierBefore: multiplier,
      multiplierAfter,
      shieldGranted,
      shieldConsumed,
    };
  }

  const evaluation = evaluateGrid(session.config, evaluatedGrid, lineBet, multiplier);
  const after = rng.snapshot();
  const result: SpinResult = {
    resultVersion: '1',
    mode: 'bonus',
    route: starting.route,
    wager: session.wager,
    lineBet,
    stops,
    rawGrid,
    evaluatedGrid,
    lineWins: evaluation.lineWins,
    scatter: rawScatter,
    baseLinePayout: evaluation.baseLinePayout,
    appliedMultiplier: multiplier,
    totalPayout: evaluation.totalPayout,
    bonusEvent: event,
    developerGenerated: session.developerCheat,
    replay: replay(session.config, session.configHash, before, after, starting),
  };
  return {
    result,
    session: {
      ...session,
      rng: after,
      phase: state.spinsRemaining === 0 ? 'base' : 'bonus',
      bonusState: state.spinsRemaining === 0 ? undefined : state,
      developerCheat: state.spinsRemaining === 0 ? false : session.developerCheat,
    },
  };
}

