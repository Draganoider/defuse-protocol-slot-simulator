import { assertValidConfig, assertValidWager, DEFAULT_GAME_CONFIG } from './config';
import { chooseBonusRoute, createSession, spinBase, spinBonus } from './session';
import { ENGINE_VERSION, type BonusRoute, type RouteSimulationStats, type SimulationReport, type SimulationRequest } from './types';

export function runSimulation(request: SimulationRequest): SimulationReport {
  const config = request.config ?? DEFAULT_GAME_CONFIG;
  const configHash = assertValidConfig(config);
  if (!Number.isSafeInteger(request.paidSpins) || request.paidSpins <= 0) {
    throw new Error('Simulation paidSpins must be a positive safe integer.');
  }
  if (request.route !== 'alpha' && request.route !== 'bravo') throw new Error('Simulation route must be alpha or bravo.');
  const wager = request.wager ?? config.baseWager;
  assertValidWager(config, wager);
  const totalWagered = request.paidSpins * wager;
  if (!Number.isSafeInteger(totalWagered)) throw new Error('Simulation total wager exceeds the safe integer range.');
  let session = createSession({ config, seed: request.seed, wager });
  const canonicalSeed = session.rng.seed;
  let totalPayout = 0;
  let anyPayHits = 0;
  let profitableHits = 0;
  let bonusEntries = 0;
  let bonusSpins = 0;
  let retriggers = 0;
  let featurePayout = 0;
  let maxWin = 0;
  let returnMean = 0;
  let returnSquaredDifferenceSum = 0;

  for (let paidSpin = 0; paidSpin < request.paidSpins; paidSpin += 1) {
    const base = spinBase(session);
    session = base.session;
    let attributedPayout = base.result.totalPayout;
    if (base.result.bonusOffer) {
      bonusEntries += 1;
      session = chooseBonusRoute(session, request.route);
      while (session.phase === 'bonus') {
        const feature = spinBonus(session);
        session = feature.session;
        attributedPayout += feature.result.totalPayout;
        featurePayout += feature.result.totalPayout;
        bonusSpins += 1;
        if (feature.result.bonusEvent?.retriggered) retriggers += 1;
      }
    }
    totalPayout += attributedPayout;
    if (attributedPayout > 0) anyPayHits += 1;
    if (attributedPayout > wager) profitableHits += 1;
    if (attributedPayout > maxWin) maxWin = attributedPayout;
    const returnMultiple = attributedPayout / wager;
    const delta = returnMultiple - returnMean;
    returnMean += delta / (paidSpin + 1);
    returnSquaredDifferenceSum += delta * (returnMultiple - returnMean);
  }

  if (!Number.isSafeInteger(totalPayout)) throw new Error('Simulation total payout exceeds the safe integer range.');
  const returnStdDev = request.paidSpins > 1
    ? Math.sqrt(returnSquaredDifferenceSum / (request.paidSpins - 1))
    : 0;
  const stats: RouteSimulationStats = {
    route: request.route,
    paidSpins: request.paidSpins,
    bonusEntries,
    bonusSpins,
    retriggers,
    totalWagered,
    totalPayout,
    observedRtp: totalPayout / totalWagered,
    returnStdDev,
    rtpStandardError: returnStdDev / Math.sqrt(request.paidSpins),
    anyPayHitRate: anyPayHits / request.paidSpins,
    profitableHitRate: profitableHits / request.paidSpins,
    bonusFrequency: bonusEntries / request.paidSpins,
    spinsPerBonus: bonusEntries > 0 ? request.paidSpins / bonusEntries : null,
    maxWin,
    featurePayout,
    averageFeaturePayout: bonusEntries > 0 ? featurePayout / bonusEntries : 0,
  };
  const routeStats: Record<BonusRoute, RouteSimulationStats | null> = { alpha: null, bravo: null };
  routeStats[request.route] = stats;
  return {
    reportVersion: '1',
    status: 'complete',
    statisticKind: 'observed',
    configId: config.id,
    configHash,
    engineVersion: baseEngineVersion(),
    mathVersion: config.mathVersion,
    seed: canonicalSeed,
    rngAlgorithm: config.rngAlgorithm,
    requestedPaidSpins: request.paidSpins,
    completedPaidSpins: request.paidSpins,
    wager,
    route: request.route,
    observedRtp: stats.observedRtp,
    returnStdDev: stats.returnStdDev,
    rtpStandardError: stats.rtpStandardError,
    anyPayHitRate: stats.anyPayHitRate,
    profitableHitRate: stats.profitableHitRate,
    bonusFrequency: stats.bonusFrequency,
    spinsPerBonus: stats.spinsPerBonus,
    maxWin,
    routeStats,
  };
}

function baseEngineVersion(): SimulationReport['engineVersion'] {
  return ENGINE_VERSION;
}

