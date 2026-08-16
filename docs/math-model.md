# Mathematical model

## Document status

The mathematical principles in this document are accepted and implemented. The five-reel, three-row, 20-payline model and Relay Selection bonus are accepted in [ADR 0004](adr/0004-initial-game-math-and-relay-bonus.md). The current production configuration lives in `src/engine/config.ts`; measured results and provenance are published in the [tuning report](tuning-report.md).

Defuse Protocol is a free educational simulator using virtual credits only. Its calculations do not represent a promise of financial return.

## Design principles

- Generate every outcome from declared rules, reel data, and a deterministic random-number stream.
- Calculate the complete result before animation begins.
- Derive return to player (RTP) from the outcome distribution and paytable.
- Never alter a selected result to approach a target RTP, recover losses, create a near miss, or control a session.
- Make configurations inspectable, versioned, validatable, and reproducible.
- State whether every published statistic is theoretical or observed.

## Model vocabulary

- **Paid base spin:** one request that consumes a positive integer wager in virtual credits.
- **Reel strip:** an ordered, circular sequence of symbol identifiers.
- **Stop:** the selected index on a reel strip.
- **Window:** the visible symbols derived from a stop and the configured number of rows, wrapping at the end of the strip.
- **Paytable:** declared award values and eligibility rules.
- **Feature:** an event such as free spins that is triggered by a base or feature result.
- **Payout:** virtual credits awarded by the evaluated result, including feature results attributed to the triggering paid base spin.
- **Return multiple:** payout divided by wager for a paid base spin.

## Baseline reel model

Each reel has an explicit circular strip of symbol identifiers. A stop is selected uniformly from the valid indexes of that reel unless a future ADR accepts a different transparent weighted model. Reel selections are independent except where a declared feature state explicitly changes the configuration used for a later feature spin.

The visible grid is a pure function of the reel strips, selected stops, row count, and documented strip orientation. Duplicating a symbol on a strip is how its frequency is represented; the engine must not replace explicit strips with undocumented per-symbol weights.

The configuration must declare:

- schema and game-math versions;
- reel count, row count, and each complete reel strip;
- symbol definitions and roles;
- paytable entries and their payout basis;
- line or ways evaluation rules;
- wild substitution and exclusion rules;
- scatter counting and award rules;
- bonus entry, feature reels, spin awards, retriggers, and limits;
- wager rules in integer virtual credits; and
- maximum-result or termination constraints.

The checked-in configuration is authoritative for exact reel-strip order and paytable awards. This document records their interpretation; the [tuning report](tuning-report.md) records analysis and sampled behavior without turning an RTP target into an outcome-generation input.

## Win evaluation model

### Fixed paylines — Accepted

The initial configuration uses exactly 20 fixed paylines because named paths and line-by-line awards are easier to inspect, teach, test, and visualize. An all-ways model remains a possible future educational configuration, but it is not part of the first prototype.

The accepted line model defines:

- matches start from the leftmost reel;
- the minimum consecutive match length;
- only the longest eligible match per symbol and line pays;
- how wilds substitute and how all-wild combinations are valued;
- separate line wins on one spin are additive;
- how scatter awards combine with path awards; and
- paytable values multiply the integer line bet; the minimum total wager is 20 virtual credits, one per line.

Each configured line is an ordered row index, one per reel. The evaluator reads the symbol at those coordinates, applies the declared match and substitution rules, and records each qualifying award separately.

WILD substitutes for every regular symbol but never for CORE. For each regular-symbol interpretation, the evaluator uses that symbol's longest eligible left-to-right prefix. When WILDs make more than one regular-symbol interpretation eligible on the same line, only the highest-paying interpretation is awarded; a payout tie favors the longer match. An all-WILD prefix therefore uses the highest-paying eligible regular-symbol interpretation rather than a separate WILD paytable.

CORE positions are counted anywhere in the visible grid for feature entry and do not create line awards.

For an all-ways model, a qualifying left-to-right symbol has a count `c_i` of matching or substituting positions on each consecutive reel. Its number of ways is:

```text
ways = c_1 * c_2 * ... * c_n
```

The award basis and handling of a position that could contribute to more than one symbol must be defined explicitly to prevent ambiguous double counting.

## Bonus model

Bonus entry is determined solely from the generated grid and declared trigger rules. A bonus may use different reel strips or modifiers, but those are part of the versioned configuration. Awarded spins, retriggers, multipliers, and any cap must be explicit.

A paid base spin is the unit used for RTP and feature-frequency reporting. All payouts from a triggered feature are attributed to the base spin that triggered it. Feature spins are not counted as additional paid spins.

The implemented Relay Selection rules are:

- 3, 4, or 5 CORE symbols offer both routes;
- Relay Alpha awards 10, 13, or 16 spins and secures one unique random reel for every three collected COREs;
- Relay Alpha expands every secured reel to WILD on its final Extraction Spin;
- Relay Bravo awards 6, 8, or 10 spins and advances its next-spin multiplier through 1, 2, 3, and 5 after consecutive wins;
- Relay Bravo grants one reset-protection shield per collected CORE, up to three; and
- either route awards four spins for a retrigger, subject to a 30-total-awarded-spin cap.


If a bonus can retrigger, the model must either:

- have a finite configured cap; or
- provide a mathematical argument that the process terminates with probability one and has finite expected payout.

No feature may choose a result based on recent wins, virtual-credit balance, observed RTP, or presentation state.

### Bonus probability

For reel `i`, let `p_i` be the exact probability that its visible window satisfies the reel-level scatter condition. With independent reel stops and an entry rule of at least `k` qualifying reels, bonus probability is the sum over every qualifying subset of reels:

```text
P(bonus) = sum over S where |S| >= k
           product(p_i for i in S) * product(1 - p_j for j not in S)
```

`p_i` must be calculated from stops whose complete visible window qualifies, not merely from the number of scatter symbols divided by strip length. This matters when the window contains multiple rows, repeated scatters, or adjacent scatter entries.

If bonus entry depends on total scatter count, ordered positions, collectable states, or correlated feature rules, exact stop enumeration or a state-aware dynamic program replaces the simplified formula. A simulation estimate must not be labeled theoretical.

Bonus frequency in paid spins is `1 / P(bonus)` only when the entry event has the same independent probability on every paid base spin. Otherwise the report should present the probability and the assumptions directly.

For the current base strips, the **theoretical bonus-entry probability** is exactly `0.00856`, equivalent to approximately one entry per `116.82` paid base spins. This value is route-independent because route selection occurs only after the base grid triggers.

## Return to player

Let `W` be the integer virtual-credit wager for one paid base spin and `P(o)` the total payout for outcome `o`, including all feature payouts caused by that outcome. If `Pr(o)` is the exact probability of `o`, theoretical RTP is:

```text
theoretical RTP = sum(Pr(o) * P(o)) / W
```

Equivalently, it is the expected return multiple `E[P / W]`. When separable, the report may show base-game and feature contributions, but their sum must reconcile with the total RTP and must not count feature awards twice.

RTP is an emergent property of reel strips, visible-window construction, evaluation rules, paytable awards, bonus probability, and bonus expected value. A target RTP is useful while designing a configuration, but it is never an input to outcome generation and is never enforced by modifying results after a spin.

For the current base strips and paytable, the exact **theoretical base-game RTP** is `0.2931687243`, or `29.3169%`. A complete theoretical RTP including the stateful features has not been claimed; current route totals are explicitly labeled observed simulation results.

### Exact analysis

For independent reel strips with lengths `L_1` through `L_n`, the base stop space contains:

```text
L_1 * L_2 * ... * L_n
```

equally likely stop combinations. Exact enumeration should be used when tractable. Feature expected value may require dynamic programming over remaining spins and retrigger state. An analysis is theoretical only when it covers the complete declared probability model without sampling.

If exhaustive analysis is impractical, a seeded simulation can estimate RTP. The output remains an observed statistic even when the sample is very large.

## Volatility and frequency metrics

Let the return multiple for paid base spin `i` be `R_i = P_i / W_i`, including any feature it triggers.

Theoretical metrics come from the complete probability distribution:

```text
mean return       mu = E[R]
variance              = E[(R - mu)^2]
standard deviation    = sqrt(variance)
hit frequency         = Pr(P > 0)
profitable-hit rate   = Pr(P > W)
bonus-entry rate      = Pr(a paid base spin triggers the bonus)
```

Observed versions replace expectations and probabilities with sample averages and counts. Reports must state whether a hit means any payout or a payout greater than the wager; the two must not share an unlabeled "win rate."

Additional observed distribution measures may include median return, selected quantiles, largest observed win, longest observed no-payout run, and feature-payout share. Those describe a particular sample and seed. The largest observed win is not the theoretical maximum win.

If the interface displays a single volatility label, its thresholds and source metric must be documented. No low/medium/high label is accepted yet. Standard deviation and hit frequency should remain available because one label cannot describe the whole distribution.

For simulated mean return, report sample size and standard error when finite sample variance is available:

```text
standard error = sample standard deviation / sqrt(completed paid spins)
```

A confidence interval may accompany the estimate if its method and assumptions are named. It does not turn the estimate into theoretical RTP, and a narrow interval does not validate an incorrect model.

## Deterministic randomness and replay

All random selection uses an injected, seedable pseudo-random-number generator (PRNG). The implementation must record:

- seed in a canonical, unambiguous format;
- PRNG algorithm identifier and version;
- game configuration identity and canonical hash;
- engine/math version; and
- starting stream position or equivalent replay metadata.

The PRNG algorithm and seed-expansion procedure must be stable and covered by golden-vector tests. `Math.random()`, timestamps, animation frames, asset-loading order, and component render order must not enter the engine. This PRNG is for reproducible education and testing; it is not represented as suitable for real-money gambling or cryptographic use.

The implemented algorithm is `mulberry32-v1`. Safe-integer numeric seeds normalize to an unsigned 32-bit value; text seeds use the versioned FNV-1a 32-bit expansion. Canonical seed text is eight lowercase hexadecimal digits prefixed by `0x`.

Replay metadata records the algorithm, canonical seed, state, stream position, engine/math versions, configuration identity and hash, and the pre-spin bonus state for feature spins. Golden-vector and complete-spin tests protect the supported sequence. `mulberry32-v1` is reproducible test infrastructure, not a cryptographic RNG.

For the same supported versions, configuration, wager sequence, seed, and starting state, interactive execution and worker simulation must produce identical results. Parallel stream splitting is deferred until a separate deterministic partitioning rule is documented.

## Validation rules

Configuration validation occurs before calculation or simulation and returns structured errors. At minimum it must verify:

- the schema version and every referenced identifier are supported;
- dimensions are positive integers and every reel strip is nonempty;
- every strip entry references a declared symbol;
- payout values and virtual-credit wagers are finite, non-negative or positive as appropriate, and use the declared integer unit;
- paylines have one in-range coordinate per reel, or ways rules are complete;
- substitution, scatter, and bonus roles do not conflict silently;
- bonus state transitions, retriggers, and termination constraints are complete;
- all configured probabilities or integer weights are valid and normalized by a documented method;
- payout multiplication cannot exceed supported integer limits; and
- theoretical analysis is rejected when the configuration uses a rule the analyzer does not model.

Validators must not silently clamp, infer, reorder, deduplicate, or rewrite math data. Canonicalization for hashing must preserve mathematical meaning and be versioned.

## Test requirements

The engine test suite must include:

- hand-calculated payline or ways fixtures after that decision is accepted;
- overlapping-win, wild, scatter, and bonus edge cases;
- reel-window wrapping at the first and last strip indexes;
- invalid references, values, dimensions, and non-terminating bonus definitions;
- golden PRNG output and complete-spin reproducibility vectors;
- identical main-thread and worker results for the same inputs;
- exact enumeration of small toy configurations with known RTP and feature probability;
- attribution of all feature payouts to their triggering paid base spin; and
- deterministic simulation aggregates for a fixed seed and sample count.

Large-sample convergence tests may compare observed RTP with a known theoretical value using a statistically justified tolerance. Such tests are diagnostic and must not replace exact evaluation fixtures.

## Statistics presentation

Every statistics view or exported report must identify provenance and use explicit labels such as:

- **Theoretical RTP** — computed from the complete mathematical model;
- **Observed RTP** — total simulated payout divided by total simulated wager;
- **Theoretical bonus-entry probability** — exact probability under the named configuration; and
- **Observed bonus entries** — count and rate in the completed sample.

Reports should include configuration identity and hash, engine/math version, seed and PRNG version for simulations, requested and completed paid-spin counts, wager basis, and warnings about unsupported exact calculations. The user interface must never show observed RTP simply as "RTP" when a theoretical figure is also available.

## Current tuning status

- `mulberry32-v1`, canonical hexadecimal seeds, and text-seed expansion are selected, versioned, and covered by golden tests.
- The current ordered strips and paytable have been tuned without adapting individual outcomes.
- Route-specific observed means, standard deviations, feature payouts, and maxima are published in the [tuning report](tuning-report.md).
- Determine a measured maximum payout from the final bounded configuration and compare it with the 1,500× design target.
- A future decision may add a documented volatility classification; raw standard deviation and hit metrics remain authoritative today.

Each accepted choice that changes the foundational math or randomness policy requires an ADR and matching tests.
