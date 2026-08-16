# Defuse Protocol art direction

## Purpose and status

This document defines the visual and sound direction for Defuse Protocol, a free, educational slot-machine simulator using virtual credits. It is the shared brief for implementation, asset creation, and review. It does not authorize real-money gambling features or use of third-party intellectual property.

The playable prototype combines original procedural fallbacks with approved production visual, motion, and audio slices. Generated and reviewed runtime artwork covers the complete eleven-symbol family plus base, Relay Alpha, and Relay Bravo Pelagos environments. Staggered reel settling, exact payline traces, payout-tier VFX, large big/major totals, full-name line feedback, CORE activation, route atmosphere, bonus autoplay, a completed-feature summary, accessible result feedback, and grounded result-driven audio/music are implemented.

Defuse Protocol must feel like an original, realistic, gritty tactical operation at an invented industrial site. Familiarity comes from the broad visual grammar of classic competitive tactical games: strong silhouettes, practical contemporary equipment, sun-worn masonry, restrained field-console UI, and fast amber-versus-neutral state reading. It must never imitate Counter-Strike or any particular game, map, character, composition, interface, military organization, or weapon manufacturer.

## Creative north star

**"A field team crosses a sun-worn coastal relay depot to secure a portable communications module."**

The tone is disciplined, tense, and premium rather than heroic, militaristic, or violent. The player is seeing an abstract operation console, not a battlefield. The setting relies on sun-bleached concrete, chipped beige plaster, corrugated steel, plywood crates, chain-link fencing, canvas covers, utility cables, sea haze, and warm late-afternoon light. Human figures are scarce, fully fictional, non-graphic, and presented as field specialists rather than real-world soldiers.

### Original setting and factions

- **Setting:** Pelagos Relay, a fictional coastal communications and desalination depot built from repurposed concrete warehouses.
- **Faction A — Meridian Containment:** practical emergency technicians in faded olive work layers, tan canvas equipment, graphite protection, and amber identifiers. Their mark is an abstract three-part signal arc, not a crest, flag, or badge.
- **Faction B — Breakwater Recovery:** independent recovery contractors in sand-colored workwear, charcoal webbing, and muted rust-orange identifiers. Their mark is a split hexagonal beacon, not an insignia used by any real group.
- **Central object:** the **Signal Core**, a portable fictional field communications relay with ordinary industrial controls. It replaces bombs, real explosive devices, and real-world tactical objectives.

Do not name characters "operators," use ranks, replicate game roles, present recognizable loadouts, or construct direct faction-versus-faction iconography. Narrative language should prefer *crew, team, technician, recovery unit, relay,* and *containment*.

## Visual language

### Palette

The base scene remains dark enough for atmosphere but has ample local contrast for playability. Color is a functional signal, never decoration alone.

| Role | Color | Use |
| --- | --- | --- |
| Deep field | `#171B19` | background, canvas gaps, recessed controls |
| Graphite | `#2B302D` | reel frames and controls |
| Faded olive | `#696B61` | secondary surfaces and low-value symbols |
| Weathered concrete | `#8A877B` | readable neutral type and edges |
| Hazard amber | `#D19A45` | primary action, key alerts, high-value accents |
| Muted signal green | `#718D89` | rare system state and secondary action |
| Emergency oxide | `#9E4435` | critical state only; never a persistent background |
| Reward brass | `#D8B25C` | premium win tier and rare highlights |
| Canvas light | `#E2DCCB` | restrained text highlights and specular edges |

Use amber as the dominant interaction color. Muted blue-green is a rare instrumentation cue, not a glow language. Reserve red for faults and time-critical warnings. All information conveyed by color must also use label, icon, position, or shape.

### Materials, lighting, and texture

- Prefer chipped plaster, dusty concrete, scuffed painted aluminum, rubber, canvas, worn plywood, and galvanized steel.
- Use a 70/20/10 balance: 70% warm neutral environment, 20% cool shadow, 10% selective amber or reward highlight.
- Light from a clearly motivated source: sunlight, task lamp, protected status bulb, or doorway bounce.
- Use grime and wear near seams, handles, corners, and feet. Keep symbol faces relatively clean so reels retain fast readability.
- Avoid black crush, omnipresent haze, excessive lens flare, fake film grain, and dense camouflage patterns.
- Keep blood, injuries, corpse imagery, gore, and graphic violence out of the project.

### Composition and camera

- Compose the game scene as a near-frontal equipment-console view; the reel area is the unquestioned focal plane.
- Reserve the upper background for depth: utility cables, rooflines, fencing, shutters, and pale sea haze.
- Keep the center third behind reels low-detail. Use crates, shutters, fencing, and architectural silhouettes at the outer edges and upper perimeter only.
- Present objects as centered, three-quarter product shots with clean silhouette separation, enough margin for square and portrait crops, and no clipped important detail.
- Use shallow depth of field only for background. Symbols, UI labels, and result effects remain sharp.

## Slot-symbol system

The math configuration owns the paytable. Art must use the following implemented IDs and names so visual hierarchy, help text, and result records remain aligned. Tier placement follows current regular-symbol value order but does not itself define odds.

| Tier | Implemented IDs and display names | Readability treatment |
| --- | --- | --- |
| High regular | `RECOVERY` Recovery Case; `PRECISION` Precision Platform; `CARBINE` Tactical Carbine | large isolated silhouette, metallic edge light, controlled reward-gold detail; fictionalized forms only |
| Mid regular | `KNIFE` Utility Knife; `SIDEARM` Suppressed Sidearm; `OPTIC` Optical Scanner | single recognizable fictional object, amber or muted-green coding, no complex backdrop |
| Low regular | `ARMOR` Armor Rig; `KEYCARD` Access Keycard; `RADIO` Field Radio | bold graphic object, geometric color block, maximum value contrast |
| Wild | `WILD` Containment Specialist | unique vertical credential or specialist silhouette, amber-gold border, persistent but restrained pulse |
| Scatter / feature | `CORE` Signal Core | compact rectangular field-relay silhouette, analog meter and protected amber lamp, unmistakable CORE label |

Symbols must be original. Grounded weapon symbols may use believable contemporary construction, practical proportions, and restrained wear, but must be unbranded fictional designs rather than replicas of a specific manufacturer, exact real-world model, game weapon, skin, or composition. They are isolated collection-style props with no firing, ammunition display, combat scene, person handling them, or graphic violence. All equipment remains free of military insignia and real-world affiliation.

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
- **Panels:** dark olive-graphite slabs, neutral metal edges, an amber active indicator, restrained rounding (2–4 px), and calm spacing.
- **Controls:** one visually dominant primary Spin control; secondary controls remain quiet. Buttons use clear labels in addition to iconography.
- **Data:** use tabular figures for balance, stake, win, and simulated statistics. Include `Virtual credits`, `Theoretical`, and `Observed` labels wherever applicable.
- **Feedback:** a win begins with an exact frame/line trace, then a large confirmed virtual-credit total, full-name line ledger, and grounded cabinet/background response; it never pretends to influence the spin result.
- **No imitation:** do not use copied buy-menu layouts, radar shapes, crosshair conventions, round-result banners, weapon-skin grids, familiar map callouts, or recognizable game terminology.

## Motion, VFX, and sound

### Motion and VFX

The prototype implements restrained result-driven reel presentation. It uses per-reel deceleration, mechanical settle, exact winning-cell outlines, short result sweeps, CORE activation rings, and route-specific rails. Any future effects must continue to display an outcome generated before animation starts.

Motion should read as a heavy, reliable field instrument.

- Reels use weighted deceleration, subtle mechanical settle, and a result lock that occurs only after the engine has produced the outcome. This is implemented with a 244 ms base and 47 ms per-reel stagger.
- Ambient effects: sparse dust motes, heat haze, a subtle canvas edge movement, and occasional status-light sweep.
- Implemented win effects: layered amber route traces, temporary non-winner dimming, tier-scaled cabinet/background response, deterministic light sweeps and particles, counted big/major totals, and a full-name line ledger. Ordinary reel art has no abbreviation overlay; only the functional `CORE` and `WILD` marks retain condensed nameplates.
- Implemented feature effects: CORE activation rings, Alpha containment rails, and Bravo recovery rails. Meter needles, relay pips, and brief signal distortion remain optional future polish. Avoid holograms, explosions, gunfire, shell casings, shock imagery, or combat simulation.
- Respect `prefers-reduced-motion`: remove camera shake, reduce particle count, halt ambient motion, and replace flashes with static outlines.
- Do not use uncontrolled strobing. Any repeated flash must be below 3 Hz and never be the only communication of state.

### Audio

The production audio layer implements the following direction with twenty original, deterministically synthesized Ogg assets. It uses no third-party recordings, sample libraries, voice lines, copied game sounds, or synthesized noise layers in gameplay effects.

Audio evokes machinery, weather, relays, and secure instruments—not a copyrighted tactical shooter.

- Ambient bed: wind through metalwork, quiet pumps, and low electrical hum.
- Reels: mechanical rollers, contact switches, and small magnetic latches.
- Wins: tuned metallic chimes, soft synthesized pulses, and restrained pneumatic release.
- Feature: rising relay tone and containment lock, not sirens resembling game assets, weapon reports, voice lines, radio chatter, or recognizable round-announcement rhythms.
- Route music: Alpha uses a restrained precision pulse and tuned relay contacts; Bravo uses heavier low mechanical tonal percussion. Both are seamless, sparse, and free of orchestral casino-fanfare language.
- Provide independent master, ambience, music, and effects controls; text equivalents for meaningful audio cues; and a mute state that is persisted locally.

The browser mixer, cue mapping, synthesis method, and accessibility behavior are documented in [audio-design.md](audio-design.md). All gameplay cues are derived from an already committed result and cannot affect randomness or payout.

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
- Include: `original fictional contemporary tactical-industrial equipment; realistic gritty premium game asset; no text, logo, watermark, recognizable brand, real organization, or copyrighted game reference`.
- Use the same camera language: centered three-quarter product shot, practical rim lighting, dark separated background, square-safe subject.
- Exclude science fiction, cyberpunk, neon, holograms, energy chambers, sealed space helmets, copied maps, copied character gear, and recognizable objective props.
- Generate or edit only assets that can be demonstrated to be original or whose license permits public redistribution. Keep a record of every source and transformation.
- Never ask a generator to imitate a named living artist, company visual identity, game, map, operator, weapon skin, or specific copyrighted reference.
- Human imagery must use fictional, non-identifiable adults and avoid real military or law-enforcement uniforms.

## Public repository asset policy

Only commit final, necessary, redistributable assets. Do not commit raw generation dumps, third-party reference boards, paid stock exports, unverified downloads, personal photographs, or source materials with unclear rights.

Every committed asset needs a repository-relative provenance record containing its path, type, creator/source, creation method, license or rights basis, date, and any material edits. Prompts may be retained only when they contain no secrets, private references, unsafe content, or third-party copyrighted requests.

See [asset-pipeline.md](asset-pipeline.md) for formats, filenames, provenance fields, and review gates.
