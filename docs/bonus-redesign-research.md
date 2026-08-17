# Research: bonus feature depth and readability

**Status: research. Nothing here is implemented, and nothing here is decided.**

Two separate questions were raised together, and they are worth keeping apart because one is
cheap and low-risk while the other changes the mathematics:

1. **Readability** — during a feature, is it clear what is happening and why?
2. **Depth** — the routes are simple; is there a mechanic with more to follow?

Readability is worth doing regardless of whether the feature is redesigned, and it is much the
smaller change. Depth should not be attempted until the current feature is legible, because a
richer mechanic that is still unreadable is worse than a simple one.

## 1. What the feature already tells the player

Present today, from `FeatureMeter` and the live region:

| Route | Shown |
| --- | --- |
| Alpha | Spins left, containment charges as `n/3` with a progress bar |
| Bravo | Spins left, current multiplier, whether Core protection is armed |

What is missing is **causality**. The meters show state, not what changed or why:

- Nothing says *this spin collected a Core*, only that the total moved.
- Alpha never names **which** reels are secured, even though that is the whole point of the
  route — the player cannot see the Extraction Spin being built.
- Bravo shows a multiplier but not that a blank spin is what resets it, or that a shield just
  absorbed a reset.
- The Extraction Spin is not announced before it happens, so the payoff spin arrives unmarked.
- Retriggers add spins silently apart from a cue.

The engine already reports all of this. `BonusSpinEvent` carries `coresCollected`,
`newlySecuredReels`, `isExtractionSpin`, `retriggered`, `retriggerSpinsAwarded`,
`multiplierBefore`, `multiplierAfter`, `shieldGranted`, and `shieldConsumed`. **None of it
reaches the interface.** That is the single highest-value finding here: the feature is more
legible in the data than on the screen, and closing that gap needs no math change at all.

### Cheapest readable wins, in order

1. **Per-spin event line.** One short statement of what the last feature spin did: "Core
   collected — reel 3 secured", "Multiplier 2x to 3x", "Shield absorbed the reset", "+4 spins".
   Feeds straight from `BonusSpinEvent`, no engine change.
2. **Show Alpha's secured reels on the reels themselves.** Mark the secured columns in the
   renderer, which already knows the board geometry. The player then watches the Extraction Spin
   being assembled instead of reading a number.
3. **Announce the Extraction Spin** before it plays, the way the route choice is announced.
4. **Bravo ladder as a ladder.** Show `1x 2x 3x 5x` with the current step lit, so the player can
   see what the next win is worth and what a blank spin costs.
5. **Feature-total meter.** Accumulated feature return so far, which currently only appears in
   the summary at the end.

None of these change a result, and all of them are presentation-only work.

## 2. Depth: what a collection mechanic would actually cost

The request was a collecting mechanic. Worth naming the common shapes and what each implies here.

### Option A — Collect-to-upgrade (closest to what Alpha already does)

Cores collected during the feature persist and unlock tiers: extra spins, then a multiplier, then
expanding wilds. Alpha is already a partial version of this, so this is less a new mechanic than
finishing the existing one and making it visible.

*Cost:* small engine change, moderate presentation. *Math impact:* changes feature EV, so both
routes need re-tuning and the tuning report needs fresh samples.

### Option B — Symbol collection with a persistent meter

Specific symbols landing during the feature fill a meter that pays or upgrades when full. Reads
well and is easy to show. *Math impact:* adds a second payout channel; the paytable and RTP
analysis both need extending.

### Option C — Trail or map progression

Each feature spin advances along a track with rewards on the squares. Very readable, and it fits
the relay theme. *Math impact:* large — the trail is effectively a new game with its own
distribution, and the current `BonusState` cannot express it.

### Option D — Sticky-symbol respins (hold and win)

Cores lock in place and respins reset on each new Core, until positions fill. This is the most
different from the current feature, and the most likely to feel like a distinct second game.
*Math impact:* very large, essentially a second engine mode with its own strips and evaluation.

### Option E — Deepen Bravo instead of adding a mechanic

Bravo's ladder is 1x, 2x, 3x, 5x with shields. It could gain a risk decision — bank the current
multiplier or gamble it on the next spin. Adds a real player choice, which the feature currently
lacks after route selection.

*Math impact:* moderate, and it introduces a decision whose optimal strategy has to be analysed,
because a badly priced bank/gamble is exploitable.

### Comparison

| Option | Engine cost | Math re-tune | Player-visible depth | Fits the theme |
| --- | --- | --- | --- | --- |
| A Collect-to-upgrade | Low | Yes | Medium | Strong |
| B Symbol collection | Medium | Yes | Medium | Medium |
| C Trail | High | Yes, large | High | Strong |
| D Sticky respins | Very high | Yes, large | High | Medium |
| E Bravo bank/gamble | Medium | Yes | High, adds a decision | Strong |

## Recommendation

Do the readability work first, on its own, since it needs no math change and would improve the
feature even if the mechanic never changes. Then, if depth is still wanted, **A or E** are the
proportionate next steps: A builds on what Alpha already does, and E gives the player something
to decide rather than only something to watch. C and D are effectively new games and should be
scoped as such.

## What any depth change must not break

- Results stay generated before presentation, and animation may never select or alter one.
- RTP stays an emergent property of strips, probabilities, and the paytable — never corrected
  after the fact.
- The tuning report needs fresh seeded samples in the same change; the current route figures
  become wrong the moment feature behaviour changes.
- Purchased entries are priced from the feature's return, so the feature-buy prices in
  [the feature-buy note](feature-buy-proposal.md) must be re-measured too.
- Theoretical and observed figures stay clearly separated.

## Open questions for the owner

- Is the goal more *decisions* for the player, or more *events* to watch? A and B give events;
  E gives a decision. That choice drives everything else.
- Should both routes change, or should one stay simple as a contrast to a deeper one?
- Is a longer feature acceptable? A trail or sticky respins lengthen it considerably.
