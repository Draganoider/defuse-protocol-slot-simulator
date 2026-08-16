import type { BonusRoute, SpinResult } from '../engine';
import type { ScheduledAudioCue } from './types';
import { classifyWin } from '../presentation/win-tier';
import { DEFAULT_PRESENTATION_MS, type SpinTiming } from '../presentation/spin-timing';

const REELS = 5;

/**
 * Schedules the drive and one latch per reel. When a committed timing plan is supplied the
 * latches follow the exact settle times, and every reel that holds for a possible trigger
 * gets a second, quieter pass of the mechanism so the wait stays audible.
 */
export function createSpinCuePlan(reducedMotion = false, timing?: SpinTiming): readonly ScheduledAudioCue[] {
  const plan: ScheduledAudioCue[] = [{ cue: 'spin-drive', delayMs: 0, gain: 0.9 }];
  const settleStart = reducedMotion ? 35 : 235;
  const settleStep = reducedMotion ? 18 : 54;
  const stops = reducedMotion ? undefined : timing?.reelStopMs;
  for (let reel = 0; reel < REELS; reel += 1) {
    const delayMs = stops?.[reel] ?? settleStart + settleStep * reel;
    if (stops && timing?.anticipatedReels[reel]) {
      plan.push({ cue: 'spin-drive', delayMs: (stops[reel - 1] ?? 0) + 40, gain: 0.52 });
    }
    plan.push({ cue: `reel-latch-${reel + 1}` as ScheduledAudioCue['cue'], delayMs, gain: 0.76 + reel * 0.035 });
  }
  return plan;
}

function winCue(result: SpinResult): ScheduledAudioCue['cue'] {
  const tier = classifyWin(result.totalPayout, result.wager).tier;
  if (tier === 'major') return 'win-major';
  if (tier === 'big') return 'win-big';
  if (tier === 'strong') return 'win-large';
  if (result.wager > 0 && result.totalPayout / result.wager >= 2) return 'win-medium';
  return 'win-small';
}

export function createResultCuePlan(
  result: SpinResult,
  reducedMotion = false,
  presentationMs = DEFAULT_PRESENTATION_MS,
): readonly ScheduledAudioCue[] {
  const revealDelay = reducedMotion ? 35 : Math.max(0, presentationMs - 5);
  const plan: ScheduledAudioCue[] = [];
  if (result.totalPayout > 0) {
    plan.push(
      { cue: 'payline-trace', delayMs: revealDelay, gain: 0.82 },
      { cue: winCue(result), delayMs: revealDelay + (reducedMotion ? 45 : 115), gain: 0.94 },
    );
  }
  if (result.bonusOffer || result.bonusEvent?.coresCollected || result.bonusEvent?.retriggered) {
    plan.push({ cue: 'core-activation', delayMs: revealDelay + (reducedMotion ? 90 : 210), gain: 0.96 });
  }
  if (result.bonusEvent?.retriggered) {
    plan.push({ cue: 'feature-retrigger', delayMs: revealDelay + (reducedMotion ? 125 : 330), gain: 0.94 });
  }
  return plan;
}

export function createRouteCuePlan(route: BonusRoute): readonly ScheduledAudioCue[] {
  return [{ cue: route === 'alpha' ? 'relay-alpha' : 'relay-bravo', delayMs: 0, gain: 0.92 }];
}

export function createFeatureCompleteCuePlan(): readonly ScheduledAudioCue[] {
  return [{ cue: 'feature-complete', delayMs: 120, gain: 0.96 }];
}
