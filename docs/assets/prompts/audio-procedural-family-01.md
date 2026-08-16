# Generation record: Procedural audio family 01

- **Family ID:** `audio-procedural-family-01`
- **Creation date:** 2026-08-16
- **Creator:** Yevhen Mishchenko
- **Tool class:** Repository-owned JavaScript PCM synthesizer plus local FFmpeg Ogg Vorbis encoder
- **Source:** `scripts/generate-audio.mjs`
- **Runtime record:** `src/assets/audio/generated-audio.json`

## Method

No text-to-audio model, recording, external sample, downloaded sound, or third-party reference was used. The generator constructs every sample from sine oscillators, damped resonances, frequency sweeps, envelopes, and deterministic periodic ambience components at 44.1 kHz. Gameplay one-shots contain no synthesized noise generator. It normalizes conservatively, writes temporary 16-bit PCM WAV data, encodes Vorbis q5 without metadata, hashes the runtime files, and removes the intermediates.

Each asset has an explicit numeric seed in the runtime record. Re-running the complete generator on the verified toolchain produced byte-identical Ogg files and matching SHA-256 values.

## Creative brief encoded in the source

- Pelagos Relay ambience: quiet coastal wind through metalwork, pump cycles, and electrical hum.
- Reel motion: grounded lever detent, low dry roller contacts, internal weight transfer, mechanical release, and five pitch-varied magnetic latch contacts. The spin bed contains no rising electronic motor sweep and no broadband or filtered-noise layer.
- Results: brass relay trace plus small, medium, large, big, and major harmonic confirmations.
- Feature: Signal Core charge/lock; clean rising Alpha identity; lower mechanical Bravo identity; distinct seamless route-music loops; retrigger and completed-operation confirmations.

## Negative constraints

No Counter-Strike or other named-game audio, copied announcement rhythm, gunfire, explosions, shell impacts, radio chatter, voice lines, sirens, militaristic commands, recognizable product sound, casino coin shower, orchestral jackpot fanfare, science-fiction weapon, brand, real organization, real-money promise, personal data, or hidden third-party input.

## Review result

Approved on 2026-08-16 and extended the same day. Source inspection confirmed that synthesis is deterministic, self-contained, and contains no gameplay noise layer. The separate dry-result tail remains removed. File inspection confirmed 44.1 kHz runtime output, intended channel counts, and documented lengths for all twenty assets. Hash comparison after a second complete render found no differences. The family remains presentation-only and has complete visible/text equivalents.
