# Prototype QA report

**Date:** 2026-08-16  
**Scope:** Initial Defuse Protocol prototype

## Automated checks

| Check | Result |
| --- | --- |
| `npm test` | Pass — 4 files, 30 tests |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| Playwright development flows | Pass — 5 tests |
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

**Reproduction:** Enter either route, then inspect the wager plus/minus controls before
pressing `Continue feature`.

The wager controls are now visibly disabled during an active feature while the
`Continue feature` control remains enabled. The Playwright forced-Alpha flow verifies
this presentation state and the existing application callback remains a second guard.

## Grounded production asset QA

The approved visual slice was redesigned after the first version read as excessively
futuristic. It contains three 512×512 RGBA WebP symbol textures and one 2560×1440 RGB
WebP environment. File inspection confirmed real alpha ranges for CORE, WILD, and
RECOVERY. The replacements use grounded contemporary materials: an olive field relay,
a fictional specialist in ordinary protective workwear, a sand-colored transport case,
and a sun-worn coastal concrete depot. Each retains a distinct silhouette and readable
value structure without depending on its accent color.

Live browser review confirmed that the new Pelagos Relay background preserves foreground
contrast and that the redesigned CORE texture loads in the forced feature grid. The
cabinet, reel cells, typography, dialog, scoreboard, and primary control now use a
restrained olive, concrete, canvas, amber, and brass palette without cyan glow effects.
Production symbols use procedural fallbacks if loading fails. The five Playwright flows
cover app stability, ordinary spin, the retained development cheat, bonus wager locking,
390 px overflow, and reduced motion without application console errors.

## Production cheat boundary

The production build contains no `createDeveloperCheatBonus` reference, the normal
engine entry point does not export it, and the development-only presentation strings
are pruned from production output. Development builds intentionally retain the menu for
QA fixtures.
