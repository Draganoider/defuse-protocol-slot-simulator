# Proposed: virtual-credit feature buy

**Status: proposed. Not implemented.** Nothing described here exists in the game yet.

## Concept

Allow a player holding enough virtual credits to enter a Relay feature immediately, instead of
waiting for three Signal Cores to land, by staking a large multiple of the current wager.

This is a virtual-credit game mechanic, not a purchase. It involves no money, no deposit, no
external transaction, and no cash-out, so it stays inside the product rule that forbids
real-money features. The word "buy" refers only to spending simulated credits already in the
session.

## Why it needs a design pass rather than a quick control

The price is not a cosmetic number. It sets the return of an entirely new wager stream, and the
repository already publishes exact theoretical figures that must not be quietly invalidated.

## Pricing

From the `tune-v1` 200,000-spin samples in the [tuning report](tuning-report.md), at a 20-credit
wager:

| Route | Conditional feature payout per entry | As a multiple of wager | Observed route RTP |
| --- | ---: | ---: | ---: |
| Relay Alpha | 1,629.97 | 81.50× | 96.7042% |
| Relay Bravo | 1,553.43 | 77.67× | 94.6083% |

A price equal to the conditional payout would make the buy a break-even proposition at 100%
return, which is higher than either route returns in ordinary play. To keep the buy in line with
the rest of the game, price it as `conditional payout ÷ target return`:

- Alpha at 96.70% → about 1,686 credits, roughly **84× wager**
- Bravo at 94.61% → about 1,642 credits, roughly **82× wager**

**The route must be chosen before the price is charged.** If the player pays first and picks the
route afterwards, the expected value of the purchase is the better of the two routes, so a single
price based on the weaker route would hand the player a positive-expectation option. Either
charge a per-route price, or charge the Alpha price and let the route be chosen freely.

Open question: whether a buy grants the three-Core award (10 Alpha / 6 Bravo spins) or offers
tiered prices for the four- and five-Core awards. Tiered buys need their own conditional payout
samples before they can be priced.

## Mathematics and reporting

- The published base-game RTP of 29.3169% and the bonus-entry probability of 0.00856 describe
  ordinary paid spins. A purchased entry is a different wager stream and must never be folded
  into those figures.
- The simulator needs a third statistic alongside Alpha and Bravo: purchased-entry return over a
  seeded sample, so the buy can be verified rather than assumed from the arithmetic above.
- The paytable should disclose the buy price and its observed return, in the same way the Lab
  separates theoretical from observed values.

## Engine boundary

A feature buy is a real game action, unlike the developer cheat factory, so it belongs in the
public engine surface:

- `buyFeature(session, route)` validates the wager, computes the price from configuration,
  refuses when the balance cannot cover it, and returns a session in the `bonus` phase.
- Replay metadata records the entry as purchased, with the price paid, so a replay can be told
  apart from a natural trigger.
- It must consume randomness only where a real decision is made, and must remain deterministic
  under a supplied seed like every other transition.
- Configuration validation gains the price fields, so an invalid price fails loudly at startup.

## Interface

- A clearly labelled control near the wager showing the price as both credits and a multiple.
- Disabled, with the reason stated, when the balance cannot cover the price — the same treatment
  the out-of-credits state already uses.
- A confirmation step. This is by far the largest single stake in the game and should not be one
  misplaced click away.
- The existing virtual-credit disclaimer stays visible throughout.

## Responsible-simulator notes

Several regulators restrict or ban feature buys in real-money products, precisely because they
compress the cost of volatility into one decision. That is an argument for presenting the
mechanic honestly here rather than for hiding it: this project exists to show how these systems
work. The implementation should therefore disclose the price, the expected return of the
purchase, and the fact that a purchased feature has the same variance as a triggered one.

The browser-local play record should count purchases as staked credits so the net figure stays
truthful.

## Acceptance checks before this can be called implemented

- [ ] Price derived from a fresh seeded sample, not from the figures above alone.
- [ ] Purchased entries excluded from base-game RTP and bonus-frequency reporting.
- [ ] Simulator reports purchased-entry return as its own statistic.
- [ ] Deterministic replay of a purchased feature from a seed.
- [ ] Affordability gate, confirmation step, and disclosure verified in a browser.
- [ ] Tuning report, math model, and paytable updated in the same change.
