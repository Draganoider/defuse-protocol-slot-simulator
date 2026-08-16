# Prototype QA report

**Date:** 2026-08-16  
**Scope:** Initial Defuse Protocol prototype

## Automated checks

| Check | Result |
| --- | --- |
| `npm test` | Pass — 4 files, 30 tests |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| Playwright development flows | Pass — 8 tests |
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

**Reproduction:** Enter either route, then inspect the wager plus/minus controls while
automatic free spins are active or paused.

The wager controls are now visibly disabled during an active feature while the
Pause/Resume autoplay control remains enabled between presentations. Playwright verifies
this presentation state for both routes and the application callback remains a second guard.

## Grounded production asset QA

The approved visual slice was redesigned after the first version read as excessively
futuristic. It now contains eleven 512×512 RGBA WebP symbol textures and one 2560×1440
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
Production symbols use procedural fallbacks if loading fails. The eight Playwright flows
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
reels, and a crisp responsive trace remains visible in the settled state. Review at a
390 × 844 viewport confirmed aligned geometry and readable result hierarchy. A fresh
browser session reported no warning or error logs.

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

## Production cheat boundary

The production build contains no `createDeveloperCheatBonus` reference, the normal
engine entry point does not export it, and the development-only presentation strings
are pruned from production output. Development builds intentionally retain the menu for
QA fixtures.
