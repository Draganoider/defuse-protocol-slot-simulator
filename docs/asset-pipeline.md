# Defuse Protocol asset pipeline

## Purpose and status

This document defines the asset pipeline for visual, audio, and animation assets. It was exercised end to end for the complete eleven-symbol production family, three Pelagos Relay environment states, and twenty-asset audio family: approved briefs, original generation or deterministic synthesis, technical preparation, provenance records, runtime integration, focused review, and automated QA. It exists to make assets consistent, performant, accessible, legally redistributable, and appropriate for a public GitHub repository. The repository is an educational virtual-credit simulator; assets must never imply real-money gambling, real-world affiliation, or financial gain.

This pipeline follows the visual constraints in [art-direction.md](art-direction.md). It does not permit copying, tracing, training from, or stylistically cloning Counter-Strike or any other protected game property.

## Asset lifecycle

```text
Brief → approved asset card → original creation/generation → local review
      → technical preparation → provenance record → in-game review → commit
```

1. **Brief:** describe gameplay role, target tier, visual state, minimum display size, and accessibility needs.
2. **Asset card:** assign a stable asset ID, owner, source/right basis, prompt record location (when applicable), and acceptance criteria.
3. **Creation:** draw, model, record, synthesize, or generate an original asset from the approved brief.
4. **Local review:** assess originality, safety, art-direction fit, clarity, and source rights before optimization.
5. **Technical preparation:** crop, export, name, add alpha if required, and create declared variants.
6. **Provenance record:** update the asset manifest in the same change before the asset is committed.
7. **In-game review:** inspect static, moving, low-resolution, reduced-motion, color-blind, and muted contexts.
8. **Commit:** add only approved deliverables and their documentation. Build output and source dumps stay untracked.

## Repository layout

The symbol, scene, and audio paths are active. UI and VFX paths remain reserved for future approved assets. The optional image-preparation utility requires Python 3 and Pillow. The deterministic audio generator requires Node.js and FFmpeg with `libvorbis`; neither preparation tool is part of the browser runtime dependency graph.

```text
src/assets/
  symbols/                 # runtime slot symbols
  scenes/                  # scene backgrounds and overlays
  ui/                      # shared UI texture assets, if any
  vfx/                     # spritesheets and effect textures
  audio/                   # original or licensed runtime audio
docs/assets/
  manifest.json            # provenance and licensing manifest
  prompts/                 # approved sanitized prompt records
  briefs/                  # asset cards / family briefs
scripts/
  process-symbol-asset.py  # alpha-crop and 512×512 lossless WebP preparation
  generate-audio.mjs       # deterministic PCM synthesis and Ogg export
```

If Git LFS is later introduced for large binary assets, record that decision in an ADR and describe contributor setup in public documentation. Do not use LFS merely to hide unclear provenance.

## Asset specifications

| Family | Authoring / delivery | Target specification | Notes |
| --- | --- | --- | --- |
| Base reel symbols | PNG or WebP with alpha | 1024×1024 master; runtime variant 512×512 | Centered subject, 8% safe margin; preserve master outside build output |
| Symbol state overlays | PNG/WebP alpha or atlas | 512×512 or compact atlas regions | Glow, selection, and win effects stay separable from base art |
| Background scenes | WebP/AVIF where supported; PNG master | 2560×1440 desktop, responsive crops | Avoid text baked into scene art |
| UI decoration | SVG for simple geometric elements; PNG/WebP for texture | display-size appropriate | Do not turn accessible controls into image-only UI |
| VFX textures | PNG alpha atlas | power-of-two atlas where practical | Document sprite rects, scale, blend, and frame rate |
| Music / ambience | OGG or AAC runtime; WAV archival master if rights allow | 44.1 kHz, stereo | Loop points documented; avoid recognizable sound-alikes |
| UI / reel SFX | OGG or AAC runtime; WAV archival master if rights allow | 44.1 kHz, mono or stereo | Trim silence; normalize conservatively |
| Font files | WOFF2 only when license allows redistribution | subset if appropriate | Prefer system and open fonts; include license notice |

Use transparencies only where they benefit rendering. Prefer image atlases for many small PixiJS textures, ensure no texture edge bleed, and do not rasterize simple shapes that are better made in code or SVG.

### Performance budgets

- Keep individual symbol runtime textures at or below 512×512 unless an approved quality need is documented.
- Prefer a single 2048×2048 or smaller atlas per coherent reel asset family; split only when profiling supports it.
- Load the title scene first and defer bonus-only art and audio.
- Provide resolution tiers or responsive alternatives for mobile; do not simply downscale an oversized desktop scene in memory.
- Profile texture memory, draw calls, initial download, audio decode, and frame time on a lower-end supported device before release.
- Use the `docs/assets/manifest.json` record to indicate intended runtime variant; keep archival masters out of the public repository if their size or license makes that unsuitable.

## Naming convention

Use lowercase kebab case. Start with the asset family and semantic role; never encode a third-party name or a vague temporary label.

```text
symbol-signal-core-base-01.webp
symbol-containment-lead-wild-01.webp
scene-pelagos-relay-main-2560x1440.webp
vfx-relay-pulse-atlas-01.png
sfx-reel-latch-01.ogg
music-pelagos-ambient-loop-01.ogg
```

Use numeric versions only for separate approved deliverables; do not overwrite a committed asset silently. Remove rejected assets before a public release only after confirming no code, manifest, or documentation references remain.

## Provenance, licensing, and attribution

Each committed asset needs a matching entry in `docs/assets/manifest.json`. Suggested schema:

```json
{
  "id": "symbol-signal-core-base-01",
  "path": "src/assets/symbols/symbol-signal-core-base-01.webp",
  "kind": "image",
  "status": "approved",
  "createdBy": "project contributor or approved generator",
  "creationMethod": "original generation, then project editing",
  "rightsBasis": "project-owned original asset",
  "license": "repository license or applicable asset license",
  "createdOn": "YYYY-MM-DD",
  "promptRecord": "docs/assets/prompts/symbol-signal-core-base-01.md",
  "attribution": null,
  "notes": "No third-party marks or references."
}
```

For third-party assets, replace the rights fields with the exact compatible license, canonical source URL, required attribution text, modification record, and a statement that commercial/public redistribution is allowed. Do not include an asset until that statement is verifiably true. Do not store private source URLs, access tokens, user names, email addresses, purchase receipts, or account-specific data in the manifest.

When source code and assets have different licenses, document that visibly in the root license/readme and preserve all required notices. A public repository should make it easy for a contributor to determine what may be reused.

## Prompt-record guidance

For generated assets, write a short sanitized Markdown prompt record at `docs/assets/prompts/<asset-id>.md`. It should contain:

- asset ID and creation date;
- intended game use and art family;
- the final prompt or a faithful concise summary;
- generation/editing tool class and human post-processing, if any;
- seed or reproducibility parameter only if it does not expose private data;
- negative constraints: no brands, logos, text, watermarks, real organizations, named games, copied compositions, gore, or real-money gambling cues;
- review decision and reviewer initials/role (not private personal information).

Do not retain prompts that request infringement, private references, confidential source material, personal data, or unsafe imagery. Rework the asset from a compliant prompt instead.

## Review checklist

Every new or changed asset must pass these checks before it enters the public repository:

- [ ] Original identity: no Counter-Strike or other game name, logo, map, character, operator, interface, weapon skin, sound, pose, or recognizable composition.
- [ ] Rights: creator/source, exact license/right basis, and required attribution are in the manifest.
- [ ] Safety: no gore, real-world armed-force branding, extremist imagery, graphic violence, or real-money gambling imagery.
- [ ] Readability: recognizable at 128 px; sufficient silhouette/value distinction from neighboring reel symbols.
- [ ] Direction: palette, materials, lighting, and setting follow the Pelagos Relay brief.
- [ ] Accessibility: no critical state depends on color, rapid flashes, tiny raster text, or audio alone.
- [ ] Technical quality: correct crop, alpha handling, compression, dimensions, filename, and no embedded watermark or unwanted metadata.
- [ ] Runtime behavior: tested in static and animated states; quality is acceptable with reduced motion and muted audio.
- [ ] Optimization: asset is appropriately sized, loaded at the right time, and does not regress measured performance budgets.
- [ ] Documentation: asset card, prompt record (if generated), and manifest update are included in the same review.

## What must never be generated or committed

- Counter-Strike-derived names, logos, maps, character designs, faction marks, user interfaces, weapon skins, voice lines, audio, screenshots, or close recreations.
- Assets from a commercial game or product, including ripped files, screenshots, extracted audio, fan remakes, leaked art, or unlicensed reference packs.
- Real military, police, intelligence, extremist, or terrorist insignia; real-world conflict propaganda; political marks; or recognizable uniforms/loadouts presented as real organizations.
- Gore, blood, injuries, corpses, graphic violence, or frightening material inconsistent with the non-graphic containment tone.
- Third-party trademarks, product logos, watermarks, generator watermarks, private images, facial likenesses, copyrighted character likenesses, or personal data.
- Deposit, withdrawal, cash-out, cryptocurrency, payment, jackpot-as-income, financial-return, or real-money gambling imagery and language.
- Build artifacts, source-generation dumps, unverified downloads, raw paid-stock files, credentials, `.env` files, proprietary working files, or material without a documented compatible right to redistribute.

## Cross-functional handoff

The art contributor supplies approved runtime assets, provenance records, and implementation notes (dimensions, atlas coordinates, animation states, audio loop points). The renderer contributor decides how assets are loaded and animated. The primary agent validates that the implementation preserves the engine rule: a spin result is determined before it is animated, and effects only present that fixed result.

Any change to the asset license, generation policy, or long-term storage model is foundational and must be proposed to the primary agent for an ADR before implementation.
