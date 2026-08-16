# Architecture

## Document status

This document describes the implemented architecture of the playable prototype and the boundaries that future work must preserve. The mathematical engine, React shell, PixiJS presentation, simulation worker, development-cheat boundary, and first production visual slice are implemented. Remaining symbol art, richer motion/VFX, audio, and broader accessibility verification remain future work.

The foundational decisions are recorded in:

- [ADR 0001: Web application stack](adr/0001-web-application-stack.md)
- [ADR 0002: Deterministic slot engine](adr/0002-deterministic-slot-engine.md)
- [ADR 0004: Initial game math and Relay Selection bonus](adr/0004-initial-game-math-and-relay-bonus.md)

## Goals

The architecture is intended to make the simulator:

- transparent and suitable for education;
- deterministic and reproducible when given the same versioned configuration and seed;
- responsive while rendering animation or running a high-volume simulation;
- testable without a browser, graphics renderer, audio device, or network connection; and
- safe to publish as an original, virtual-credit-only project.

Deposits, purchases, withdrawals, cash-out, cryptocurrency, and real-money integrations are outside the product scope.

## Technology stack

- **TypeScript** is used for application and engine code.
- **React** owns application structure, menus, controls, settings, accessible text, and statistics views.
- **Vite** provides the development server and production build pipeline.
- **PixiJS** renders the game scene through WebGL, including reels, symbols, transitions, and effects.
- A **Web Worker** runs high-volume mathematical simulations away from the user-interface thread.
- **Vitest** is the unit-test runner for the engine and application modules.
- **Playwright** covers browser-level flows and visual or interaction regressions where appropriate.

Dependency versions are pinned by the package manifest and lockfile rather than this document.

## System boundaries

The application is divided into four primary layers. Dependencies flow inward toward the engine; the engine never imports from the other layers.

```text
React application shell
  |-- invokes spins and presents controls/statistics
  |-- owns application state and accessibility
  |
  +--> Pure TypeScript engine
  |      |-- configuration validation
  |      |-- seeded random-number source
  |      |-- stop selection and grid construction
  |      |-- win and feature evaluation
  |      +-- theoretical calculations
  |
  +--> PixiJS presentation adapter
  |      |-- receives a complete spin result
  |      +-- animates without changing that result
  |
  +--> Simulation worker
         |-- imports the same pure engine
         +-- returns aggregate observed statistics
```

### Pure engine

The mathematical engine is a framework-independent TypeScript library. It must not import React, PixiJS, DOM APIs, browser storage, audio, animation, or other presentation concerns. It accepts explicit inputs and returns serializable values. Hidden global state and direct calls to `Math.random()` are prohibited.

The engine owns:

- versioned game-configuration types and validation;
- deterministic random-number generation through an injected interface;
- reel-stop selection and visible-grid construction;
- evaluation of the accepted 20 fixed paylines, WILD substitution, and CORE scatters;
- wild, scatter, bonus, retrigger, and payout rules;
- complete result records for audit and replay; and
- exact theoretical calculations where the state space is tractable.

The mathematical model and unresolved decisions are described in [Math model](math-model.md).

### React application shell

React owns user-interface concerns such as virtual-credit controls, route choice, help, reduced-motion preferences, and theoretical-versus-observed statistics labels. It manages immutable session transitions through the public engine API rather than embedding payout rules in components.

Browser persistence, if added, is limited to non-sensitive preferences, saved seeds, and local simulator configurations. Stored data must be schema-versioned and revalidated when loaded. There is no required server or account system in the initial architecture.

### PixiJS presentation

PixiJS owns the rendered tactical scene and uses WebGL for performant composition and effects. The renderer preloads approved textures for CORE, WILD, and RECOVERY and retains original procedural fallbacks for every other symbol and for asset-loading failures. The Pelagos Relay environment is a responsive CSS background so accessible React controls and the canvas remain independent of scene imagery. PixiJS receives immutable, complete spin results from the application layer. Timing, skipped animations, frame rate, visibility changes, and reduced-motion mode must never alter stops, wins, feature triggers, or payouts.

Presentation code may derive visual cues from a result, such as highlighting a winning path, but must not recalculate authoritative payouts. A non-animated or reduced-motion presentation must be able to show the same result immediately.

### Simulation worker

High-volume simulations run in a Web Worker so they do not block rendering or controls. The worker and its pure request handler import the same engine and configuration validator used by interactive play. Messages crossing the worker boundary are typed, structured-clone-compatible records, and parity tests compare worker-boundary reports with direct engine reports.

A simulation request should contain at least:

- the configuration or its verified identifier and hash;
- seed and random-number algorithm version;
- number of paid base spins;
- wager in virtual credits; and
- reporting or batch settings that do not affect outcomes.

A completed simulation response contains observed aggregate statistics, requested and completed counts, seed metadata, configuration identity, and route provenance. Validation failures cross the worker boundary as structured issues. Cancellation is not implemented in the prototype; any future partial-result support must label the actual completed sample count.

The prototype uses one worker. Parallel workers may be introduced later only with a documented stream-partitioning strategy that preserves reproducibility.

### Development-only cheat boundary

The development UI can import `createDeveloperCheatBonus` directly from the isolated `dev-tools` module. The factory creates a marked 3-, 4-, or 5-CORE bonus offer without consuming RNG. It is intentionally absent from the public engine index, ordinary spin generation, and simulation.

Sessions and resulting feature spins retain developer-generated metadata so the UI can disclose their origin. When the feature ends, the session returns to an ordinary base state. Simulated statistics never call the cheat factory.

Production builds pass a false development flag and expose no callable cheat factory through the normal engine boundary. The current presentation hardening caveat is tracked only in the [prototype QA report](qa-report.md).

## Spin lifecycle and data flow

1. The application validates the selected configuration, wager, and explicit or generated seed.
2. The engine consumes the configuration and current random state.
3. The engine selects reel stops, builds the visible grid, evaluates all wins and features, and calculates the complete payout.
4. The engine returns a serializable result plus the next random state or equivalent replay metadata.
5. The application records the authoritative result before presentation begins.
6. PixiJS animates toward the supplied stops and displays the supplied win breakdown.
7. React updates virtual-credit and statistics views from that same result.

If presentation fails or is interrupted after step 4, the result remains valid and can be displayed without replaying random selection.

## Core contracts

The implemented serializable contracts preserve these concepts:

```text
GameConfig
  schema version, layout, symbols, reel data, payout rules, feature rules

SpinRequest
  validated config, virtual-credit wager, deterministic random state

SpinResult
  stops, visible grid, wins, feature events, payout, replay metadata

SimulationRequest
  config identity, seed metadata, wager, paid-spin count

SimulationReport
  observed aggregates, completed count, provenance, warnings
```

Money-like values are virtual credits only and should use integer units. Floating-point arithmetic may be used for derived reports such as percentages, but not as an ambiguous source of payout rounding.

## Configuration and provenance

Every runnable configuration must have a schema version and stable identity. Reports and replay records should capture a canonical configuration hash so results cannot be confused with those from a later revision using the same display name.

Configuration is data, not executable code. It must be validated before a spin or simulation begins. Invalid, unsupported, or internally inconsistent configurations fail explicitly; the application must not repair them silently.

The project may ship more than one educational configuration. A desired RTP is an analysis target, not a runtime setting that forces individual outcomes. Changing reel strips, symbol frequencies, payouts, or feature rules creates a new configuration identity and requires recalculation.

## Error handling

- Validation failures are returned as structured errors with a stable code and human-readable context.
- Engine invariants fail before presentation and must not be converted into a zero-win result.
- Worker errors include enough non-sensitive provenance to reproduce the request.
- Asset-loading or animation failures fall back to a simpler presentation of the already generated result.
- Unknown configuration or RNG versions are rejected rather than interpreted approximately.

## Testing strategy

### Implemented automated coverage

The current Vitest suite contains 30 tests. Its engine and worker coverage includes:

- payout evaluation for ordinary, wild, scatter, overlapping, and boundary cases;
- seeded reproducibility using stable golden vectors;
- configuration acceptance and rejection cases;
- stop-to-grid construction, including reel wrapping;
- feature entry, retrigger, and termination rules;
- exact RTP calculations against small configurations that can be hand-enumerated; and
- equality of interactive and worker outcomes for the same configuration, seed, and spin count.

### Application and browser coverage

Five Playwright flows now verify that the development app remains visible without runtime errors, an ordinary committed spin returns to ready, the development cheat can force a bonus and locks wager controls, a 390 px viewport has no document overflow, and reduced-motion presentation completes without the normal delay. Manual live-browser review also covers the approved environment and CORE texture in a forced feature grid.

Further coverage should add keyboard traversal, paytable/Lab dialog behavior, visual-regression baselines for all approved symbols, route completion, production deployment, and broader supported-browser checks. Public builds must continue to contain no credentials, local paths, unlicensed assets, generated dependency/build directories, or development-cheat presentation strings.

Simulation convergence tests can detect major regressions, but probabilistic tolerance tests do not replace exact unit tests or theoretical analysis.

## Change policy

A new ADR is required before changing the application stack, engine purity boundary, randomness policy, math model, or other foundational choice. Implementation changes should update this document and [Math model](math-model.md) in the same pull request when their described behavior changes.
