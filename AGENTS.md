# Defuse Protocol contributor guidance

This repository contains a free, educational slot-machine simulator that uses virtual credits only. It must not include deposits, withdrawals, purchases, cash-out mechanisms, cryptocurrency, real-money integrations, or claims of financial return.

## Product rules

- Keep all game logic transparent, testable, and deterministic when a seed is supplied.
- Treat RTP as an emergent property of reel strips, feature probabilities, and the paytable. Never fake a configured RTP by changing results after a spin.
- Generate a spin result before presentation begins. Animation may display a result but may not determine or mutate it.
- Label simulated statistics clearly and distinguish theoretical values from observed values.
- Preserve the original `Defuse Protocol` identity. Do not copy Counter-Strike names, logos, maps, characters, weapon skins, interface elements, audio, or other copyrighted or trademarked material.
- Only commit assets that are original, generated for this repository, or covered by a documented compatible license.
- Keep the realistic tactical theme non-graphic: no gore, extremist imagery, or depictions of real-world organizations.

## Engineering rules

- Use TypeScript for application and engine code.
- Keep the mathematical engine independent of React, PixiJS, browser globals, audio, and animation.
- Use React for application UI and PixiJS for the rendered game scene.
- Run high-volume simulations in a Web Worker.
- Add unit tests for payout evaluation, seeded reproducibility, configuration validation, and RTP calculations.
- Prefer small focused modules and explicit types. Avoid hidden global state.
- Do not commit generated build output, dependency folders, credentials, local environment files, or proprietary source assets.

## Documentation rules

- Store durable decisions in `docs/`.
- Add an Architecture Decision Record in `docs/adr/` when changing a foundational technology, math model, randomness policy, asset policy, or repository license.
- Keep documentation suitable for readers of a public GitHub repository. Do not include local machine details, private URLs, secrets, or unpublished third-party material.
- Update the relevant document in the same change as the implementation it describes.

## Multi-agent coordination

- The primary agent owns integration and cross-cutting files.
- Agents should edit only the files assigned to them and report any needed cross-cutting changes instead of making them silently.
- Before editing, inspect the current file because other agents share the same workspace.
- Do not revert, overwrite, or reformat unrelated changes.

