# Architecture

## Document status

This document describes the implemented architecture of the playable prototype and the boundaries that future work must preserve. The mathematical engine, React shell, result-driven PixiJS/VFX presentation, Web Audio mixer with route music, simulation worker, development-cheat boundary, complete production symbol family, three environment states, and production motion/audio slices are implemented. Advanced configuration tools and broader accessibility/performance verification remain future work.

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
- The browser **Web Audio API** decodes local Ogg assets and mixes ambience and effects after a user gesture.

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
  +--> Web Audio presentation adapter
  |      |-- receives committed result summaries
  |      +-- schedules local ambience and effects without engine access
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

React owns user-interface concerns such as virtual-credit controls, route choice, bonus-autoplay scheduling, help, reduced-motion preferences, and theoretical-versus-observed statistics labels. It manages immutable session transitions through the public engine API rather than embedding payout rules in components. Bonus autoplay requests one ordinary `spinBonus` transition at a time only after the preceding committed result has finished presenting; Pause/Resume changes future scheduling and never mutates a generated result.

An independent 180 ms entry gate prevents synchronous click bursts from reaching the transition handler multiple times before React commits its presenting state. It supplements rather than replaces the normal phase lock and has no influence on generated outcomes.

Browser persistence is limited to non-sensitive preferences and may later cover saved seeds or local simulator configurations. Stored data must be schema-versioned and revalidated when loaded. There is no required server or account system in the initial architecture.

The implemented audio preference is a versioned local record containing mute and master/ambience/music/effects levels. Version-one records migrate with the approved default music level; invalid or blocked storage falls back to defaults and cannot interrupt a game transition.

### PixiJS presentation

PixiJS owns the rendered reel scene and uses WebGL for performant composition and effects. The renderer preloads approved textures for all eleven reel symbols and retains original procedural fallbacks for asset-loading failures. Base, Alpha, and Bravo Pelagos plates are responsive crossfading CSS backgrounds so accessible React controls and the canvas remain independent of scene imagery. PixiJS receives an immutable complete grid plus application-derived winning cells, ordered winning paths, route metadata, and a payout tier. It implements staggered reel settling, exact layered payline traces, non-winner dimming, CORE activation, route atmosphere, and tier-scaled sweeps/rings/particles. React presents the same result as a large confirmed virtual-credit total, big/major overlay, semantic full-name line ledger, and completed-feature summary. Timing, skipped animations, frame rate, visibility changes, and reduced-motion mode never alter stops, wins, feature triggers, or payouts.

Presentation code may derive visual cues from a result, such as highlighting a winning path, but must not recalculate authoritative payouts. A non-animated or reduced-motion presentation must be able to show the same result immediately.

### Web Audio presentation

The audio layer owns local asset decoding, independent mixer buses, ambience and selected-route looping, persistent volume preferences, and result-cue scheduling. A pure cue planner converts the already committed `SpinResult` into presentation instructions. Win tiers are selected from the declared payout and wager, while feature cues use the declared bonus offer/event. Route music begins only after route selection and fades on final feature completion. This layer has no random-number source and cannot mutate a result or session.

The `AudioDirector` lazily creates a Web Audio graph after an eligible user gesture, because browsers may block audio before interaction. Master, ambience, music, and effects gains are independent. Loading, decoding, storage, or device failures degrade to silent play rather than an application error. Reduced-motion preferences shorten cue delays; they do not change the selected cues or game state. Source and accessibility details are in [Audio design and runtime](audio-design.md).

One-shot sources and gains explicitly disconnect on completion and are capped at 32 concurrent cues. PixiJS presentation follows the browser's display-synchronized animation frame rate, stops expensive redraws when the scene is idle, and reports WebGL context loss/restoration. These are presentation-resource policies, not mathematical rules.

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
- A React error boundary provides an on-page recovery view for render failures; global errors and unhandled rejections enter a bounded local diagnostic ring.
- The latest 240 technical events persist locally across a reload with no automatic telemetry. A native Chromium renderer crash can preserve only the events recorded before termination. See [Runtime diagnostics](diagnostics.md).

## Testing strategy

### Implemented automated coverage

The current Vitest suite contains 45 tests across eight files, including the existing engine/worker contract, expanded audio planning/preferences, diagnostic records, and payout-tier presentation classification. Its engine and worker coverage includes:

- payout evaluation for ordinary, wild, scatter, overlapping, and boundary cases;
- seeded reproducibility using stable golden vectors;
- configuration acceptance and rejection cases;
- stop-to-grid construction, including reel wrapping;
- feature entry, retrigger, and termination rules;
- exact RTP calculations against small configurations that can be hand-enumerated; and
- equality of interactive and worker outcomes for the same configuration, seed, and spin count.

### Application and browser coverage

Seventeen Playwright flows now verify that the development app remains visible without runtime errors, an ordinary committed spin locks controls and preserves its result/provenance through presentation, Space requests exactly one eligible base spin, the Spin control retains a stable document position through wins, a winning result exposes its exact line ledger and prominent committed total, animated paylines advance once and clear after their sequence, and the Audio console previews cues and persists validated preferences including the feature-music level. They also cover deterministic big and major win celebrations, both Alpha and Bravo route environments, a complete feature-to-summary-to-base lifecycle, automatic feature spins with usable Pause/Resume and wager locks, a 390 px viewport without document overflow, diagnostics and burst-input resource bounds, reduced-motion stability, and identical deterministic result/provenance across motion preferences. Manual live-browser review covers all three approved environments, the complete symbol family, payline treatment, the CORE texture, both route states, and the completed-feature summary.

Further coverage should add complete keyboard traversal, paytable/Lab dialog behavior, visual-regression baselines for all approved symbols, production deployment, and broader supported-browser checks. Public builds must continue to contain no credentials, local paths, unlicensed assets, generated dependency/build directories, or development-cheat presentation strings.

Simulation convergence tests can detect major regressions, but probabilistic tolerance tests do not replace exact unit tests or theoretical analysis.

## Change policy

A new ADR is required before changing the application stack, engine purity boundary, randomness policy, math model, or other foundational choice. Implementation changes should update this document and [Math model](math-model.md) in the same pull request when their described behavior changes.
