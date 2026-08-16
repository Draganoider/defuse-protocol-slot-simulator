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
4. Reels decelerate with a 244 ms base duration and 47 ms stagger per column. The fifth reel settles by 432 ms.
5. At 520 ms the application enters the authoritative next phase: result, route choice, or active bonus.
6. A layered amber trace follows the exact winning route while non-winning cells temporarily dim. Each line draws, holds briefly, fades, and then advances once to the next line. Up to four lines are presented in payout order; the ledger retains the complete result.
7. The committed payout divided by wager selects a presentation-only tier: standard below 5×, strong from 5×, big from 10×, and major from 25×. The tier scales cabinet response, Pixi sweeps/rings/particles, the counted headline, and the result cue; it never changes math.
8. After the trace lands, a large `+N VC` total, full-symbol-name payline ledger, and grounded cabinet/background response confirm the same committed payout. Big and major tiers add a centered celebration overlay. CORE positions receive a short activation ring during bonus entry.

Ordinary symbol textures carry no three-letter abbreviations. The functional `CORE` and `WILD` marks use condensed industrial nameplates, while the accessible HTML ledger supplies full symbol names and exact per-line virtual-credit values.

The scoreboard and control deck remain directly below the reels in every base-game state. Dynamic win totals, feedback, and line ledgers render after that fixed control region, so a result cannot move the Spin button away from the pointer between clicks.

Relay Alpha crossfades the base depot into a project-owned early-dusk plate with cold practical work lights, muted signal-green atmosphere, and brass containment rails. Relay Bravo uses a storm-dark damp depot plate, practical oxide/amber warning fixtures, and recovery rails. Before a route is chosen, the route dialog and canvas use a restrained dual-tone state. A route plate remains through the final result and completed-feature summary, then returns to base. These treatments communicate a selected route but do not alter feature behavior.

## Bonus autoplay

Choosing either route enables automatic free spins and its original music loop. React waits 650 ms after an active-feature no-win presentation becomes ready, invokes one deterministic `spinBonus` transition, commits that result, and only then begins its 520 ms presentation. A winning feature result is held for at least 1,800 ms, the selected tier duration, and, for multi-line wins, until 200 ms after the final displayed 900 ms line slot. It schedules the following spin only after the preceding presentation completes. Pause/Resume controls future scheduling; pausing during or after a presentation never cancels, redraws, or mutates a committed result. The final feature spin fades route music, plays a completion cue, and opens a semantic summary with route, spins played, and accumulated virtual-credit return. Session reset and route entry return autoplay to its default enabled state.

## Accessibility and failure behavior

- Reduced motion skips the presentation delay and shows a stable final grid with a static payline, ledger, and confirmed total.
- The cabinet exposes `aria-busy` only while presenting the committed result.
- Space invokes the same base-game Spin intent as the button. Repeats, modified key presses, active dialogs, focused interactive controls, feature autoplay, and locked presentation states do not trigger it.
- A polite atomic live region announces locked, winning, no-payout, route-choice, and active-feature states.
- Relay Alpha exposes containment charges as a semantic progress bar.
- Relay Bravo exposes its current multiplier and protection state as text.
- Active routes expose a keyboard-operable Pause/Resume control and announce whether the next spin is automatic or paused.
- Asset or renderer initialization failures show a visible fallback while engine controls and mathematics remain available.
- No repeated flash exceeds the project safety rules, and color is never the only result or route cue.

## Verification

Browser coverage verifies normal presentation locking, unchanged result/provenance across the animation boundary, exact line-ledger and confirmed-total output, deterministic big/major tiers, both route environment states, complete Bravo summary/return-to-base flow, reduced-motion completion and stability, responsive layout, and equality of deterministic results between normal and reduced-motion runs.
