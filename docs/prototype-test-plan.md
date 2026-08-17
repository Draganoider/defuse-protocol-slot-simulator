# Prototype test plan

## Purpose

This plan defines the acceptance checks for the playable Defuse Protocol prototype. It covers deterministic mathematics, browser behavior, Relay Selection and completion, payout-tier VFX, route environments/music, presentation audio, simulation reporting, and the cheat provenance boundary.

## Quality gates

The prototype is acceptable when all of the following pass:

- TypeScript type-check
- Unit and integration tests
- Production build
- Desktop and mobile browser smoke tests
- Keyboard and reduced-motion checks
- Deterministic replay checks
- Ordinary and forced bonus-path checks for both routes
- Simulation provenance and metric-label checks
- No console errors or unhandled promise rejections during tested flows
- Bounded diagnostic persistence and synchronous rapid-click protection

## Base-game scenarios

- A new session begins with a visible virtual-credit balance, total wager, seed, and virtual-credit-only notice.
- A paid spin deducts the displayed total wager exactly once.
- The complete outcome exists before presentation begins.
- A result contains five reels by three rows, stops, line wins, scatter count, payout, and replay metadata.
- Winning lines and payouts agree with the configured paytable and line bet.
- WILD substitutes only according to the declared rules; CORE scatter is evaluated independently from lines.
- Controls that could create a second outcome are disabled while an existing result is being presented.
- Resetting to the same seed and repeating the same wager and choices produces the same results.

## Bonus entry and choice

- Three, four, and five CORE triggers award the documented starting spins.
- A naturally triggered bonus and a forced development fixture both show the route-choice interface.
- The interface explains that Alpha is steadier and Bravo is more volatile without promising a better return.
- Bonus spins do not deduct a paid wager.
- Three or more CORE during a bonus add four spins without allowing more than 30 total awarded feature spins.

## Relay Alpha

- CORE symbols advance the containment charge deterministically.
- Every three collected CORE secures one previously unsecured reel.
- A reel cannot be secured more than once.
- The final Extraction Spin expands every secured reel to WILD before payout evaluation.
- Alpha state and final payout are present in replay metadata and visible status.

## Relay Bravo

- Consecutive winning spins advance the multiplier through 1×, 2×, 3×, and 5×.
- A miss resets the multiplier unless protection is available.
- A protected reset consumes exactly one protection charge.
- Applied multipliers are reflected in the authoritative payout breakdown.
- Bravo state and final payout are present in replay metadata and visible status.

## Cheat menu

- The menu is visibly labeled `DEV CHEATS`, mounts only at `?qa=1`, and states that forced results are marked and do not alter RTP rules.
- It offers forced three-, four-, and five-CORE bonus fixtures plus session reset.
- Forced state is visibly marked and carries developer-generated metadata.
- A forced trigger is not counted as an ordinary random paid spin or included silently in observed statistics.
- Forced results remain marked as developer-generated and are excluded from simulation in every build.
- Ordinary spin and simulation APIs do not accept force-result parameters.

## Lab and simulation

- Simulation work runs through a Web Worker in the browser.
- The interface offers at least 10,000 and 100,000 paid-spin samples.
- Reports show sample count, seed, configuration or math version, observed RTP, any-pay hit rate, profitable-hit rate, bonus-entry frequency, maximum observed win, and route.
- Observed values are never labeled theoretical.
- Repeating the same route, sample count, configuration, and seed produces identical aggregates.
- The initial configuration is checked against its documented tuning band without adapting individual outcomes.

## Responsive and accessible behavior

- Core controls work at desktop and approximately 390 px mobile width without horizontal overflow.
- Spin, route choice, cheat controls, tabs, and seed actions are keyboard reachable with visible focus.
- Game-critical controls and results have semantic HTML equivalents outside the PixiJS canvas.
- Reduced-motion preference removes or shortens nonessential reel and ambient movement.
- Important states are communicated by text or shape as well as color.
- The virtual-credit/no-monetary-value notice remains discoverable at both tested sizes.

## Diagnostics and long-play safety

- A synchronous burst of click events enters only one spin transition before React commits state.
- Thirty fast accepted reduced-motion spins retain one renderer canvas, one result per
  accepted input, no page/console errors, and no more than 240 diagnostic events.
- The full presenting-phase lock continues to reject ordinary queued spins.
- Diagnostic events survive reload, remain capped at 240, and contain no personal or financial data.
- The Diagnostics dialog exposes copyable JSON and clear-local-log controls.
- Audio one-shots disconnect after completion and refuse excess concurrency above the documented cap.
- Renderer initialization, context loss/restoration, and bounded heartbeats are observable without changing game results.

## Presentation audio

- Audio remains locked until an eligible user interaction and never blocks a spin when unavailable.
- Spin, reel-stop, result, payline, win-tier, CORE, and route cues are scheduled from application/result state rather than engine randomness.
- Bonus autoplay uses the same result-driven audio path as a manual feature spin.
- Alpha and Bravo start distinct local music loops only after route choice; final completion or reset stops the loop.
- Master, ambience, music, effects, and mute controls are keyboard accessible and persist in a validated versioned local preference.
- Version-one audio settings migrate safely, and big, major, retrigger, and feature-complete cues map only from immutable transitions.
- Every meaningful sound has an equivalent visible and semantic result state.
- Reduced-motion timing is shortened without changing the selected result, payout, or cue meaning.
- Every runtime sound has an approved manifest entry and a reproducible source record.

## Win tiers and route environments

- Payout tiers use committed return divided by wager: strong at 5×, big at 10×, and major at 25×.
- Deterministic first-spin fixtures verify big and major celebration classes, headlines, and exact totals.
- Alpha and Bravo route selection applies the matching approved environment without changing the grid or replay metadata.
- The selected environment remains through the final result and feature summary, then returns to base on confirmation.
- Reduced motion removes shake, repeated rings, route sweeps, and particle travel while retaining static tier and route labels.
- A complete Bravo feature reports accumulated virtual credits and spins played in a keyboard-operable dialog.

## Public-repository checks

- No secrets, local absolute paths, proprietary references, copied game assets, or unreviewed binary assets are tracked.
- Generated build output, dependency folders, test artifacts, and TypeScript caches remain ignored.
- Documentation reflects implemented behavior and clearly identifies prototype limitations.
