# Asset card: Signal Core

## Record

- **Asset ID:** `symbol-signal-core-base-01`
- **Status:** Approved for runtime use after production and in-game review on 2026-08-16.
- **Gameplay ID:** `CORE`
- **Display name:** Signal Core
- **Family and role:** Feature/scatter symbol; primary visual anchor for bonus activation.
- **Runtime path:** `src/assets/symbols/symbol-signal-core-base-01.webp`
- **Prompt record:** `docs/assets/prompts/symbol-signal-core-base-01.md`
- **Rights basis:** Project-owned original generated artwork under the MIT License; originality and public-redistribution review passed.

## Creative brief

Create an original fictional field communications relay from Pelagos Relay: a compact rectangular olive-drab instrument with rubber corner guards, a protected amber lamp, analog meter, practical rotary controls, folded antenna, and canvas carry strap. Its silhouette must read as grounded contemporary telecom equipment rather than a bomb, explosive, weapon, or recognizable product.

The inactive/base state uses faded olive, charcoal, dull aluminum, and one restrained amber lamp. Shape, meter geometry, and value contrast must identify the symbol without relying on color. Leave signal pulses and win highlights as separate code-rendered or overlay effects.

## Composition and delivery

- Centered three-quarter product shot, near-frontal enough to preserve the compact rectangular silhouette.
- Square-safe subject with at least 8% clear margin on every edge.
- Transparent background; no cast environment large enough to compromise alpha extraction.
- Sharp subject with neutral studio light and a warm late-afternoon edge.
- One primary silhouette, one focal material family, and no more than two accent colors.
- Runtime delivery: 512×512 WebP with alpha; no raw generation dump is retained in the public repository.

## Accessibility and animation handoff

- Recognizable at 128 px and tolerable at 96 px in color and grayscale.
- The analog meter, antenna, handle, and protected lamp must remain legible without glow.
- Feature activation must also use a static outline/geometry change for reduced-motion mode.
- Do not bake the `CORE` label, activation glow, sparks, flash, or animated distortion into the base texture.

## Acceptance gates

- [x] Originality and rights review completed; no recognizable brand, game, real organization, or real device copied.
- [x] Clearly reads as a fictional communications/containment module, not an explosive.
- [x] No text, logo, watermark, insignia, weapon component, gore, or real-money gambling cue.
- [x] Clean alpha, correct 512×512 dimensions, 8% safe margin, and no unwanted metadata.
- [x] Readable at 128 px, 96 px, in grayscale, and during reel motion.
- [x] Static and reduced-motion feature states remain understandable without color alone.
- [x] Runtime asset, prompt record, and approved manifest entry are reviewed together.
