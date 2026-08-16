# Audio design and runtime

## Status

The production audio layer contains twenty assets: one seamless Pelagos Relay ambience loop, two seamless route-music loops, and seventeen gameplay effects covering spin motion, five reel stops, paylines, five win tiers, Signal Core activation, both route confirmations, retrigger, and feature completion. Every sound is an original deterministic synthesis committed as Ogg Vorbis; no recordings, sample libraries, game audio, voices, or third-party source material were used. Gameplay one-shots contain no synthesized noise layer, and dry results intentionally add no separate end sound.

## Direction

The sound should feel like a grounded field relay housed in worn industrial equipment. Its vocabulary is electromechanical: roller drive, contact switches, magnetic latches, filtered wind, quiet pumps, electrical hum, brass resonance, and restrained pneumatic releases. It deliberately avoids gunfire, explosions, radio chatter, recognizable announcer rhythms, science-fiction weapons, orchestral casino fanfares, and sound-alikes from named games.

The base ambience is supportive rather than musical. Win tiers become broader and more harmonic as the committed virtual-credit return increases. Relay Alpha uses a clean rising route identity and a restrained tuned relay pulse; Relay Bravo uses a lower route identity and heavier mechanical tonal rhythm. Both loops remain grounded, sparse, and subordinate to result cues.

The spin start is intentionally physical rather than electronic: a lever detent, low dry roller contacts, internal weight transfer, and mechanical release lead into the five separate reel latches. It contains no rising synthesized motor sweep or broadband noise layer.

## Source and reproduction

[`scripts/generate-audio.mjs`](../scripts/generate-audio.mjs) synthesizes 44.1 kHz PCM from explicit oscillators, envelopes, damped resonators, periodic ambience/music components, and deterministic numeric seeds. It creates temporary WAV intermediates, encodes Ogg Vorbis with FFmpeg, removes metadata, records byte sizes and SHA-256 hashes in `src/assets/audio/generated-audio.json`, and deletes the intermediates. A bounded three-attempt encoder retry tolerates transient Windows process-launch failures without hiding a persistent error. Re-running the generator on the verified toolchain produced identical hashes for all twenty files and leaves byte-identical outputs untouched.

To regenerate the runtime files, install FFmpeg with `libvorbis` support and run:

```bash
npm run generate:audio
```

The generator metadata is the machine-readable source record. The public provenance manifest and human review record remain authoritative for licensing and approval.

## Runtime architecture

The browser audio layer is presentation-only and is kept outside the mathematical engine:

```text
Committed SpinResult
  -> pure cue planner (timing and tier selection)
  -> AudioDirector (Web Audio mixer)
     -> master gain
        -> ambience gain -> looping relay ambience
        -> music gain -> selected Alpha/Bravo loop
        -> effects gain  -> spin/result/feature cues
```

The complete result exists before any cue is scheduled. The cue planner reads `totalPayout`, `wager`, `bonusOffer`, and `bonusEvent`; it cannot select stops, consume randomness, calculate payout, or mutate the session. Audio failure therefore cannot affect game state. Bonus autoplay uses the same application transition and the same result-derived cue planner as a manual spin.

Browsers require a user gesture before sound can begin. The mixer remains locked until the first eligible spin, route choice, or preview. It then loads local assets, starts the ambience, and reports `ready`; a missing Web Audio implementation or asset failure reports `unavailable` without interrupting play.

## Controls and accessibility

The Audio console provides:

- persistent mute;
- independent master, relay-ambience, feature-music, and game-effect levels; and
- representative preview buttons for spin, payline, win, and Signal Core cues.

Preferences use a validated, versioned local-storage record and safely fall back to defaults if storage is unavailable or corrupt. No result is communicated through sound alone: the same states remain visible through committed totals, payline traces, full-name ledgers, feature dialogs, meters, and screen-reader status text. Reduced-motion mode compresses presentation cue delays without changing cue meaning or results.

## Cue mapping

| Event | Cue behavior |
| --- | --- |
| Eligible spin starts | Mechanical lever/roller assembly, then five ordered latch contacts |
| No payout | No additional cue; the final clean reel latch ends the presentation |
| Positive payout below 5× | Payline trace plus small/medium confirmation |
| 5× to below 10× | Strong-return harmonic confirmation |
| 10× to below 25× | Dedicated big-win sequence |
| 25× or higher | Dedicated major-recovery sequence |
| CORE offer, collection, or retrigger | Signal Core charge and containment lock |
| Relay Alpha chosen | Three-stage rising containment identity |
| Relay Bravo chosen | Low mechanical recovery identity |
| Route active | Crossfaded route-specific seamless music loop |
| Feature retrigger | Secured-spin extension confirmation |
| Final feature spin | Route music fades and completed-operation confirmation plays |

## Verification

Unit tests cover cue ordering, all payout tiers, feature-event mapping, route identities, completion, reduced-motion timing, version-one preference migration, current preference parsing, persistence, and storage failures. Browser coverage exercises the Audio console, music-volume persistence, route entry, complete feature flow, and ordinary mute/volume behavior. Asset review checks runtime format, channel count, sample rate, conservative peaks, deterministic hashes, provenance completeness, and the absence of third-party material.
