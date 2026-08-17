# Prototype QA report

**Date:** 2026-08-16  
**Scope:** Initial Defuse Protocol prototype

## Automated checks

| Check | Result |
| --- | --- |
| `npm test` | Pass — 9 files, 55 tests |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| Playwright development flows | Pass — 23 tests |
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

### Superseded P2 — production bundle retained development cheat labels

**Original finding:** a production build contained the `DEV CHEATS` and `Force 3 CORE`
labels. The cheat presentation was moved into a development-gated lazy module, and a
production build then contained no cheat labels and no `DevCheats` chunk.

**Reversed deliberately on 2026-08-17.** The project owner chose to ship the menu in every
build so the feature can be demonstrated on the published site. The gate was removed and the
`DevCheats` chunk is expected in `dist/assets/`. This is a considered trade-off rather than a
regression: the simulator uses virtual credits only, the menu states what it does, and the
provenance boundary that protects the mathematics is unchanged — the factory is still absent
from the public engine index, still consumes no randomness, still marks its results
`developerGenerated`, still labels the replay `DEV-FORCED-n-CORE`, and is still excluded from
simulation. A forced feature therefore cannot be mistaken for an ordinary spin or counted in
observed statistics. Anyone repackaging this project for a context where a reachable cheat
control is unacceptable should restore the `import.meta.env.DEV` gate in
`src/ui/Prototype.tsx` and `src/App.tsx`.

### Resolved P3 — wager controls remained enabled during an active feature

**Reproduction:** Enter either route, then inspect the wager plus/minus controls while
automatic free spins are active or paused.

The wager controls are now visibly disabled during an active feature while the
Pause/Resume autoplay control remains enabled between presentations. Playwright verifies
this presentation state for both routes and the application callback remains a second guard.

### Resolved P1 — long play crashed the browser tab

**Reproduction:** play continuously for about a minute, or run the automated equivalent of
roughly 55 spins, and observe the tab report that the page crashed.

The per-frame scene teardown in `src/renderer/ReelCanvas.tsx` destroyed display objects with
`destroy({ children: true })`. PixiJS releases a `Graphics` object's owned `GraphicsContext`
only when the destroy options request it, so the tessellated geometry of every shape drawn
since page load stayed resident. Live measurement in a 4 GB tab recorded 463 MB after seven
spins, 2,060 MB after 28, and 3,195 MB after 42 — a crash was inevitable within a minute.

The renderer now destroys with `{ children: true, context: true }` while explicitly retaining
shared symbol textures. A second contributor was removed at the same time: the CORE and WILD
nameplates built a new `TextStyle` on every frame, and because PixiJS keys a style by instance
this rasterized a fresh canvas, uploaded a new GPU texture per redraw, and left a permanent
entry in the text system's active-texture map. Nameplates are now rendered once per font size.

After both fixes, a 100-spin session sampled every 400 ms returned to a 30–43 MB baseline in
every 30-second window, and a longer session covering completed Alpha and Bravo routes showed
no upward trend in the retained set. `sustained play keeps the renderer heap bounded` guards
the regression.

### Resolved P1 — every dialog rendered below the console instead of over it

**Reproduction:** trigger a Signal Core event, or open the paytable, laboratory, audio, or
diagnostics panel, and observe the panel appended to the bottom of the page.

A stacking rule added with the atmosphere layers, `.dp-prototype > :not(.dp-win-ambient):not(.dp-route-atmosphere)`,
outranked `.dp-overlay` and replaced `position: fixed` with `position: relative` for every
direct child of the shell. Because all dialogs are direct children, the whole modal layer
silently returned to the document flow. The rule now names the in-flow sections explicitly.

The route choice is additionally presented as a popup inside the reel frame, over the grid
that produced the trigger, with a viewport lock that keeps the rest of the console
unreachable while the offer is pending. `console dialogs open as viewport modals instead of
trailing page sections` and `the Signal Core route choice opens over the reels and locks the
console` cover both behaviors.

### Resolved P2 — an unaffordable wager ended the session silently

**Reproduction:** raise the wager above the remaining balance and press Spin.

The application recorded a rate-limited `spin-blocked` diagnostic and returned. The control
stayed enabled and nothing visible changed, which reads as a broken button. Spin is now
disabled and labeled **Out of credits**, the live region names the balance and the wager, and
the wager controls stay enabled so play resumes without a session reset.

### Resolved P3 — held or batched wager steps advanced only once

A burst of wager clicks committed in a single React batch derived every step from the same
stale session reading, so the wager moved one step regardless of the number of clicks. The
step is now derived inside the state updater.

## Anticipation and win-hold QA

Scatter anticipation is planned from the committed result before presentation begins.
Unit tests cover the natural cadence, the cumulative hold, the point at which anticipation
stops because the trigger is already met, anticipation from the second reel when both Cores
land first, strictly increasing stop times, and out-of-range scatter positions.

Live browser review used seed `00000001-00000003`, which commits Cores on reels one and two
so reels three, four, and five each still complete the trigger. The presentation ran for
2.7 s against 0.52 s for an ordinary spin. Captured frames confirmed the intended reveal
order: the settled Cores carried pulsing rings, exactly one pending reel was outlined at a
time, and the outline advanced to the next reel as each one landed. No treatment appeared
before the Cores that created the wait had settled, so no landing position is revealed early.
Playwright covers both the held spin and the unchanged length of an ordinary spin.

A live major-win capture sampled the counted total every 300 ms: it ran from 0 to the
committed 639 virtual credits over roughly 2.9 s with an ease-in-out ramp, against a
1.65 s ease-out cap previously. The confirmed-total bar and the celebration overlay now
share that counter, so the final figure is no longer displayed beside a total still counting
toward it. Both tier fixtures assert that neither readout has reached its final value shortly
after the reels settle.

A measured Relay Bravo feature confirmed that automatic spins hold in proportion to the
committed return: 0.65 s for a blank spin, 1.8 s at 1.5×, 3.8 s at 8.4×, 4.0 s at 10×, and
5.6 s at 43×. The accessible ledger, live region, and balance still state the authoritative
total immediately, so no announcement waits on an animation.

### Resolved P2 — browser tests failed on shared CI runners

**Reproduction:** push to `main` and inspect the CI workflow. Browser tests had failed on
every push since `753841b`, while passing on a development machine.

The suite assumed development-machine speed. A 15-second budget did not cover flows that
drive thirty spins, several assertions tried to observe transient states such as the 520 ms
presentation window or a 900 ms payline slot across a driver round trip, and the pause and
resume flow raced the 650 ms autoplay timer. Anticipation holds made the margins tighter.

Transient states are now sampled inside the page in a single call, the pause assertion
compares the replay identifier against itself instead of a fixed value, the pause request
retries rather than racing one click, feature tests force the longest available run so the
feature cannot end underneath them, and the budget is 60 seconds with a 10-second expect
timeout. No product behaviour was relaxed to make a test pass. One real gap surfaced and was
fixed: a paused feature reported only the payout, so the live region now also states that
automatic spins are paused.

### Resolved P2 — winning lines were drawn twice, slightly out of register

**Reproduction:** win on any payline and look at the traced route.

Two layers drew the same winning route: the PixiJS renderer and an HTML overlay above the
canvas. Measured on a 1280-wide viewport, the overlay agreed with the renderer only at the
centre cell and was sixteen pixels out horizontally and eight vertically at the corners, so the
two traces visibly diverged along their length. The overlay additionally combined
`stroke-dasharray: 1` with `vector-effect: non-scaling-stroke`, which puts the dash pattern in
screen space, so its intended draw-on animation rendered as a chain of one-pixel beads that
never advanced.

The overlay was removed and the renderer now owns the trace, which guarantees the route uses
the same board geometry as the symbols under it. The sequencing decision moved into
`planWinSequence` with unit tests covering ordering, per-cycle draw progress, the four-path
presentation cap, sequence completion, and the reduced-motion hold. Captured frames confirm one
aligned trace with contact marks on the paying cells and a clean clear after the sequence.

### Resolved P3 — the confirmed-total slot collapsed when a win landed

**Reproduction:** win on any spin and watch the total slot above the reels.

Moving the total above the reels made its element always mounted so the controls below it
cannot move. Its entrance animation was written for an element that only appeared on a win:
`dp-win-total` runs with a 420 ms delay and `animation-fill-mode: both`, so the browser holds
the 0% keyframe for the whole delay. Measured across a winning transition, the slot goes from
the idle state at opacity 1 and 104 px tall to opacity 0 and `scaleY(0.55)` at 57 px for 420 ms,
then springs to 1.08 and settles. On an always-mounted element that reads as the bar jumping
away and back rather than arriving.

Requested direction: the total should appear only when there is a return, with no styled but
empty bar between results. That has to be reconciled with the rule that a result must not move
the Spin control, which is why the slot is mounted at a fixed height in the first place. Three
candidates, cheapest first:

1. Keep the slot mounted and reserved, but make the idle state `visibility: hidden` so the space
   is held without drawing an empty bar. The entrance animation then plays inside stable space.
2. Keep it mounted and remove the delay and `both` fill, so it never holds an invisible collapsed
   state; animate only the number rather than the bar.
3. Position it over the top of the reel frame so it takes no layout space at all, at the cost of
   covering part of the top symbol row — the treatment an earlier build already rejected for
   obscuring the final symbols.

Option 1 was taken. Between results the slot keeps its box but paints nothing: its border,
background shadow, and entrance animation are dropped, its background matches the reel bezel so
the space reads as headroom rather than an empty bar, and its contents are hidden. A return then
arrives into stable space instead of collapsing a visible bar. The reserved height was also
reduced from 104 px to 82 px, with the tier font sizes capped to fit. The checks that the slot
keeps one height between idle and winning states and that the Spin control does not move across a
winning spin both still pass.

## Play record and confirmed-total placement QA

The browser-local play record is covered by unit tests for accumulation, free feature spins
counting as return without a new stake, negative net, exclusion of developer-forced results,
rejection of a record from another build, and rejection of malformed stored values. A browser
flow verifies that the summary appears only after a paid spin, states that it is this browser
only, survives a reload, and matches the Lab totals. Live review of sixteen paid spins showed
320 staked, 87 returned, a net of −233, and an observed return of 27.19 percent against the
declared long-run figure, presented with the finite-sample caveat.

The confirmed total moved above the reels so it is read before the reels themselves. Its slot is
always mounted at a fixed height, so a Playwright check confirms the slot keeps the same height
between its idle and winning states and that the Spin control does not move across a winning
spin.

### Resolved P2 — the scoreboard stated a payout before the reels settled

**Reproduction:** spin with a winning seed and read the balance and last-win figures while the
reels are still running.

Balance, last win, and the browser-local play record were all applied the moment the engine
committed the result, which is before presentation begins. Every one of them stated the payout
while the reels were still turning, so the outcome was legible early.

The stake now leaves the balance immediately, the way a cabinet debits before the reels run, and
the award, the last-win figure, and the record entry are applied at the reveal instead. The
committed result is unchanged; only the readouts wait. `a payout stays hidden until the reels
finish settling` verifies that a 244 credit return shows a 1,980 balance, a zero last win, an
idle total, and no record line during presentation, then 2,224, 244, and a recorded paid spin
afterwards.

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

The menu ships in every build by decision, gated behind an explicit `?qa=1` request so the default published page has no cheat controls. The normal engine entry point still does not
export `createDeveloperCheatBonus`, so no ordinary consumer of the engine can reach it, and
forced results stay marked and excluded from simulation. A production build served under the
GitHub Pages base path was verified on 2026-08-17: the menu is present, forcing four Cores
opened the route popup over the reels, and the replay identifier read `DEV-FORCED-4-CORE`.

## Original audio QA

The repository contains twenty 44.1 kHz Ogg Vorbis files produced entirely by
`scripts/generate-audio.mjs` and `scripts/music-engine.mjs`: one stereo 26.7-second
base-operation loop, two stereo route-music loops of 22.9 and 27.7 seconds, and seventeen
mono effects. The generator uses explicit oscillators,
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
