# Result-driven presentation

## Status and purpose

This document describes the implemented reel-motion and result-feedback layer. It is a presentation contract only: the mathematical engine produces the complete result before any animation starts, and presentation timing never selects stops, changes a payout, or consumes randomness.

## Data boundary

The application commits the authoritative `SpinResult`, transposes its reel-major grid for display, and derives a de-duplicated list of winning cells from `lineWins[].positions`. React passes the immutable grid, presentation phase, winning cells, chosen bonus route, and reduced-motion preference to PixiJS.

PixiJS may emphasize supplied cells and CORE symbols, but it does not evaluate paylines or infer a payout. React owns the visible and assistive result message, balance, last win, route status, and feature meters.

## Implemented sequence

1. The engine returns the complete result and next deterministic session state.
2. The application commits the final grid, payout, replay identifier, and exact winning cells.
3. The UI enters `spinning`; controls lock and the live region states that a committed result is being presented.
4. Reels decelerate with a 244 ms base duration and 47 ms stagger per column. The fifth reel settles by 432 ms.
5. At 520 ms the application enters the authoritative next phase: result, route choice, or active bonus.
6. A restrained 460 ms amber sweep and exact winning-cell outlines confirm the result. CORE positions receive a short activation ring during bonus entry.

Relay Alpha uses muted signal-green and brass containment rails. Relay Bravo uses oxide and amber recovery rails. Before a route is chosen, the route dialog and canvas use a restrained dual-tone state. These treatments communicate a selected route but do not alter feature behavior.

## Bonus autoplay

Choosing either route enables automatic free spins. React waits 650 ms after an active-feature presentation becomes ready, invokes one deterministic `spinBonus` transition, commits that result, and only then begins its 520 ms presentation. It schedules the following spin only after the preceding presentation completes. Pause/Resume controls future scheduling; pausing during or after a presentation never cancels, redraws, or mutates a committed result. Session reset and route entry return autoplay to its default enabled state.

## Accessibility and failure behavior

- Reduced motion skips the presentation delay and shows a stable final grid with static outlines.
- The cabinet exposes `aria-busy` only while presenting the committed result.
- A polite atomic live region announces locked, winning, no-payout, route-choice, and active-feature states.
- Relay Alpha exposes containment charges as a semantic progress bar.
- Relay Bravo exposes its current multiplier and protection state as text.
- Active routes expose a keyboard-operable Pause/Resume control and announce whether the next spin is automatic or paused.
- Asset or renderer initialization failures show a visible fallback while engine controls and mathematics remain available.
- No repeated flash exceeds the project safety rules, and color is never the only result or route cue.

## Verification

Browser coverage verifies normal presentation locking, unchanged result/provenance across the animation boundary, both forced bonus routes, reduced-motion completion and stability, responsive layout, and equality of deterministic results between normal and reduced-motion runs.
