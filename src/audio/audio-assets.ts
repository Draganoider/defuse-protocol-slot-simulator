import type { AudioCue } from './types';

export const AUDIO_ASSET_URLS: Readonly<Record<AudioCue, string>> = {
  ambience: new URL('../assets/audio/ambience-pelagos-relay-loop-01.ogg', import.meta.url).href,
  'spin-drive': new URL('../assets/audio/sfx-spin-drive-01.ogg', import.meta.url).href,
  'reel-latch-1': new URL('../assets/audio/sfx-reel-latch-01.ogg', import.meta.url).href,
  'reel-latch-2': new URL('../assets/audio/sfx-reel-latch-02.ogg', import.meta.url).href,
  'reel-latch-3': new URL('../assets/audio/sfx-reel-latch-03.ogg', import.meta.url).href,
  'reel-latch-4': new URL('../assets/audio/sfx-reel-latch-04.ogg', import.meta.url).href,
  'reel-latch-5': new URL('../assets/audio/sfx-reel-latch-05.ogg', import.meta.url).href,
  'payline-trace': new URL('../assets/audio/sfx-payline-trace-01.ogg', import.meta.url).href,
  'win-small': new URL('../assets/audio/sfx-win-small-01.ogg', import.meta.url).href,
  'win-medium': new URL('../assets/audio/sfx-win-medium-01.ogg', import.meta.url).href,
  'win-large': new URL('../assets/audio/sfx-win-large-01.ogg', import.meta.url).href,
  'core-activation': new URL('../assets/audio/sfx-core-activation-01.ogg', import.meta.url).href,
  'relay-alpha': new URL('../assets/audio/sfx-relay-alpha-01.ogg', import.meta.url).href,
  'relay-bravo': new URL('../assets/audio/sfx-relay-bravo-01.ogg', import.meta.url).href,
  'music-alpha': new URL('../assets/audio/music-relay-alpha-loop-01.ogg', import.meta.url).href,
  'music-bravo': new URL('../assets/audio/music-relay-bravo-loop-01.ogg', import.meta.url).href,
  'win-big': new URL('../assets/audio/sfx-win-big-01.ogg', import.meta.url).href,
  'win-major': new URL('../assets/audio/sfx-win-major-01.ogg', import.meta.url).href,
  'feature-retrigger': new URL('../assets/audio/sfx-feature-retrigger-01.ogg', import.meta.url).href,
  'feature-complete': new URL('../assets/audio/sfx-feature-complete-01.ogg', import.meta.url).href,
};
