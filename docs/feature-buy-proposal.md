# Virtual-credit feature buy

**Status: implemented.** This document records the design and the measured prices. Behaviour
described here exists in the game.

## Concept

A player holding enough virtual credits can enter a Relay feature immediately, instead of waiting
for three Signal Cores to land, by staking a large multiple of the current wager.

This is a virtual-credit game mechanic, not a purchase. It involves no money, no deposit, no
external transaction, and no cash-out, so it stays inside the product rule that forbids real-money
features. The word "buy" refers only to spending simulated credits already in the session.

## Pricing

The published `tune-v1` figures in the [tuning report](tuning-report.md) could not be used
directly, and the difference matters. Those conditional feature payouts — 1,629.97 for Alpha and
1,553.43 for Bravo at a 20-credit wager — average entries at three, four, and five Cores, and they
exclude the line payout of the triggering spin itself. A purchased entry is always the **minimum**
three-Core award, so it returns less than the average triggered feature.

Pricing from that arithmetic alone gave 84x and 82x, which measured at 94.71% and 90.49% — well
under the routes they were meant to match. The shipped prices were set from seeded samples of
60,000 purchases per route, re-checked across three seeds:

| Route | Price | Cost at a 20-credit wager | Measured purchased return | Ordinary route RTP |
| --- | ---: | ---: | ---: | ---: |
| Relay Alpha | **83x wager** | 1,660 | 95.64% - 96.58% | 96.7042% |
| Relay Bravo | **79x wager** | 1,580 | 93.83% - 94.15% | 94.6083% |

Both sit slightly below the return of reaching the same route in ordinary play, so buying is never
the optimal strategy. It trades a small amount of expected return for immediacy.

**The route is chosen before the price is charged**, which is what makes per-route pricing safe.
Had the player paid first and picked the route afterwards, the purchase would be worth the better
of the two routes, and a single price based on the weaker one would have been a
positive-expectation option.

Still open: tiered prices for the four- and five-Core awards. A purchase currently grants the
three-Core award only. Tiered buys need their own samples before they can be priced.

## Mathematics and reporting

- The published base-game RTP of 29.3169% and the bonus-entry probability of 0.00856 describe
  ordinary paid spins. A purchased entry is a different wager stream and is never folded into
  those figures.
- The simulator takes an `entry` of `paid` or `purchased`. A purchased run stakes the buy cost per
  entry and plays only the feature, so its return is reported as its own wager stream, and the
  report carries the `entry` it describes.
- The confirmation dialog discloses the price in credits and as a multiple of the wager, and
  states that a bought route returns slightly less over time than reaching it in ordinary play.

## Engine boundary

A feature buy is a real game action, unlike the developer cheat factory, so it lives on the public
engine surface:

- `buyFeature(session, route, balance)` validates the phase and wager, computes the price from
  configuration, refuses when the balance cannot cover it, and returns a session in the `bonus`
  phase together with the cost and the spins awarded.
- `featureBuyCost(session, route)` exposes the price so the interface never derives it itself.
- **No randomness is consumed.** The award follows entirely from the route and the declared
  purchased scatter count, so a seeded session is left exactly where it was and replay is
  unaffected. A unit test asserts the RNG snapshot is unchanged by a purchase.
- `BonusState.entry` records `purchased` or `triggered`, so a purchased feature can never be
  reported as ordinary play.
- Configuration validation covers the price fields and the purchased scatter count, so an invalid
  price fails loudly at startup.

## Interface

- A **Buy feature** control in the control deck, styled deliberately quieter than Spin.
- Disabled outright when the balance cannot cover the cheaper route. Inside the dialog each route
  is disabled individually, with the shortfall stated, when only that one is out of reach.
- A confirmation dialog, because this is by far the largest single stake in the game and should
  not be one misplaced click away.
- The dialog repeats that the credits are virtual and that there is no money, deposit, or
  cash-out.

## Responsible-simulator notes

Several regulators restrict or ban feature buys in real-money products, precisely because they
compress the cost of volatility into one decision. That is an argument for presenting the mechanic
honestly here rather than for hiding it: this project exists to show how these systems work. The
implementation therefore discloses the price, states that the purchase returns less than ordinary
play, and notes that a purchased feature carries the same variance as a triggered one.

The browser-local play record counts a purchase as staked credits, so the net figure stays
truthful.

## Acceptance checks

- [x] Prices derived from fresh seeded samples, not from the published averages alone.
- [x] Purchased entries excluded from base-game RTP and bonus-frequency reporting.
- [x] Simulator reports purchased-entry return as its own statistic.
- [x] Deterministic replay of a purchased feature from a seed — a purchase consumes no randomness.
- [x] Affordability gate, confirmation step, and disclosure verified in a browser.
- [x] Documentation updated in the same change.
- [ ] Tiered prices for four- and five-Core purchases, if wanted.
