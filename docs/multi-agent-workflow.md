# Multi-agent workflow

## Purpose

Defuse Protocol uses specialist agents for bounded parallel work while a primary integration agent maintains architectural and visual coherence. All agents share one workspace, so file ownership is explicit.

## Active roles and model allocation

| Role | Model tier | Typical responsibility |
| --- | --- | --- |
| Primary integrator | Frontier coding model | Integration, cross-cutting decisions, implementation sequencing, verification, and user handoff |
| Math and architecture specialist | GPT-5.6 Sol, high or xhigh reasoning | Probability model, deterministic engine, module boundaries, invariants, and math tests |
| Art direction specialist | GPT-5.6 Terra, high reasoning | Visual system, original tactical identity, asset pipeline, readability, and media review |
| Public-repository specialist | GPT-5.6 Luna, medium or high reasoning | Repository hygiene, checklists, metadata, documentation completeness, and repeatable audits |

The allocation follows current model positioning: use the frontier tier for the hardest reasoning, the balanced tier for judgment-heavy production work, and the efficient tier for structured high-volume work. A specialist role may move to a stronger tier when its task becomes unusually ambiguous or cross-cutting.

Image generation is a specialized tool step rather than a general coding-agent responsibility. The art-direction specialist defines and reviews the brief; the primary integrator controls accepted assets and provenance records.

## Ownership protocol

1. The primary agent establishes scope, acceptance criteria, and owned paths.
2. A specialist reads `AGENTS.md` and relevant `docs/` files before acting.
3. Each concurrent specialist receives non-overlapping file ownership.
4. Cross-cutting changes are reported to the primary agent instead of being made silently.
5. The primary agent reviews all outputs for contradictions, broken links, unsupported claims, and scope drift.
6. Implementation begins only after relevant proposed decisions are accepted.

## Handoff format

Every specialist reports:

- Files created or changed
- Decisions made and assumptions used
- Verification performed
- Open questions, risks, and suggested next tasks

## Planned implementation waves

Current progress: Waves 1 and 2 are complete. Wave 3 has the worker simulator and reports, while the advanced configuration editor and import/export remain. Wave 4 has the implemented Alpha/Bravo bonus with automatic free spins and Pause/Resume, the complete approved eleven-symbol family, three Pelagos Relay environment states, result-driven reel motion, payout-tier win VFX, route transitions, a completed-feature summary, original ambience and route music, a production mixer, crash diagnostics, and expanded browser accessibility/resource coverage. Visual-regression baselines, broader browser/device verification, and final accessibility/performance review remain.

### Wave 1 — foundation

- Repository scaffolding and documentation
- Pure TypeScript configuration schema and deterministic engine skeleton
- React/PixiJS application shell
- Initial test and continuous-integration setup

### Wave 2 — playable base game

- Reel generation and pay evaluation
- Five-reel presentation and responsive controls
- Virtual-credit session state
- Paytable and basic win presentation

### Wave 3 — laboratory

- Advanced configuration editor and validation
- Web Worker simulator
- RTP, hit-rate, feature-frequency, volatility, and distribution reports
- Configuration import/export

### Wave 4 — production art and bonus

- Approved original asset set with provenance
- Motion, VFX, lighting, audio, and accessibility passes
- Defusal bonus implementation
- Visual regression, performance, and public-release review
