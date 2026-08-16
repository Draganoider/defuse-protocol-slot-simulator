# Asset card: Containment Specialist

## Record

- **Asset ID:** `symbol-containment-specialist-wild-01`
- **Status:** Approved for runtime use after production and in-game review on 2026-08-16.
- **Gameplay ID:** `WILD`
- **Display name:** Containment Specialist
- **Family and role:** Wild symbol; unique human presence and highest-priority regular substitution cue.
- **Runtime path:** `src/assets/symbols/symbol-containment-specialist-wild-01.webp`
- **Prompt record:** `docs/assets/prompts/symbol-containment-specialist-wild-01.md`
- **Rights basis:** Project-owned original generated artwork under the MIT License; likeness, originality, and public-redistribution review passed.

## Creative brief

Create a fictional, non-identifiable adult field technician from Meridian Containment. Present the person as a calm professional in a faded olive work jacket, tan canvas utility equipment, black knit hood, clear low-profile protective goggles, charcoal face covering, and compact ear protection. The equipment must remain ordinary and fictional: no military or law-enforcement uniform, rank, flag, badge, real insignia, recognizable loadout, weapon, or branded product.

The portrait should feel immediately readable as a tactical-game character without copying any character, uniform, pose, credential, or interface. A simple amber-gold outer plate may establish the Wild tier, while the person and silhouette remain readable without that color. Avoid a heroic combat pose; use a neutral alert three-quarter stance.

## Composition and delivery

- Centered chest-up three-quarter portrait with a strong, uncluttered silhouette.
- Square-safe subject with at least 8% clear margin and enough vertical separation for a credential-like frame added in code.
- Transparent background; do not bake UI, labels, numbers, logos, or a card frame into the portrait.
- Neutral fill with a restrained warm late-afternoon rim light.
- Fictional adult with no resemblance to a public figure, contributor, or identifiable private person.
- Runtime delivery: 512×512 WebP with alpha; no raw generation dump is retained in the public repository.

## Accessibility and animation handoff

- Recognizable at 128 px and tolerable at 96 px in color and grayscale.
- Hood, goggles, and shoulder silhouette must distinguish it from equipment symbols.
- The `WILD` label and persistent tier border should be rendered separately so the state remains legible without portrait details or color.
- Reduced-motion mode uses a static amber-gold border and Wild label instead of a pulse.

## Acceptance gates

- [x] Originality, rights, and fictional-likeness review completed.
- [x] No real person, public figure, military/police uniform, rank, flag, insignia, weapon, or recognizable branded equipment.
- [x] No text, logo, watermark, copied game interface, gore, or real-money gambling cue.
- [x] Clean alpha, correct 512×512 dimensions, 8% safe margin, and no unwanted metadata.
- [x] Readable at 128 px, 96 px, in grayscale, and during reel motion.
- [x] Wild status is also communicated by a separate label and shape treatment.
- [x] Runtime asset, prompt record, and approved manifest entry are reviewed together.
