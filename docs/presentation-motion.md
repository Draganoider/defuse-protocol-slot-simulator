# Result-driven presentation

## Status and purpose

This document describes the implemented reel-motion and result-feedback layer. It is a presentation contract only: the mathematical engine produces the complete result before any animation starts, and presentation timing never selects stops, changes a payout, or consumes randomness.

## Data boundary

The application commits the authoritative `SpinResult`, transposes its reel-major grid for display, derives de-duplicated paying cells from `lineWins[].positions`, and resolves each evaluated line index against the declared fixed paylines for its complete five-reel route. Each presentation record retains its line index, symbol identifier, payout, full route, and exact paying positions. React passes the immutable grid, presentation phase, paths, cells, chosen bonus route, and reduced-motion preference to PixiJS.

PixiJS may emphasize supplied paths, cells, and CORE symbols, but it does not evaluate paylines or infer a payout. React owns the visible and assistive result message, large confirmed-win total, full-name payline ledger, balance, last win, route status, and feature meters.

## Implemented sequence

1. The engine returns the complete result and next deterministic session state.
2. The application commits the final grid, payout, replay identifier, exact winning cells, and evaluated payline paths.
3. The UI enters `spinning`; controls lock and the live region reports that the reels are in motion.
4. Reels run at a constant speed and decelerate only at the end. At the default speed the first reel settles at 750 ms with a 150 ms stagger, so the fifth settles at 1,350 ms unless a reel is held for a possible trigger.
5. At 1,470 ms, or after the last held reel lands, the application enters the authoritative next phase: result, route choice, or active bonus.
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
8. The balance is debited by the stake when the spin starts. The award, the last-win figure, the browser-local play record, and the feature meter are applied only at the reveal, so no readout states the outcome while the reels are still running. The committed result is unchanged; only its presentation waits.

   The feature meter matters as much as the balance here. The session commits the next bonus
   state before presentation begins, so reading it live would announce a multiplier step, a
   collected charge, a consumed shield, or a retrigger a second or more before the reels landed.
   The meter therefore reads a copy that only advances at the reveal.
9. After the trace lands, a large `+N VC` total above the reels, a full-symbol-name payline ledger, and a grounded cabinet/background response confirm the same committed payout. Big and major tiers add a centered celebration overlay. CORE positions receive a short activation ring during bonus entry.

Ordinary symbol textures carry no three-letter abbreviations. The functional `CORE` and `WILD` marks use condensed industrial nameplates, while the accessible HTML ledger supplies full symbol names and exact per-line virtual-credit values.

The confirmed total sits above the reels, where it is read first. Its slot is always mounted at a
fixed height, so a win changes what the slot says without changing its size. Between results it is
an unlit recess in the cabinet's own grey, not a black gap and not a styled empty bar; a return
lights the panel and lifts its figures into place rather than resizing the box. The scoreboard and control deck remain directly below the reels in
every base-game state, and feedback and line ledgers render after that fixed control region. The
deck is a three-column grid so the Spin control stays on the centre line of the cabinet whatever
flanks it; secondary controls group to its right rather than displacing it.
Together these keep the Spin button at the same document coordinate before and after a win, which
is verified by measuring the control's position across a winning spin.

## Spin speed

Two speeds are declared in `SPIN_SPEEDS`, and the whole presentation is derived from the one
in force. `standard` is the default:

| | Standard | Turbo |
| --- | ---: | ---: |
| First reel settles | 750 ms | 244 ms |
| Stagger per reel | 150 ms | 47 ms |
| Fifth reel settles | 1,350 ms | 432 ms |
| Settle tail | 120 ms | 88 ms |
| **Ordinary spin** | **1,470 ms** | **520 ms** |
| Trigger hold per reel | 1,000 ms | 700 ms |
| Award hold per reel | 600 ms | 420 ms |

Turbo is the presentation the game shipped with. It is kept as an explicit choice rather than
removed, because throughput is a legitimate preference, and it is a toggle beside the wager
stepper that reports its state through `aria-pressed`. The choice is remembered per browser.

Only the display changes. Both speeds settle on the same committed result from the same seed,
and a seeded replay is identical under either.

A reel's motion is derived from its duration rather than fixed: it holds a constant speed for
the first 62 percent of its spin and eases out over the remainder, with velocity continuous at
the hand-over. Travel distance is computed from that duration so every reel spins at the same
speed regardless of when it stops, and is rounded to whole grid cycles so a reel still lands
aligned. Easing across the whole spin instead, which is what the original short presentation
did, makes a longer spin look like it is braking from its first frame.

The reel-mechanism cue is shorter than a standard spin, so it repeats until the last reel lands.
At least one reel is turning for that whole span, and without the repeat the reels would visibly
keep spinning over silence. The cue plan is returned in time order.

## Scatter anticipation

When the reels that have already settled hold exactly one Signal Core fewer than the trigger
requires, every following reel keeps running for an extra hold before it settles: 1,000 ms at
the default speed, 700 ms in turbo. The hold
is cumulative, so a spin that lands both Cores on the opening reels holds reels three, four,
and five in turn.

Once the trigger is met the wait continues in a second, quieter form. A fourth and fifth Core
raise the award from 10 to 13 to 16 Alpha spins, or 6 to 8 to 10 Bravo spins, so the remaining
reels are held for a shorter hold, 600 ms by default, while that is still possible, and are released as soon as no
further Core could add anything. This form only ever applies to a spin that has already
triggered — roughly one in 117 — so ordinary spins keep their short presentation. It is drawn in
gold rather than amber and its extra pass of the reel mechanism is quieter, so the louder
treatment stays reserved for the trigger itself.

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
- A polite atomic live region announces spinning, winning, no-payout, route-choice, and active-feature states.
- Status copy addresses the player about the game, not the reader about the engine. How results are generated is explained in the paytable, the laboratory, and this documentation; the status line during a spin says the reels are in motion and nothing more. Announcing that a result is being withheld invites the player to wonder what is being withheld.
- Relay Alpha exposes containment charges as a semantic progress bar.
- When the remaining balance cannot cover the current wager, Spin is disabled and labeled, the live region names the shortfall, and the wager controls stay enabled so play resumes without a session reset.
- Relay Bravo exposes its current multiplier and protection state as text.
- Active routes expose a keyboard-operable Pause/Resume control and announce whether the next spin is automatic or paused.
- Asset or renderer initialization failures show a visible fallback while engine controls and mathematics remain available.
- No repeated flash exceeds the project safety rules, and color is never the only result or route cue.

## Verification

Browser coverage verifies normal presentation locking, unchanged result/provenance across the animation boundary, exact line-ledger and confirmed-total output, deterministic big/major tiers, both route environment states, complete Bravo summary/return-to-base flow, reduced-motion completion and stability, responsive layout, and equality of deterministic results between normal and reduced-motion runs.
