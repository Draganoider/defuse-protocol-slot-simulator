# Asset card: Procedural audio family 01

## Identity

- **Family ID:** `audio-procedural-family-01`
- **Runtime assets:** one ambience loop, two feature-music loops, and seventeen `sfx-*` files listed in `src/assets/audio/generated-audio.json`
- **Gameplay role:** Background atmosphere, route music, and non-authoritative presentation feedback for reels, results, paylines, wins, CORE events, retriggers, route selection, and feature completion
- **Owner / creator:** Yevhen Mishchenko
- **Created and approved:** 2026-08-16
- **Rights basis:** Project-owned original deterministic synthesis with no recordings, samples, references, voices, or third-party creative inputs
- **License:** MIT
- **Generation record:** `docs/assets/prompts/audio-procedural-family-01.md`

## Direction

Grounded Pelagos Relay machinery: filtered coastal wind, quiet pump cycles, electrical hum, a noise-free mechanical lever-and-roller reel assembly, magnetic contacts, brass resonance, and restrained pneumatic release. The family must remain subtle enough for repeated spins and must not resemble gunfire, explosions, radio chatter, casino fanfares, science-fiction weapons, or recognizable audio from another game.

## Technical specification

- 44.1 kHz Ogg Vorbis q5 runtime delivery
- stereo ambience and music loops; mono one-shot effects
- deterministic numeric seed per asset
- conservative synthesized peak normalization
- no embedded source metadata
- ambience and route music composed from integer-period components for continuous loops
- exact duration, channel count, byte size, seed, and SHA-256 in `src/assets/audio/generated-audio.json`

## Acceptance gates

- [x] Every sound is generated from repository source code without third-party samples or network inputs.
- [x] The family has a distinct original tactical-industrial identity without named-game imitation.
- [x] No voice, brand, real organization, combat report, gore, real-money cue, or personal information is present.
- [x] Gameplay remains complete and understandable while muted.
- [x] All cues schedule only after the engine supplies an immutable result.
- [x] Master, ambience, music, effects, and persistent mute controls are available.
- [x] Reduced-motion mode compresses cue timing without changing results.
- [x] Reproduction yielded identical hashes for all twenty assets.
- [x] Runtime format, sample rate, channels, peak policy, paths, and provenance were reviewed on 2026-08-16.
