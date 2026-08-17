export const AUDIO_SETTINGS_STORAGE_KEY = 'defuse-protocol:audio-settings:v2';
const LEGACY_AUDIO_SETTINGS_STORAGE_KEY = 'defuse-protocol:audio-settings:v1';

export interface AudioSettings {
  readonly version: 2;
  readonly muted: boolean;
  readonly masterVolume: number;
  readonly ambienceVolume: number;
  readonly effectsVolume: number;
  readonly musicVolume: number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  version: 2,
  muted: false,
  masterVolume: 0.72,
  ambienceVolume: 0.28,
  effectsVolume: 0.82,
  musicVolume: 0.36,
};

export type AudioCue =
  | 'ambience'
  | 'spin-drive'
  | 'reel-latch-1'
  | 'reel-latch-2'
  | 'reel-latch-3'
  | 'reel-latch-4'
  | 'reel-latch-5'
  | 'payline-trace'
  | 'win-small'
  | 'win-medium'
  | 'win-large'
  | 'core-activation'
  | 'relay-alpha'
  | 'relay-bravo'
  | 'music-alpha-core'
  | 'music-alpha-drive'
  | 'music-bravo-core'
  | 'music-bravo-drive'
  | 'win-big'
  | 'win-major'
  | 'feature-retrigger'
  | 'feature-complete';

export type AudioPreviewCue = 'spin-drive' | 'payline-trace' | 'win-medium' | 'core-activation';

export type AudioStatus = 'locked' | 'loading' | 'ready' | 'unavailable';

export interface ScheduledAudioCue {
  readonly cue: Exclude<AudioCue, 'ambience' | `music-${string}`>;
  readonly delayMs: number;
  readonly gain?: number;
}

function isFiniteVolume(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function parseAudioSettings(value: unknown): AudioSettings {
  if (!value || typeof value !== 'object') return DEFAULT_AUDIO_SETTINGS;
  const candidate = value as {
    version?: unknown;
    muted?: unknown;
    masterVolume?: unknown;
    ambienceVolume?: unknown;
    effectsVolume?: unknown;
    musicVolume?: unknown;
  };
  if (candidate.version === 1) {
    if (
      typeof candidate.muted === 'boolean'
      && isFiniteVolume(candidate.masterVolume)
      && isFiniteVolume(candidate.ambienceVolume)
      && isFiniteVolume(candidate.effectsVolume)
    ) return { ...DEFAULT_AUDIO_SETTINGS, muted: candidate.muted, masterVolume: candidate.masterVolume, ambienceVolume: candidate.ambienceVolume, effectsVolume: candidate.effectsVolume };
  }
  if (
    candidate.version !== 2
    || typeof candidate.muted !== 'boolean'
    || !isFiniteVolume(candidate.masterVolume)
    || !isFiniteVolume(candidate.ambienceVolume)
    || !isFiniteVolume(candidate.effectsVolume)
    || !isFiniteVolume(candidate.musicVolume)
  ) return DEFAULT_AUDIO_SETTINGS;
  return {
    version: 2,
    muted: candidate.muted,
    masterVolume: candidate.masterVolume,
    ambienceVolume: candidate.ambienceVolume,
    effectsVolume: candidate.effectsVolume,
    musicVolume: candidate.musicVolume,
  };
}

export function loadAudioSettings(storage: Pick<Storage, 'getItem'> | undefined): AudioSettings {
  if (!storage) return DEFAULT_AUDIO_SETTINGS;
  try {
    const stored = storage.getItem(AUDIO_SETTINGS_STORAGE_KEY) ?? storage.getItem(LEGACY_AUDIO_SETTINGS_STORAGE_KEY);
    return stored ? parseAudioSettings(JSON.parse(stored)) : DEFAULT_AUDIO_SETTINGS;
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

export function saveAudioSettings(storage: Pick<Storage, 'setItem'> | undefined, settings: AudioSettings): void {
  if (!storage) return;
  try {
    storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Audio preferences are optional; blocked storage must never block play.
  }
}
