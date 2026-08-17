import type { BonusRoute, SpinResult } from '../engine';
import type { ScheduledAudioCue } from './types';
import { classifyWin } from '../presentation/win-tier';
import { DEFAULT_PRESENTATION_MS, type SpinTiming } from '../presentation/spin-timing';

const REELS = 5;
/** Length of the reel-mechanism sample, used to repeat it across a longer spin. */
const SPIN_DRIVE_MS = 620;

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

  // The mechanism sample is shorter than a standard-speed spin, so it repeats until the
  // last reel lands. At least one reel is turning for that whole span, so without this the
  // reels would keep visibly spinning over silence.
  const lastStop = stops?.at(-1) ?? 0;
  for (let at = SPIN_DRIVE_MS; at < lastStop - 140; at += SPIN_DRIVE_MS) {
    plan.push({ cue: 'spin-drive', delayMs: at, gain: 0.52 });
  }

  for (let reel = 0; reel < REELS; reel += 1) {
    const delayMs = stops?.[reel] ?? settleStart + settleStep * reel;
    if (stops && timing && timing.anticipation[reel] !== 'none') {
      plan.push({ cue: 'spin-drive', delayMs: (stops[reel - 1] ?? 0) + 40, gain: timing.anticipation[reel] === 'trigger' ? 0.52 : 0.4 });
    }
    plan.push({ cue: `reel-latch-${reel + 1}` as ScheduledAudioCue['cue'], delayMs, gain: 0.76 + reel * 0.035 });
  }
  // Cues are built per layer, so order the plan by time before handing it over. The mixer
  // schedules by delay either way; a time-ordered plan is simply easier to reason about.
  return [...plan].sort((left, right) => left.delayMs - right.delayMs);
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
