# Defuse Protocol art direction

## Purpose and status

This document defines the visual and sound direction for Defuse Protocol, a free, educational slot-machine simulator using virtual credits. It is the shared brief for implementation, asset creation, and review. It does not authorize real-money gambling features or use of third-party intellectual property.

The playable prototype currently uses original procedural graphics, CSS styling, typography, and code-rendered PixiJS shapes and effects. Those visuals establish layout and interaction, not final production art. Illustrated symbols, environmental artwork, animation polish, and all production audio remain future work subject to the asset-provenance policy.

Defuse Protocol must feel like an original, realistic, gritty tactical operation at an invented industrial site. It may evoke the broad genre of tactical equipment and high-stakes containment work, but it must never imitate Counter-Strike or any particular game, franchise, military organization, or weapon manufacturer.

## Creative north star

**"A containment team races through a storm-battered desalination plant to secure an unstable signal core."**

The tone is disciplined, tense, and premium rather than heroic, militaristic, or violent. The player is seeing an abstract operation console, not a battlefield. The setting relies on worn steel, rain-dark concrete, sodium-vapor lighting, fogged glass, cables, and distant industrial machinery. Human figures are scarce, fully fictional, non-graphic, and presented as mission silhouettes rather than real-world soldiers.

### Original setting and factions

- **Setting:** Pelagos Relay, a fictional offshore desalination and communications facility during a containment shutdown.
- **Faction A — Meridian Containment:** practical emergency technicians in slate-blue rain shells, matte graphite equipment, and amber task lights. Their mark is an abstract three-part signal arc, not a crest, flag, or badge.
- **Faction B — Breakwater Recovery:** independent salvage contractors in oxidized red safety layers, charcoal webbing, and cool cyan instruments. Their mark is a split hexagonal beacon, not an insignia used by any real group.
- **Central object:** the **Signal Core**, a fictional energized communications module. It replaces bombs, real explosive devices, and real-world tactical objectives.

Do not name characters "operators," use ranks, replicate game roles, present recognizable loadouts, or construct direct faction-versus-faction iconography. Narrative language should prefer *crew, team, technician, recovery unit, relay,* and *containment*.

## Visual language

### Palette

The base scene remains dark enough for atmosphere but has ample local contrast for playability. Color is a functional signal, never decoration alone.

| Role | Color | Use |
| --- | --- | --- |
| Deep field | `#101518` | background, unlit steel, canvas gaps |
| Graphite | `#202A2D` | reel frames and controls |
| Storm slate | `#40545A` | secondary surfaces and low-value symbols |
| Weathered concrete | `#7B817B` | readable neutral type and edges |
| Hazard amber | `#E89B2C` | primary action, key alerts, high-value accents |
| Signal cyan | `#47B9C5` | system state, radar/relay effects, secondary action |
| Emergency vermilion | `#C84D3C` | critical state only; never a persistent background |
| Reward gold | `#F3C65A` | premium win tier and rare highlights |
| Mist | `#D7E0DC` | restrained text highlights, steam, specular edges |

Use amber and cyan together only where a relationship must be communicated (for example, an armed-versus-secured system state). Reserve red for faults and time-critical warnings. All information conveyed by color must also use label, icon, position, or shape.

### Materials, lighting, and texture

- Prefer rain-soaked paint, brushed aluminum, scuffed powder-coated steel, rubber, glass, and oxidized copper.
- Use a 70/20/10 lighting balance: 70% cool low-key environment, 20% warm practical lights, 10% selective cyan or reward glow.
- Light from a clearly motivated source: ceiling strip, task lamp, warning beacon, illuminated instrument, or distant machinery.
- Use grime and wear near seams, handles, corners, and feet. Keep symbol faces relatively clean so reels retain fast readability.
- Avoid black crush, omnipresent haze, excessive lens flare, fake film grain, and dense camouflage patterns.
- Keep blood, injuries, corpse imagery, gore, and graphic violence out of the project.

### Composition and camera

- Compose the game scene as a near-frontal equipment-console view; the reel area is the unquestioned focal plane.
- Reserve the upper background for depth: hazy relay towers, piping, catwalk geometry, and rain-streaked windows.
- Keep the center third behind reels low-detail. Use strong silhouettes at the outer edges and upper perimeter only.
- Present objects as centered, three-quarter product shots with clean silhouette separation, enough margin for square and portrait crops, and no clipped important detail.
- Use shallow depth of field only for background. Symbols, UI labels, and result effects remain sharp.

## Slot-symbol system

The math configuration owns the paytable. Art must use the following implemented IDs and names so visual hierarchy, help text, and result records remain aligned. Tier placement follows current regular-symbol value order but does not itself define odds.

| Tier | Implemented IDs and display names | Readability treatment |
| --- | --- | --- |
| High regular | `RECOVERY` Recovery Case; `PRECISION` Precision Platform; `CARBINE` Tactical Carbine | large isolated silhouette, metallic edge light, controlled reward-gold detail; fictionalized forms only |
| Mid regular | `KNIFE` Utility Knife; `SIDEARM` Suppressed Sidearm; `OPTIC` Optical Scanner | single recognizable tool or instrument, amber or cyan coding, no complex backdrop |
| Low regular | `ARMOR` Armor Rig; `KEYCARD` Access Keycard; `RADIO` Field Radio | bold graphic object, geometric color block, maximum value contrast |
| Wild | `WILD` Containment Specialist | unique vertical credential or specialist silhouette, amber-gold border, persistent but restrained pulse |
| Scatter / feature | `CORE` Signal Core | circular or octagonal containment geometry, cyan-to-amber transition, unmistakable CORE label |

Symbols must be original. Do not generate branded firearms, recognizable gun silhouettes, licensed equipment, military insignia, or exact real-world equipment models. If a tool, weapon-like prop, or device could dominate recognition, make it a fictional relay or recovery instrument instead.

### Reel readability rules

- Every symbol must be identifiable at 128 px square and tolerable at 96 px square.
- Each symbol has one primary silhouette, one focal material, and at most two accent colors.
- Do not put descriptive text inside base symbols; the exception is a short, large functional label such as `WILD` or `CORE` if the game design requires it.
- Keep key content inside an 8% safe margin; do not rely on thin strokes, smoke, or reflections for identity.
- Test in grayscale, at 200% browser zoom, and against reel-motion blur before approval.
- Use backgrounds that differ by value from adjacent symbols; never rely only on a frame color to distinguish a symbol.

## UI language

UI combines a robust field console with a premium casino-game clarity. It is not a simulated real military HUD.

- **Typography:** Prefer an openly licensed grotesk sans for controls and a distinct but legible condensed sans for numbers. Use sentence case, not militaristic all-caps strings by default.
- **Panels:** dark graphite slabs, 1 px cool edge, an 8 px amber active indicator, modest rounding (4–8 px), and calm spacing.
- **Controls:** one visually dominant primary Spin control; secondary controls remain quiet. Buttons use clear labels in addition to iconography.
- **Data:** use tabular figures for balance, stake, win, and simulated statistics. Include `Virtual credits`, `Theoretical`, and `Observed` labels wherever applicable.
- **Feedback:** a win begins with a frame/line highlight, then numerals and VFX; it never obscures the final symbols or pretends to influence the spin result.
- **No imitation:** do not use copied buy-menu layouts, radar shapes, crosshair conventions, round-result banners, weapon-skin grids, familiar map callouts, or recognizable game terminology.

## Motion, VFX, and sound

### Motion and VFX

The prototype already uses restrained code-rendered motion and result-driven reel presentation. The richer effects below are the production target and must continue to display an outcome generated before animation starts.

Motion should read as industrial energy controlled by a reliable machine.

- Reels use weighted deceleration, subtle mechanical settle, and a result lock that occurs only after the engine has produced the outcome.
- Ambient effects: drifting steam, rain streaks outside glass, occasional status light sweep, and sparse dust motes.
- Win effects: short amber edge sweep, grounded spark particles, a small vapor burst, then an unobtrusive win counter.
- Feature effects: relay rings, electromagnetic distortion, and a cyan-to-amber containment pulse. Avoid explosions, gunfire, shell casings, shock imagery, or combat simulation.
- Respect `prefers-reduced-motion`: remove camera shake, reduce particle count, halt ambient motion, and replace flashes with static outlines.
- Do not use uncontrolled strobing. Any repeated flash must be below 3 Hz and never be the only communication of state.

### Audio

The prototype does not yet include production audio. The following remains an asset-production brief for future work.

Audio evokes machinery, weather, relays, and secure instruments—not a copyrighted tactical shooter.

- Ambient bed: wind through metalwork, quiet pumps, distant buoy bell, and low electrical hum.
- Reels: mechanical rollers, contact switches, and small magnetic latches.
- Wins: tuned metallic chimes, soft synthesized pulses, and restrained pneumatic release.
- Feature: rising relay tone and containment lock, not sirens resembling game assets, weapon reports, voice lines, radio chatter, or recognizable round-announcement rhythms.
- Provide independent master, ambience, effects, and music controls; subtitles or text equivalents for meaningful audio cues; and a mute state that is persisted locally.

## Accessibility

- Meet WCAG 2.2 AA color contrast where text and controls are concerned; important text should normally meet 4.5:1.
- Do not convey win tier, feature trigger, selected state, or error state with color alone.
- Provide visible focus states, keyboard operation, semantic control labels, and screen-reader announcements that report spin outcome after it is known.
- Keep game-critical UI outside canvas-only interaction where possible, or provide equivalent accessible HTML controls and text.
- Offer reduced motion, reduced effects, persistent sound controls, and a high-contrast UI mode.
- Avoid rapid brightness shifts, tiny type, unlabelled icon-only actions, and long unskippable animations.

## Generated-image consistency rules

Generated imagery is source art, not a final guarantee. Use a single asset brief and controlled prompt vocabulary across an asset family.

- Start each image prompt with the subject, intended symbol tier, centered composition, chosen palette role, material, light source, and output framing.
- Include: `original fictional tactical-industrial equipment; realistic gritty premium game asset; no text, logo, watermark, recognizable brand, real organization, or copyrighted game reference`.
- Use the same camera language: centered three-quarter product shot, practical rim lighting, dark separated background, square-safe subject.
- Generate or edit only assets that can be demonstrated to be original or whose license permits public redistribution. Keep a record of every source and transformation.
- Never ask a generator to imitate a named living artist, company visual identity, game, map, operator, weapon skin, or specific copyrighted reference.
- Human imagery must use fictional, non-identifiable adults and avoid real military or law-enforcement uniforms.

## Public repository asset policy

Only commit final, necessary, redistributable assets. Do not commit raw generation dumps, third-party reference boards, paid stock exports, unverified downloads, personal photographs, or source materials with unclear rights.

Every committed asset needs a repository-relative provenance record containing its path, type, creator/source, creation method, license or rights basis, date, and any material edits. Prompts may be retained only when they contain no secrets, private references, unsafe content, or third-party copyrighted requests.

See [asset-pipeline.md](asset-pipeline.md) for formats, filenames, provenance fields, and review gates.
