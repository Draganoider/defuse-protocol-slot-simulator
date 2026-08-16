# Prototype QA report

**Date:** 2026-08-16  
**Scope:** Initial Defuse Protocol prototype

## Automated checks

| Check | Result |
| --- | --- |
| `npm test` | Pass — 8 files, 45 tests |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| Playwright development flows | Pass — 17 tests |
| Development server response | Pass — local server returned HTTP 200 |

The existing automated coverage verifies deterministic base spins, grid construction,
payline/wild/scatter evaluation, ordinary and forced bonus entry, Alpha extraction,
Bravo multiplier/protection behavior, retrigger caps, simulation reproducibility, and
main-thread/worker report parity. It also verifies that the developer-cheat factory is
not exported by the public engine entry point.

The audio additions cover deterministic cue ordering, committed-return win tiers,
feature and route mapping, reduced-motion timing, versioned preference validation,
blocked/corrupt storage fallback, persistent mute/volume controls, and preview activation.

## Browser smoke-test status

The interrupted Windows sandbox state was repaired on 2026-08-16 and the in-app
browser became available again. The development build now remains visible after
React's development-mode effect cycle, renders the complete PixiJS grid, and completes
an ordinary spin. The verified smoke spin changed the balance from 2,000 to 1,980
virtual credits, returned the Spin control to its ready state, and produced no browser
console errors.

The blank-screen regression was caused by destroying a PixiJS `Application` before
its asynchronous initialization completed during React Strict Mode cleanup. The
renderer now tracks successful initialization before destruction and catches
initialization failures with a visible fallback. Full 390 px, keyboard,
reduced-motion, and forced Alpha-entry coverage now runs in Playwright. Keyboard,
full route completion, Lab interaction, and broader browser coverage remain recommended.

## Findings

### Resolved P2 — production bundle retained development cheat labels

**Reproduction:** Run `npm run build`, then search `dist/assets/index-*.js` for
`DEV CHEATS` or `Force 3 CORE`.

The cheat presentation now lives in a development-gated lazy module. Development builds
retain the full menu for forced 3-, 4-, and 5-CORE testing. A production build and an
explicit search of `dist/assets/` contain none of the cheat labels and generate no
`DevCheats` chunk. The cheat factory remains absent from the public engine index.

### Resolved P3 — wager controls remained enabled during an active feature

**Reproduction:** Enter either route, then inspect the wager plus/minus controls while
automatic free spins are active or paused.

The wager controls are now visibly disabled during an active feature while the
Pause/Resume autoplay control remains enabled between presentations. Playwright verifies
this presentation state for both routes and the application callback remains a second guard.

## Grounded production asset QA

The approved visual slice was redesigned after the first version read as excessively
futuristic. It now contains eleven 512×512 RGBA WebP symbol textures and three 2560×1440
RGB WebP environment. File inspection confirmed real 0–255 alpha ranges for the complete
symbol family. The artwork uses grounded late-1990s/early-2000s materials: worn olive
equipment, canvas, dull steel, sand polymer, and a sun-worn coastal concrete depot.
The Carbine and Sidearm are original unbranded fictional designs, isolated without firing,
ammunition, people, combat context, or decorative skins. Every symbol retains a distinct
silhouette and readable value structure without depending on its accent color.

Live browser review confirmed that the new Pelagos Relay background preserves foreground
contrast and that the redesigned CORE texture loads in the forced feature grid. The
cabinet, reel cells, typography, dialog, scoreboard, and primary control now use a
restrained olive, concrete, canvas, amber, and brass palette without cyan glow effects.
Production symbols use procedural fallbacks if loading fails. The Playwright flows
cover app stability, committed-result locking and provenance, exact winning-line and
prominent-total output, the retained development cheat, both Alpha and Bravo continuations,
bonus wager locking, 390 px overflow, reduced-motion stability, and deterministic equality
across motion preferences without application console errors.

## Result-driven motion QA

The application derives exact winning cells and ordered payline paths from the
authoritative `SpinResult` and passes them to PixiJS alongside the already committed
grid and selected bonus route. The presentation traces the evaluated path across all
five reels, marks only the paying positions, dims non-winning cells, and cycles multiple
paths without recalculating payout. React exposes the same committed result through a
large `+N VC` total, a full-symbol-name line ledger, visible
feedback, an atomic polite live region, `aria-busy`, Alpha progress semantics, and Bravo
multiplier and protection labels. Ordinary symbols no longer carry three-letter text;
only the functional CORE and WILD marks retain purpose-built condensed nameplates.

Live desktop review caught and resolved two presentation defects before release: the
first total plaque obscured the final symbols, and the canvas trace could stop at the
beginning of a new cycle. The confirmed total now has a dedicated bar below the unobscured
reels. A follow-up lifecycle fix replaced the persistent strongest-line overlay with a
one-pass draw, hold, fade, and advance sequence. Live verification observed an active
line at opacity 1 and the same line cleared to opacity 0 after its 900 ms slot. An automated
Playwright flow verifies that animated paths clear after the complete sequence. Review at
a 390 × 844 viewport confirmed aligned geometry and readable result hierarchy. A fresh
browser session reported no warning or error logs.

Keyboard and pointer-stability QA verifies that Space starts exactly one base spin, cannot
queue another transition during presentation, and does not spin while a dialog is active.
The Spin button advertises `aria-keyshortcuts="Space"`. Moving all dynamic result panels
below the fixed scoreboard and control deck keeps the button at the same document
coordinate before and after a win; automated and live checks both measured a zero-pixel
vertical delta.

Automated comparison confirms that the scoreboard, seed, replay identifier, and
configuration provenance do not change across the normal presentation boundary. A
second deterministic comparison confirms identical result/provenance fingerprints when
the same seed is run with normal and reduced-motion presentation.

Bonus autoplay QA covers both routes. Route selection enables autoplay, Pause prevents
the pending spin from being requested, Resume requests exactly one engine transition
before presentation, and the next request waits until that presentation completes. Live
review confirmed the paused Alpha state, disabled wager controls, remaining-spin meter,
CORE treatment, and visible development-fixture provenance. The complete eleven-symbol
contact sheet and desktop/mobile runtime layouts were reviewed; the 390 px document has
no horizontal overflow and a fresh browser session reports no warnings or errors.

## Win-tier VFX and feature environment QA

Win intensity is derived only from the committed payout-to-wager ratio: standard below
5×, strong at 5×, big at 10×, and major at 25×. Unit tests cover every boundary. Two
deterministic browser fixtures verify the complete presentation path without altering
the engine result: seed `00000001-000000f3` produces a 244-credit big win and seed
`00000001-000000ff` produces a 639-credit major win. Both show the prominent count-up,
payline treatment, cabinet/background response, and tier-specific Pixi effects. Reduced
motion presents the final amount immediately and removes shake, sweeps, and particle
travel while preserving the same payout and semantic announcement.

The Alpha and Bravo environments are original generated edits of the approved Pelagos
Relay base scene. Runtime inspection confirmed both 2560×1440 WebP files, and visual
review confirmed a quiet reel area, readable controls, grounded concrete and steel
materials, practical cold/amber lighting, and no copied branding or futuristic devices.
The application crossfades from the base depot into the selected route, retains the
route during automatic feature spins, and returns to base only after the feature summary
is dismissed.

A complete forced-Bravo browser flow ran through all automatic spins and reached the
feature summary with the final virtual-credit return and spin count. Returning to base
stopped route music, restored the base environment, and re-enabled the normal controls.
Fresh-browser console and page-error capture reported no warnings or errors.

## Production cheat boundary

The production build contains no `createDeveloperCheatBonus` reference, the normal
engine entry point does not export it, and the development-only presentation strings
are pruned from production output. Development builds intentionally retain the menu for
QA fixtures.

## Original audio QA

The repository contains twenty 44.1 kHz Ogg Vorbis files produced entirely by
`scripts/generate-audio.mjs`: one stereo 10-second ambience loop, two stereo 12-second
route-music loops, and seventeen mono effects. The generator uses explicit oscillators,
envelopes, and deterministic periodic components,
conservative peak normalization, temporary PCM intermediates, and metadata-free Vorbis
encoding. No recordings, sample packs, game audio, voice material, or network inputs are
used. A second complete render produced identical SHA-256 hashes for every runtime file.

The Web Audio mixer loads only local approved assets after a user gesture. Master,
ambience, music, effects, and mute controls persist through a validated versioned preference
record. Sound failures fall back to silent play. Cue scheduling reads the immutable
`SpinResult` after the engine has finished; it neither consumes RNG nor mutates a payout.
Bonus autoplay calls the same audio path as manual bonus spins. Every meaningful cue has
an existing visual and semantic equivalent.

Route selection starts the matching original Alpha or Bravo music loop and crossfades
away any previous route. Feature completion adds an original completion stinger, stops
the loop, and leaves the summary readable without continuous music. Big and major wins
use distinct original stingers, while feature retriggers receive a short functional cue.
The version-2 preference record adds an independent music level and migrates complete
version-1 records; browser coverage confirms that the music value persists after reload.
The deterministic encoder includes a bounded retry for transient Windows FFmpeg process
startup failures and still writes only byte-changed outputs.

All gameplay one-shots are noise-free. The no-payout release was removed, so a dry spin
ends on the final clean reel latch rather than adding a separate hiss, scrape, or tail.

## Crash diagnostics and resource hardening

A reported Codex in-app Chromium renderer crash showed the browser's native “page
crashed” surface while the Vite server remained responsive with HTTP 200 and no server
exception. The terminal did show dozens of asset-triggered hot reloads during repeated
audio verification. The generator now performs byte comparisons and leaves unchanged
runtime assets and metadata untouched.

The application retains the latest 240 local technical events across reload, detects an
unclean previous session, and exposes copy/clear controls through the Diagnostics dialog.
Global errors, unhandled rejections, React failures, spin transitions, audio state, and
Pixi renderer/context events are covered. No remote telemetry or personal data is used.
The log cannot capture Chromium's native crash dump after the renderer process has died.

Audio one-shots now disconnect sources and gains on completion and cap concurrency at
32. A separate 180 ms spin-entry gate prevents synchronous click bursts from re-entering
the handler before the normal presenting-phase lock commits. PixiJS animation follows
the browser's display-synchronized frame rate and stops expensive redraws while idle.
Browser coverage verifies diagnostic visibility, committed-spin records, that
a 100-click synchronous burst produces exactly one engine transition, and that 30 fast
accepted spins retain one renderer canvas and a bounded diagnostic log.
