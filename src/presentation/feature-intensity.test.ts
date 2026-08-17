import { describe, expect, it } from 'vitest';
import { featureIntensity } from './feature-intensity';

const STEPS = [1, 2, 3, 5];

describe('feature music intensity', () => {
  it('starts low and stays inside range for a fresh Alpha feature', () => {
    const value = featureIntensity({ route: 'alpha', spinsRemaining: 10, totalAwarded: 10, securedReels: 0, reels: 5 });
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(0.2);
  });

  it('rises as Alpha secures reels for the Extraction Spin', () => {
    const at = (securedReels: number) =>
      featureIntensity({ route: 'alpha', spinsRemaining: 6, totalAwarded: 10, securedReels, reels: 5 });
    expect(at(1)).toBeGreaterThan(at(0));
    expect(at(3)).toBeGreaterThan(at(1));
    expect(at(5)).toBeGreaterThan(at(3));
    expect(at(5)).toBeLessThanOrEqual(1);
  });

  it('counts partial Alpha charges as progress towards the next reel', () => {
    const base = { route: 'alpha' as const, spinsRemaining: 6, totalAwarded: 10, securedReels: 2, reels: 5 };
    expect(featureIntensity({ ...base, alphaCharges: 2 })).toBeGreaterThan(featureIntensity({ ...base, alphaCharges: 0 }));
  });

  it('rises with the Bravo multiplier ladder', () => {
    const at = (bravoMultiplier: number) =>
      featureIntensity({ route: 'bravo', spinsRemaining: 4, totalAwarded: 6, bravoMultiplier, multiplierSteps: STEPS });
    expect(at(2)).toBeGreaterThan(at(1));
    expect(at(3)).toBeGreaterThan(at(2));
    expect(at(5)).toBeGreaterThan(at(3));
  });

  it('lifts towards the closing spins at equal route progress', () => {
    const early = featureIntensity({ route: 'bravo', spinsRemaining: 6, totalAwarded: 6, bravoMultiplier: 1, multiplierSteps: STEPS });
    const last = featureIntensity({ route: 'bravo', spinsRemaining: 1, totalAwarded: 6, bravoMultiplier: 1, multiplierSteps: STEPS });
    expect(last).toBeGreaterThan(early);
  });

  it('reaches full intensity on a maxed final spin and never leaves 0 to 1', () => {
    expect(featureIntensity({
      route: 'bravo', spinsRemaining: 1, totalAwarded: 6, bravoMultiplier: 5, multiplierSteps: STEPS,
    })).toBeCloseTo(1, 5);
    for (const spinsRemaining of [0, 1, 50]) {
      for (const securedReels of [0, 5, 99]) {
        const value = featureIntensity({ route: 'alpha', spinsRemaining, totalAwarded: 10, securedReels, reels: 5 });
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('survives missing or invalid state without throwing', () => {
    expect(featureIntensity({ route: 'alpha' })).toBeGreaterThanOrEqual(0);
    expect(featureIntensity({ route: 'bravo', bravoMultiplier: Number.NaN, multiplierSteps: STEPS })).toBeGreaterThanOrEqual(0);
  });
});
