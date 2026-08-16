# Prototype QA report

**Date:** 2026-08-16  
**Scope:** Initial Defuse Protocol prototype

## Automated checks

| Check | Result |
| --- | --- |
| `npm test` | Pass — 4 files, 30 tests |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| Development server response | Pass — local server returned HTTP 200 |

The existing automated coverage verifies deterministic base spins, grid construction,
payline/wild/scatter evaluation, ordinary and forced bonus entry, Alpha extraction,
Bravo multiplier/protection behavior, retrigger caps, simulation reproducibility, and
main-thread/worker report parity. It also verifies that the developer-cheat factory is
not exported by the public engine entry point.

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
reduced-motion, forced-route, and Lab interaction coverage remains recommended.

## Findings

### P2 — production bundle retains development cheat labels

**Reproduction:** Run `npm run build`, then search `dist/assets/index-*.js` for
`DEV CHEATS` or `Force 3 CORE`.

The production bundle contains the presentation component and its cheat-menu strings,
although the menu is not rendered because the application passes a production-false
`devCheatsEnabled` flag. The development cheat factory itself is not present in the
production bundle, so there is no enabled production cheat path. This is a hardening
issue against the requirement to avoid statically exposing cheat functionality where
possible; conditionally loading or compiling the cheat presentation only in development
would remove these strings.

### P3 — wager controls remain enabled during an active feature

**Reproduction:** Enter either route, then inspect the wager plus/minus controls before
pressing `Continue feature`.

The UI disables these controls only during `spinning` and `bonus-choice`. The app
callback rejects wager changes outside base mode, so the math is protected, but the
controls appear usable during a bonus and silently do nothing. Disable them in the
presentation whenever a feature is active to match the conflict-control acceptance
criterion.

## Production cheat boundary

The production build contains no `createDeveloperCheatBonus` reference and the normal
engine entry point does not export it. The remaining P2 is presentation text, not a
callable or enabled production cheat path.
