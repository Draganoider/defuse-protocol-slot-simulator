# Contributing to Defuse Protocol

Defuse Protocol is a free educational slot-machine simulator with virtual credits only. Contributions should preserve the original, realistic-but-non-graphic tactical identity and the transparent, testable mathematics. The root `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md` are the public-facing community and security entry points; keep this durable guidance synchronized with them.

## Before opening an issue or pull request

- Search existing issues and documentation first.
- For a bug, include the commit/version, browser/runtime, reproducible steps, expected behavior, actual behavior, and a seeded example where relevant. Remove personal data and secrets from logs.
- For a feature, describe the user problem, scope, alternatives, and how the change preserves virtual-credit-only boundaries.
- For an art or audio change, include provenance, license/terms, creator/provider, and any required attribution. Do not upload confidential or unlicensed material.
- For a security concern, do not open a public issue with exploit details or credentials. Use the private reporting route documented in `SECURITY.md`.

## Scope and non-goals

The project may accept improvements to the TypeScript math engine, React interface, PixiJS presentation, deterministic simulation, accessibility, testing, original generated artwork, and documentation. Contributions must not add or suggest:

- deposits, withdrawals, purchases, cash-out, cryptocurrency, prizes, real-money wagering, or financial-return claims;
- mechanisms that alter a result after it has been generated to fake RTP or improve observed outcomes;
- copied Counter-Strike names, logos, maps, agents, weapon skins, UI, audio, or other third-party protected material;
- graphic gore, extremist imagery, real-world organization depictions, harassment, hate, or content targeting children with gambling-style messaging;
- hidden telemetry, credentials, private URLs, or user data collection without a documented product and privacy review.

## Engineering expectations

- Use TypeScript for application and engine code, with explicit types and focused modules.
- Keep the mathematical engine independent of React, PixiJS, browser globals, audio, and animation.
- Generate a spin result before presentation begins. Rendering and animation may display a result but may not determine or mutate it.
- Keep seeded behavior deterministic and add or update tests for payout evaluation, seeded reproducibility, configuration validation, and RTP calculations.
- Run high-volume simulations in the designated Web Worker path and label theoretical versus observed statistics.
- Update the relevant document in `docs/` in the same change as any implemented behavior or foundational decision. Add an ADR under `docs/adr/` for changes to technology, math model, randomness policy, asset policy, or repository license.
- Keep generated build output, dependency folders, credentials, local environment files, and proprietary source assets untracked.

## Art and asset review

All committed assets must be original, generated for this repository, or covered by a documented compatible license. Before merge, reviewers should be able to identify the source and terms of each asset. Generated artwork still requires review for accidental logos, recognizable third-party designs, personal data, and unsafe imagery. Prefer fictional equipment and invented faction marks over real-world branding.

## Pull request checklist

The author should confirm that:

- [ ] the change is limited to the stated scope and includes relevant tests;
- [ ] docs describe implemented behavior accurately and proposed behavior is labeled proposed;
- [ ] the math remains transparent and results are generated before animation;
- [ ] no real-money feature, financial claim, or misleading age/odds framing was introduced;
- [ ] new assets have provenance and required notices;
- [ ] no secrets, dependency folders, build output, private URLs, or proprietary source assets are included;
- [ ] accessibility, responsive behavior, and the virtual-credit disclaimer were considered where UI changes apply.

Maintainers may request changes or decline work that is technically sound but outside this scope. Review is collaborative; disagreements should be handled respectfully under the project's code of conduct.

## License and contributor terms

The current owner decision is to distribute the project's source code and documentation under the MIT License, as stated in the root `LICENSE` file. This is a project decision, not a legal guarantee. Media, fonts, audio, generated artwork, and other assets may have separate terms; contributors must verify rights and required notices for each asset rather than assuming MIT applies to everything in the repository. Contributions should be original or properly licensed, and contributors should have the right to submit them under the repository's contribution terms.

## Maintainer release responsibilities

Before publishing a release, maintainers should complete `docs/public-repository-checklist.md`, review dependency and asset licenses, scan current history for secrets, verify CI and browser tests, publish the applicable notices, and confirm GitHub issue/security/community settings. These checks reduce risk but are not legal guarantees.
