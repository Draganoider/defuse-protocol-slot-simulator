import { describe, expect, it } from 'vitest';
import { APP_META } from './app-meta';

describe('public product boundaries', () => {
  it('identifies the original project', () => {
    expect(APP_META.name).toBe('Defuse Protocol');
    expect(APP_META.setting).toBe('Pelagos Relay');
  });

  it('keeps the foundation virtual-credit-only', () => {
    expect(APP_META.virtualCreditsOnly).toBe(true);
    expect(APP_META.monetaryValue).toBe(false);
    expect(APP_META.realMoneyFeatures).toBe(false);
  });
});

