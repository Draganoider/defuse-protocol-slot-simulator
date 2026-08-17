# Runtime diagnostics and crash recovery

## Purpose and limits

Defuse Protocol keeps a small local diagnostic ring so an intermittent browser failure can be investigated after reload. The log records technical presentation and game-transition events only. It does not contain names, email addresses, account data, browsing history, payment information, or remote telemetry, and it is never transmitted automatically.

A complete Chromium renderer-process crash cannot run JavaScript at the instant it fails. The log therefore preserves the bounded sequence immediately before the crash and marks an unclean session on the next load; it cannot provide Chromium's native crash dump or guarantee the operating-system cause.

## Storage and controls

- Storage key: `defuse-protocol:diagnostics:v1`
- Related local key: `defuse-protocol:play-record:v1` holds the browser-local play record described in the [architecture](architecture.md). It contains counters only, is never transmitted, is not shared between visitors or devices, and is discarded when the build identifier changes.
- Capacity: latest 240 events
- Location: browser local storage on the current device
- Remote service: none
- UI: **Diagnostics** in the application header

The panel shows formatted JSON, supports copying it into a bug report, and can clear the local log. After a tab crash, reload the simulator and copy the log before clearing it. An `unclean-session-recovery` event means the previous page did not reach its normal `pagehide` cleanup; it is evidence of an interrupted session, not proof of a particular cause.

## Recorded events

The initial implementation records:

- application start, graceful page exit, and unclean recovery;
- accepted, blocked, and completed spin transitions;
- payout, wager, payline count, CORE count, phase, and RNG positions required to reproduce a result;
- bonus-route selection and session reset;
- audio-context readiness/state, cue-cap drops, failures, and disposal;
- PixiJS readiness, periodic render heartbeat, context loss/restoration, initialization failure, and disposal;
- simulation worker errors;
- global JavaScript errors, unhandled promise rejections, and React error-boundary failures.

The log intentionally does not store the visible symbol grid because result RNG positions and configuration identity are sufficient for the current deterministic engine, while keeping each entry compact.

## Crash hardening

Diagnostics accompany three safeguards:

1. A 180 ms spin-entry gate prevents a synchronous click burst from entering the application handler more than once before React commits the presenting state. The existing phase lock remains authoritative for the full presentation.
2. Web Audio one-shot sources and their gain nodes disconnect when playback ends. Active one-shots are capped at 32, with excess cues dropped and logged rather than increasing resource pressure.
3. PixiJS follows the browser's display-synchronized animation frame rate, records WebGL context loss, stops expensive redraws while idle, and retains its existing destruction and resize cleanup.
4. The renderer rebuilds its scene on every animated frame and releases the previous frame completely, including each `Graphics` object's owned `GraphicsContext`. PixiJS keeps that tessellated geometry alive unless `context: true` is requested at destruction, so omitting it retained every shape drawn since page load.

### Resolved P1 — long play exhausted the browser tab

**Symptom:** after roughly a minute of continuous play the tab reported that the page had crashed. The React error boundary cannot recover from this because the renderer process itself is terminated.

**Cause:** the per-frame scene teardown destroyed display objects with `destroy({ children: true })`. PixiJS only releases a `Graphics` object's owned `GraphicsContext` when the destroy options request it, so every shape drawn in every frame retained its geometry buffers. A measured session grew the JavaScript heap by roughly 75 MB per spin and reached the 4 GB tab limit in about 55 spins.

The functional `CORE` and `WILD` nameplates compounded the cost. A PixiJS `TextStyle` is
keyed by instance, so building one per frame rasterized a fresh canvas, uploaded a new GPU
texture on every redraw, and left a permanent entry in the text system's active-texture map
for every key it had ever seen. Each nameplate is now rendered once per font size and reused.

**Verification:** after both fixes, a 100-spin session sampled every 400 ms returned to a
30–43 MB baseline in every 30-second window, with only transient peaks between collections.
`sustained play keeps the renderer heap bounded` in the Playwright suite guards the regression.

The deterministic engine remains unchanged. These guards affect input and presentation resources only and never alter a result after generation.

## Development asset regeneration

The audio generator writes a runtime asset or metadata record only when its bytes changed. Re-running it for deterministic verification no longer rewrites every unchanged file or creates a Vite hot-reload storm while the development page is open.
