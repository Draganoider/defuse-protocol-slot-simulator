import { DEFAULT_GAME_CONFIG, SYMBOL_IDS } from './config';
import type { GameConfig } from './types';

const S = SYMBOL_IDS;

export function constantStrips(symbolIds: readonly string[]): readonly (readonly string[])[] {
  return symbolIds.map((symbolId) => [symbolId]);
}

/** Every selected scatter reel displays exactly one CORE in its three-row window. */
export function scatterStrips(scatterReels: number): readonly (readonly string[])[] {
  return Array.from({ length: 5 }, (_, reel) => reel < scatterReels
    ? [S.CORE, S.RADIO, S.RADIO]
    : [S.RADIO]);
}

export const NO_WIN_STRIPS = constantStrips([
  S.RADIO,
  S.KEYCARD,
  S.ARMOR,
  S.OPTIC,
  S.SIDEARM,
]);

export function makeConfig(overrides: Partial<Pick<
  GameConfig,
  'id' | 'baseReelStrips' | 'bonusReelStrips' | 'paylines' | 'paytable'
>> = {}): GameConfig {
  return {
    ...DEFAULT_GAME_CONFIG,
    id: overrides.id ?? 'defuse-protocol-test-fixture',
    ...overrides,
  };
}
