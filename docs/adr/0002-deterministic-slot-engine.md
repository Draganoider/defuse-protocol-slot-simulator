# ADR 0002: Deterministic slot engine

- **Status:** Accepted
- **Date:** 2026-08-15

## Context

An educational slot simulator must make it possible to explain, reproduce, and test outcomes. Presentation timing and UI behavior are unsuitable sources of mathematical state. High-volume simulations must use the same rules as interactive spins, and observed statistics must be traceable to a configuration and random-number stream.

RTP is a property of the full probability model. Adjusting individual results after selection to approach a target would make the model misleading and prevent reliable replay.

## Decision

Implement the slot engine as a pure TypeScript module with explicit inputs and serializable outputs. It must have no dependency on React, PixiJS, the DOM, audio, animation, storage, clocks, network APIs, or browser-global random state.

All random choices use an injected, deterministic, seeded PRNG. The concrete algorithm, seed expansion, canonical seed format, and algorithm version must be locked before outcome generation is implemented, then protected with golden-vector tests. Replay and simulation provenance records include the configuration identity and hash, engine/math version, PRNG identifier and version, seed, and starting state or equivalent stream position.

A spin follows this ordering:

1. Validate configuration and request.
2. Select stops and any feature randomness from the supplied PRNG state.
3. Construct the grid and calculate every award and feature result.
4. Return the complete immutable result and next random state or replay metadata.
5. Only then allow React and PixiJS to present the result.

Presentation may be skipped, accelerated, interrupted, or replayed without changing the authoritative outcome. High-volume simulation runs the same engine in a Web Worker and aggregates results without rendering them.

Theoretical RTP is derived from reel strips, stop probabilities, evaluation rules, the paytable, bonus probability, and feature expected value. A desired RTP may guide configuration design, but it must never be passed to a spin as a control input or enforced by replacing, rerolling, or modifying a generated result.

The fixed-payline versus all-ways choice remains **Proposed** and is not accepted by this ADR. Whichever model is selected must be configured explicitly and added through a follow-up math decision.

## Consequences

### Positive

- A reported outcome can be replayed from versioned inputs.
- Unit tests and simulations run without graphics or browser setup.
- Interactive play and simulations share one authoritative rule implementation.
- Animation frame rate and user-interface behavior cannot influence payouts.
- Exact analysis and observed simulation can be compared against the same configuration.
- Mathematical changes are visible in versioned data and code rather than hidden session logic.

### Costs and constraints

- Result and configuration schemas need explicit versioning and migration or rejection rules.
- Changing the PRNG algorithm or its consumption order changes reproducible sequences and requires a version change.
- Adding a random call, even for a new feature, can shift all later results for a seed; tests and release notes must treat this as a mathematical change.
- Engine inputs cannot contain callbacks, class instances, renderer objects, or other non-serializable state if they cross the worker boundary.
- Feature models with retriggers require a termination guarantee and may need dynamic programming for exact RTP.
- Parallel simulation requires a documented deterministic stream-partitioning strategy and is deferred.

## Alternatives considered

### `Math.random()` in the engine

Rejected. It does not provide portable seed control or sufficient replay metadata and would make regression tests unreliable.

### Separate implementations for interactive play and simulation

Rejected. They could diverge silently and make observed simulation results unrepresentative of the displayed game.

### Generating or changing results during animation

Rejected. Rendering performance, skipped animations, and UI events must not affect mathematical outcomes.

### Adaptive or post-hoc RTP correction

Rejected. Selecting, rerolling, or changing an outcome based on session history or observed return misrepresents the configured probability model. RTP is evaluated from configuration and aggregate outcomes, not forced per session.

### Cryptographically secure randomness as the initial requirement

Deferred. The simulator uses virtual credits and prioritizes deterministic education and testing. The chosen seeded PRNG must be stable and statistically appropriate for simulation, but it will not be represented as cryptographically secure or suitable for real-money gambling.
