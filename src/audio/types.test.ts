import { describe, expect, it, vi } from 'vitest';
import {
  AUDIO_SETTINGS_STORAGE_KEY,
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  parseAudioSettings,
  saveAudioSettings,
} from './types';

describe('audio settings', () => {
  it('accepts a complete versioned preference record', () => {
    const settings = { version: 2 as const, muted: true, masterVolume: 0.5, ambienceVolume: 0.2, effectsVolume: 0.8, musicVolume: 0.35 };
    expect(parseAudioSettings(settings)).toEqual(settings);
  });

  it('migrates the complete version-one preference record with the default music level', () => {
    expect(parseAudioSettings({ version: 1, muted: true, masterVolume: 0.5, ambienceVolume: 0.2, effectsVolume: 0.8 })).toEqual({
      ...DEFAULT_AUDIO_SETTINGS,
      muted: true,
      masterVolume: 0.5,
      ambienceVolume: 0.2,
      effectsVolume: 0.8,
    });
  });

  it('rejects unsupported, incomplete, and out-of-range records', () => {
    expect(parseAudioSettings({ version: 3 })).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(parseAudioSettings({ ...DEFAULT_AUDIO_SETTINGS, masterVolume: 1.1 })).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(parseAudioSettings({ ...DEFAULT_AUDIO_SETTINGS, muted: 'yes' })).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('falls back safely when browser storage is blocked or malformed', () => {
    expect(loadAudioSettings({ getItem: () => '{bad json' })).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(loadAudioSettings({ getItem: () => { throw new Error('blocked'); } })).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('persists under the versioned project key without surfacing storage failures', () => {
    const setItem = vi.fn();
    saveAudioSettings({ setItem }, DEFAULT_AUDIO_SETTINGS);
    expect(setItem).toHaveBeenCalledWith(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_AUDIO_SETTINGS));
    expect(() => saveAudioSettings({ setItem: () => { throw new Error('blocked'); } }, DEFAULT_AUDIO_SETTINGS)).not.toThrow();
  });
});
