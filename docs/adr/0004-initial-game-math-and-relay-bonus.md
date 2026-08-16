# ADR 0004: Initial game math and Relay Selection bonus

- **Status:** Accepted
- **Date:** 2026-08-15

## Context

The first playable Defuse Protocol prototype needs a concrete, inspectable model. The earlier math documentation deliberately left the win system, layout, initial volatility, and bonus behavior open. The selected design should reinforce the original tactical-containment setting, remain understandable in Lab mode, and support deterministic QA.

## Decision

### Base game

- Use five reels and three visible rows.
- Evaluate exactly 20 declared fixed paylines from the leftmost reel.
- Pay only the longest eligible match for a symbol on a line; separate qualifying lines are additive.
- Use one virtual credit per line at the minimum total wager of 20. Larger wagers are integer multiples of that unit and scale every line award equally.
- Use explicit circular reel strips with uniform stop selection. Symbol frequency comes from strip entries, not hidden outcome weighting.
- Include nine regular original tactical-industrial symbols, one substituting wild, and one Signal Core scatter.
- Target 96% theoretical RTP, medium-high volatility, and a base-game bonus-entry frequency around one in 100–120 paid spins. These are configuration-design targets, never controls applied to individual outcomes.

### Bonus entry

- Three, four, or five Signal Cores award 10, 13, or 16 feature spins before the player chooses a route.
- Three or more Signal Cores during a feature retrigger four spins.
- A single triggered feature may award at most 30 total spins, including retriggers.
- Feature payouts are attributed to the paid base spin that triggered the feature for RTP reporting.

### Relay Alpha — Controlled Containment

- Alpha is the lower-volatility route.
- Signal Cores collected during feature spins charge a containment meter.
- Every three collected Cores secures one previously unsecured reel.
- On the final Extraction Spin, every secured reel expands to wild before line evaluation.
- Secured-reel selection and every other random feature decision consume the same deterministic, versioned random stream as the triggering session.

### Relay Bravo — Emergency Recovery

- Bravo is the higher-volatility route and begins with 6, 8, or 10 spins for a three-, four-, or five-Core trigger.
- Consecutive winning feature spins advance the global multiplier through 1×, 2×, 3×, and 5×.
- A non-winning feature spin resets the multiplier to 1× unless a Core-granted protection charge is available; a protected reset consumes one charge.
- Retriggers follow the shared four-spin award and 30-spin cap.
- Alpha and Bravo should be tuned toward comparable expected value while preserving their different payout distributions.

### Development cheat boundary

The local development build may expose a clearly labeled cheat menu that creates a forced bonus-entry test fixture for three, four, or five Signal Cores. Forced results must:

- be marked as developer-generated in state and visible UI;
- live behind a development-only module or build flag;
- never be used by ordinary spin generation or simulation;
- never be included in observed statistics as an ordinary random spin; and
- remain covered by automated tests.

## Consequences

- Payline evaluation is now accepted rather than proposed.
- The first configuration can be tuned and regression-tested against explicit targets.
- The player receives a meaningful volatility choice inside the bonus without implying that timing or skill changes an already generated outcome.
- Alpha requires state for collected Cores and unique secured reels; Bravo requires multiplier and protection state.
- The simulator must report route-specific results because one aggregate bonus average would hide the intended volatility difference.
- Numeric reel strips and paytable awards may be tuned without superseding this ADR when the rules remain unchanged and the change is documented and tested.

## Alternatives considered

- **243 ways:** deferred for a later educational comparison because fixed lines are easier to visualize and audit.
- **One bonus route:** rejected because it misses the opportunity to demonstrate equal-or-similar expected value with different volatility.
- **A fake timing or wire-cutting skill game:** rejected because it could imply player timing changes predetermined slot outcomes.
- **Cheat parameters in the production spin API:** rejected because test controls must remain visibly and structurally separate from ordinary math.

