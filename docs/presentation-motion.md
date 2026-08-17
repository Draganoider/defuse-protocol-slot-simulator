# Result-driven presentation

## Status and purpose

This document describes the implemented reel-motion and result-feedback layer. It is a presentation contract only: the mathematical engine produces the complete result before any animation starts, and presentation timing never selects stops, changes a payout, or consumes randomness.

## Data boundary

The application commits the authoritative `SpinResult`, transposes its reel-major grid for display, derives de-duplicated paying cells from `lineWins[].positions`, and resolves each evaluated line index against the declared fixed paylines for its complete five-reel route. Each presentation record retains its line index, symbol identifier, payout, full route, and exact paying positions. React passes the immutable grid, presentation phase, paths, cells, chosen bonus route, and reduced-motion preference to PixiJS.

PixiJS may emphasize supplied paths, cells, and CORE symbols, but it does not evaluate paylines or infer a payout. React owns the visible and assistive result message, large confirmed-win total, full-name payline ledger, balance, last win, route status, and feature meters.

## Implemented sequence

1. The engine returns the complete result and next deterministic session state.
2. The application commits the final grid, payout, replay identifier, exact winning cells, and evaluated payline paths.
3. The UI enters `spinning`; controls lock and the live region states that a committed result is being presented.
4. Reels decelerate with a 244 ms base duration and 47 ms stagger per column. The fifth reel settles by 432 ms unless a reel is held for a possible trigger.
5. At 520 ms, or after the last held reel lands, the application enters the authoritative next phase: result, route choice, or active bonus.
6. A layered amber trace follows the exact winning route while non-winning cells temporarily dim. Each line draws, holds briefly, and then advances once to the next line. Up to four lines are presented in payout order; the ledger retains the complete result.
   The trace is drawn only by the renderer that draws the reels, so it always uses the same
   board geometry as the symbols underneath it. `planWinSequence` owns which route is active
   and how far it is drawn, which keeps that timing contract unit-tested rather than buried in
   a render loop.
7. The committed payout divided by wager selects a presentation-only tier: standard below 5×, strong from 5×, big from 10×, and major from 25×. The tier scales cabinet response, Pixi sweeps/rings/particles, the counted headline, and the result cue; it never changes math.
   Larger returns hold longer and count longer, so the number is readable rather than instant:

   | Tier | Hold | Counted total |
   | --- | ---: | ---: |
   | Standard | 850 ms | 520 ms |
   | Strong | 1,900 ms | 950 ms |
   | Big | 3,600 ms | 1,950 ms |
   | Major | 5,200 ms | 2,900 ms |

   `WIN_TIER_DURATION_MS` and `WIN_TIER_COUNT_MS` are the single source for these values. The
   same hold gates the canvas tier effects, the celebration layers, and the automatic
   feature-spin interval, so every layer clears together. The confirmed-total bar and the
   celebration overlay share one counter, which eases in and out so a long count builds
   instead of resolving in its first third.
8. After the trace lands, a large `+N VC` total, full-symbol-name payline ledger, and grounded cabinet/background response confirm the same committed payout. Big and major tiers add a centered celebration overlay. CORE positions receive a short activation ring during bonus entry.

Ordinary symbol textures carry no three-letter abbreviations. The functional `CORE` and `WILD` marks use condensed industrial nameplates, while the accessible HTML ledger supplies full symbol names and exact per-line virtual-credit values.

The scoreboard and control deck remain directly below the reels in every base-game state. Dynamic win totals, feedback, and line ledgers render after that fixed control region, so a result cannot move the Spin button away from the pointer between clicks.

## Scatter anticipation

When the reels that have already settled hold exactly one Signal Core fewer than the trigger
requires, every following reel keeps running for an extra 700 ms before it settles. The hold
is cumulative, so a spin that lands both Cores on the opening reels holds reels three, four,
and five in turn.

The plan is derived from the committed result by `planSpinTiming` before the first frame is
drawn, and it is shared by the phase timer, the renderer, and the audio cue plan so all three
agree on when each reel lands. Anticipation changes only how long a reel is displayed running:
it never selects a stop, consumes randomness, delays a landing position, or alters a payout.

Nothing is drawn until the Cores that created the wait have actually landed, so the treatment
never reveals a position before its reel settles. From that moment the settled Cores carry a
pulsing ring and the single reel currently being waited on is outlined; the outline advances
reel by reel as each one lands. A held reel runs at a slow constant 1.8 grid cycles per second
and its settle travel is re-aligned so it still lands on an exact grid boundary. Each held reel
also gets a second, quieter pass of the reel mechanism so the wait is audible.

Reduced motion has no anticipation: it keeps its immediate stable grid, which is the same
contract it already had for every other presentation stage.

## Route choice presentation

The Signal Core route choice is a popup anchored inside the reel frame, directly over the grid that produced the trigger, so the required decision reads as part of the machine rather than as a separate page section. A sibling viewport lock dims and blocks the remainder of the console while the offer is pending, the cabinet stays lifted above that lock, and **New seed** is disabled so a pending offer cannot be discarded by an unrelated control. Focus moves to the first route and stays inside the popup. Below 780 px the reel frame is too short for the full panel, so the popup switches to a compact two-column card and keeps its description in the accessibility tree.

Every other console panel — paytable, laboratory, audio, diagnostics, and the completed-feature summary — remains a viewport-centered modal and closes on Escape. Those panels are direct children of the application shell, so the shell must never apply a blanket positioned-child rule: doing so outranks the dialog's own `position: fixed` and silently returns every dialog to the document flow beneath the game.

Relay Alpha crossfades the base depot into a project-owned early-dusk plate with cold practical work lights, muted signal-green atmosphere, and brass containment rails. Relay Bravo uses a storm-dark damp depot plate, practical oxide/amber warning fixtures, and recovery rails. Before a route is chosen, the route dialog and canvas use a restrained dual-tone state. A route plate remains through the final result and completed-feature summary, then returns to base. These treatments communicate a selected route but do not alter feature behavior.

## Bonus autoplay

Choosing either route enables automatic free spins and its original music loop. React waits 650 ms after an active-feature no-win presentation becomes ready, invokes one deterministic `spinBonus` transition, commits that result, and only then begins its presentation. A winning feature result is held for at least 1,800 ms, the selected tier duration plus 420 ms, and, for multi-line wins, until 200 ms after the final displayed 900 ms line slot. A measured Relay Bravo run held a blank spin for 0.65 s, a 1.5× return for 1.8 s, a 10× return for 4.0 s, and a 43× return for 5.6 s. It schedules the following spin only after the preceding presentation completes. Pause/Resume controls future scheduling; pausing during or after a presentation never cancels, redraws, or mutates a committed result. A paused feature states that automatic spins are paused even while a payout is on screen, so the reason play has stopped is always visible. The final feature spin fades route music, plays a completion cue, and opens a semantic summary with route, spins played, and accumulated virtual-credit return. Session reset and route entry return autoplay to its default enabled state.

## One renderer owns the reel surface

Anything drawn over the grid — traces, dimming, contact marks, scatter anticipation — is drawn
by the PixiJS renderer, because only it knows the board layout it computed for the symbols.

An earlier build also drew the winning routes a second time as an HTML overlay above the
canvas. That overlay mapped a fixed five-by-three viewBox onto its own box, while the renderer
centres a square-cell board with gaps inside the canvas. The two grids agreed only at the
centre cell and drifted about sixteen pixels apart at the corners, so every win showed two
traces slightly out of register. The overlay also set `stroke-dasharray: 1` together with
`vector-effect: non-scaling-stroke`, which makes the dash pattern screen-space: instead of one
dash covering the route and animating on, it rendered as a chain of one-pixel beads. Both
problems came from duplicating the drawing rather than from either technique, so the overlay
was removed.

## Accessibility and failure behavior

- Reduced motion skips the presentation delay and shows a stable final grid with a static payline, ledger, and confirmed total.
- The cabinet exposes `aria-busy` only while presenting the committed result.
- Space invokes the same base-game Spin intent as the button. Repeats, modified key presses, active dialogs, focused interactive controls, feature autoplay, and locked presentation states do not trigger it.
- A polite atomic live region announces locked, winning, no-payout, route-choice, and active-feature states.
- Relay Alpha exposes containment charges as a semantic progress bar.
- When the remaining balance cannot cover the current wager, Spin is disabled and labeled, the live region names the shortfall, and the wager controls stay enabled so play resumes without a session reset.
- Relay Bravo exposes its current multiplier and protection state as text.
- Active routes expose a keyboard-operable Pause/Resume control and announce whether the next spin is automatic or paused.
- Asset or renderer initialization failures show a visible fallback while engine controls and mathematics remain available.
- No repeated flash exceeds the project safety rules, and color is never the only result or route cue.

## Verification

Browser coverage verifies normal presentation locking, unchanged result/provenance across the animation boundary, exact line-ledger and confirmed-total output, deterministic big/major tiers, both route environment states, complete Bravo summary/return-to-base flow, reduced-motion completion and stability, responsive layout, and equality of deterministic results between normal and reduced-motion runs.
