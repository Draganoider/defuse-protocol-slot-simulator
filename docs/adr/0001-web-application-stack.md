# ADR 0001: Web application stack

- **Status:** Accepted
- **Date:** 2026-08-15

## Context

Defuse Protocol needs a responsive, browser-based interface that combines ordinary application controls with a richly animated game scene. Its mathematical engine must remain usable in unit tests and high-volume simulations without a renderer or browser UI. The repository is intended for public development and should use a familiar TypeScript toolchain with clear module boundaries.

## Decision

Build Defuse Protocol as a client-side TypeScript web application using:

- React for the application shell, controls, settings, accessible text, and statistics;
- Vite for development and production builds;
- PixiJS with WebGL for the game scene and visual effects;
- a Web Worker for high-volume simulations; and
- a framework-independent TypeScript mathematical engine imported by both interactive play and the worker.

Vitest will cover unit and integration behavior that does not require a full browser. Playwright will cover browser flows and selected visual or interaction regressions.

The initial architecture does not require a server, user account, database, payment system, or network connection. Any future need for one requires a separate decision and must remain consistent with the virtual-credit-only product scope.

Dependency major versions are selected and pinned in the package manifest and lockfile. They are not permanently fixed by this ADR.

## Consequences

### Positive

- TypeScript types can be shared across the engine, UI, renderer adapter, and worker protocol.
- React is well suited to forms, settings, accessible controls, and statistics views.
- PixiJS provides a focused WebGL rendering layer for sprites and effects without coupling game math to rendering.
- Vite supports a fast development loop and conventional static deployment.
- Worker execution keeps large simulations from blocking interaction or animation.
- The pure engine can be tested quickly in a non-browser environment.

### Costs and constraints

- React state and PixiJS scene state require an explicit adapter and lifecycle ownership.
- Worker messages must remain serializable and version-compatible.
- WebGL resource management, asset cleanup, context loss, and reduced-motion behavior need dedicated tests.
- The same engine logic must not be reimplemented independently in UI or worker code.
- The public repository must not include build output, dependencies, credentials, local settings, or source assets without a compatible documented license.

## Alternatives considered

### React and DOM/CSS for the entire game

Rejected as the primary rendering approach. It would simplify the stack but make dense sprite animation, particles, and scene effects harder to control consistently. React remains responsible for the application UI.

### Raw Canvas or WebGL without PixiJS

Rejected for the initial implementation. It would reduce framework dependencies but add substantial renderer, asset, batching, and input infrastructure unrelated to the educational math goals.

### A complete game framework

Deferred. A larger game framework could provide scene and physics systems, but those capabilities are not currently required and would increase the application surface area.

### Unity or another native-first engine

Rejected for the initial public web application. It would complicate integration with accessible web controls and the lightweight TypeScript simulation codebase.

### Server-generated outcomes

Rejected for the initial scope. Local deterministic generation makes the educational simulator easier to inspect, run, and test. A backend would not remove the need for the pure engine and would introduce operational and security obligations.
