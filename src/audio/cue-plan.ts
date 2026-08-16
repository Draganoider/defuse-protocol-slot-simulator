import type { BonusRoute, SpinResult } from '../engine';
import type { ScheduledAudioCue } from './types';
import { classifyWin } from '../presentation/win-tier';

export function createSpinCuePlan(reducedMotion = false): readonly ScheduledAudioCue[] {
  const settleStart = reducedMotion ? 35 : 235;
  const settleStep = reducedMotion ? 18 : 54;
  return [
    { cue: 'spin-drive', delayMs: 0, gain: 0.9 },
    ...Array.from({ length: 5 }, (_, index): ScheduledAudioCue => ({
      cue: `reel-latch-${index + 1}` as ScheduledAudioCue['cue'],
      delayMs: settleStart + settleStep * index,
      gain: 0.76 + index * 0.035,
    })),
  ];
}

function winCue(result: SpinResult): ScheduledAudioCue['cue'] {
  const tier = classifyWin(result.totalPayout, result.wager).tier;
  if (tier === 'major') return 'win-major';
  if (tier === 'big') return 'win-big';
  if (tier === 'strong') return 'win-large';
  if (result.wager > 0 && result.totalPayout / result.wager >= 2) return 'win-medium';
  return 'win-small';
}

export function createResultCuePlan(result: SpinResult, reducedMotion = false): readonly ScheduledAudioCue[] {
  const revealDelay = reducedMotion ? 35 : 515;
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
