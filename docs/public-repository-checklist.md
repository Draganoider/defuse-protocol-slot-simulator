# Public repository readiness checklist

This checklist is for releasing Defuse Protocol as a public GitHub repository. It is a release aid, not legal advice or a guarantee that a release meets every jurisdiction's requirements. The project owner should make the final decisions and obtain appropriate professional advice where needed.

## Release gate

Before announcing a public release, the maintainer should be able to check every applicable item below. Any item involving an owner decision needs that decision recorded in the repository before release.

### Repository basics and README

- [ ] The README explains what Defuse Protocol is: a free, educational slot-machine simulator using virtual credits only.
- [ ] The README states the current status (prototype, alpha, or release), supported browsers/runtime, and a short local-development quick start.
- [ ] The README links to the durable documentation in `docs/`, including product, architecture, math, art/asset, and contribution notes as those documents are added.
- [ ] The README describes controls and clearly distinguishes theoretical RTP from observed simulation statistics.
- [ ] The README includes the simulated-gambling disclaimer and responsible-play framing below, near the project description rather than hiding it only in a footer.
- [ ] The README says there are no deposits, withdrawals, purchases, cash-out mechanisms, cryptocurrency, real-money integrations, or claims of financial return.
- [ ] The README includes screenshots or original, provenance-documented artwork only; no unreviewed third-party screenshots, logos, or game assets are used.
- [ ] The README identifies the current MIT license decision and links to `LICENSE`; it also explains that media and other assets may have separate terms.
- [ ] The README gives a support path (issues/discussions) and a concise statement of the project's non-goals.

### License and intellectual-property decision

- [ ] Verify the current owner decision: source code and documentation are distributed under MIT as stated in `LICENSE`.
- [ ] Verify that every committed source file may be distributed under MIT, while reviewing media, fonts, audio, generated artwork, and other assets under their separate applicable terms. Record any future license change in an ADR under `docs/adr/`.
- [ ] Confirm that `CONTRIBUTING.md` describes contribution terms compatible with MIT; do not imply a separate contributor license agreement that has not been implemented.
- [ ] Do not describe the project as affiliated with, endorsed by, or a port of Counter-Strike or any other third-party game.
- [ ] Preserve the original Defuse Protocol identity. Remove third-party names, logos, maps, characters, weapon skins, interface elements, audio, and other protected material from code, documentation, demos, and screenshots.
- [ ] Avoid real-world organization insignia, extremist imagery, graphic violence, and identifiable military branding. Keep the tactical theme non-graphic and fictional.
- [ ] Add trademark/originality language to the README or NOTICE: the project is an original work inspired by a broad tactical genre, and third-party marks remain the property of their owners.

### Asset provenance and third-party notices

- [ ] For every image, sound, font, icon, shader, and sample included in the repository, record its source, creator/provider, date obtained, license/terms, and any required attribution in `docs/asset-pipeline.md` or the maintained `THIRD_PARTY_NOTICES.md` file.
- [ ] Mark generated artwork as generated for this repository and record the generation/editing workflow sufficiently to reproduce the review decision; do not claim that generated content is automatically free of third-party rights.
- [ ] Keep proprietary source assets, private prompts or references, credentials, and unreleased vendor material out of the public repository.
- [ ] Verify font and audio licenses separately; their terms are often different from code licenses.
- [ ] Include third-party notices and attribution required by each dependency or asset license. Keep notices with the release if a license requires redistribution.
- [ ] Review generated and user-contributed assets for logos, recognizable copyrighted/trademarked designs, personal data, and unsafe imagery before merge.

### Product safety and user framing

- [ ] Show a prominent in-product and README disclaimer: this is a simulated game for educational/entertainment purposes, uses virtual credits only, and has no monetary value or payout.
- [ ] Do not add purchase, deposit, withdrawal, cash-out, crypto, real-money wagering, prizes, or financial-return language without a new product and compliance review; these are outside the current project scope.
- [ ] Use responsible-play language: play for fun, set a time limit, take breaks, and stop if the activity is no longer enjoyable. Do not claim that simulated outcomes predict winning or future returns.
- [ ] Add an age-appropriate framing (recommended: intended for adults, or the age guidance required by the distribution channel) and avoid marketing to children. The owner should confirm the final age statement for the intended audience and jurisdictions.
- [ ] Label all balances, wins, and statistics as virtual/simulated. Do not use “cash,” “jackpot,” “investment,” “profit,” or similar language that could imply value.
- [ ] Keep rules, paytable, feature probabilities, and simulation methodology transparent and deterministic when a seed is supplied.

### Security, privacy, and repository hygiene

- [ ] Search the full history and current tree for credentials, API keys, tokens, private URLs, personal data, local paths, screenshots of secrets, and embedded proprietary source assets before publishing. Rotate anything exposed, even if later deleted.
- [ ] Add an appropriate `.gitignore` before the first public push for dependency folders, build output, coverage, IDE files, local environment files, logs, caches, and generated test artifacts.
- [ ] Keep `.env*` files out of the repository; commit a safe `.env.example` only if configuration is actually needed.
- [ ] Do not commit `node_modules`, `dist`, `build`, coverage reports, editor metadata, or large temporary exports. Configure Git LFS only after deciding that its public hosting and license implications are acceptable.
- [ ] Pin or lock dependencies through the chosen package manager and review direct/transitive licenses and known vulnerabilities.
- [ ] Enable dependency and secret scanning where available, and verify that `SECURITY.md` defines a private reporting path and supported-version guidance.
- [ ] Verify that browser storage contains no sensitive data and that telemetry, if ever added, is documented and opt-in where appropriate. The current intended app should work without collecting personal data.

### Tests, CI, and release checks

- [ ] CI installs from the lockfile, type-checks, runs unit tests, validates configuration, and builds the app on a clean checkout.
- [ ] Unit tests cover payout evaluation, seeded reproducibility, configuration validation, RTP calculations, and boundary cases.
- [ ] A simulation job reports theoretical versus observed statistics and fails on materially unexpected drift according to documented tolerances; it must not mutate results to hit a target RTP.
- [ ] Browser tests cover a complete spin, disabled controls while a result is being presented, settings/statistics labels, responsive layout, and the virtual-credit disclaimer.
- [ ] CI checks that generated output and forbidden files are not tracked, and optionally runs license/dependency and secret scanners.
- [ ] Release builds are reproducible enough to identify the source commit and dependency lockfile used. Do not publish build artifacts containing secrets or local paths.
- [ ] Tag releases only after the checklist, documentation, asset notices, and change summary are reviewed.

### GitHub metadata and community files

- [ ] Add repository description, topics, homepage/demo link if applicable, and a clearly marked project status.
- [ ] Verify issue templates for bug reports, feature requests, and asset/provenance concerns. Include reproduction details and a reminder not to attach confidential material.
- [ ] Add a pull request template asking for tests, documentation updates, license/provenance information, and confirmation that no real-money functionality or third-party protected material was added.
- [ ] Verify that `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` state review expectations, scope boundaries, and the non-graphic fictional setting.
- [ ] Verify that `SECURITY.md` provides supported versions, responsible disclosure guidance, and a private contact route that does not expose secrets in public issues.
- [ ] Configure branch protection and required CI checks after the first public push; restrict who can publish releases and modify workflows.
- [ ] Review repository visibility, Actions permissions, package publishing settings, Pages/deployment settings, and collaborator access before announcing the URL.

## Final owner sign-off

Record the release date, commit/tag, selected license, asset-notice review, dependency/license review, security scan result, and the person who approved publication. Re-run this checklist for materially different distributions or when adding networking, accounts, monetization, user-generated content, analytics, or new third-party assets.
