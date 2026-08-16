# ADR 0003: MIT license for code and documentation

- Status: Accepted
- Date: 2026-08-15

## Context

Defuse Protocol is intended for a public GitHub repository and needs clear reuse terms before contributors or users encounter the source. Runtime media may have provenance and licensing constraints that differ from source code.

## Decision

License repository-authored source code and original documentation under the MIT License. Require every visual, audio, font, and other media asset to have an explicit rights basis in the asset manifest. An asset-specific license or notice takes precedence for that asset and must remain compatible with public redistribution.

## Consequences

- The root `LICENSE` file contains the MIT text.
- Contributors must have the right to submit their work under the applicable repository terms.
- An asset is not assumed to be MIT-licensed merely because it is stored in this repository.
- Third-party dependencies and media retain their own licenses and required notices.
- Release review must verify that README, notices, manifests, and packaged artifacts communicate applicable terms accurately.

## Alternatives considered

- **No license until release:** rejected because an unlicensed public work creates unnecessary ambiguity.
- **Apply MIT to every media asset automatically:** rejected because media rights and generator or provider terms may require separate treatment.
- **Copyleft code license:** not selected for the initial educational project; it can be reconsidered only through a superseding ADR and contributor-rights review.

