# Prototype tuning report

**Configuration:** `defuse-protocol-standard-v1`  
**Math version:** `fixed-lines-1`  
**PRNG:** `mulberry32-v1`  
**Measurement seed:** `tune-v1`  
**Measurement date:** 2026-08-15

Defuse Protocol is a free educational simulator using virtual credits only. The figures below describe one declared configuration and do not promise financial return.

## What is theoretical

The following values are computed exactly from the complete base reel model:

| Statistic | Theoretical value |
| --- | ---: |
| Base-game RTP | 29.31687243% |
| Bonus-entry probability per paid base spin | 0.00856 |
| Paid spins per bonus entry | 116.82 |

The bonus-entry probability is route-independent because Relay Alpha or Relay Bravo is selected only after the base grid has generated at least three CORE symbols.

No complete theoretical RTP is claimed for the stateful feature routes. The route totals below are observed deterministic simulation results.

## Method

Each route was simulated independently for 200,000 paid base spins at the 20-credit minimum wager. Every payout from a triggered feature was attributed to its initiating paid base spin. Feature spins were not counted as paid spins.

Both runs used the checked-in ordered reel strips, paytable, route rules, and the canonical expansion of seed `tune-v1`. Results were generated directly from `mulberry32-v1`; no result was changed in response to balance, recent outcomes, or observed RTP. The simulator never imports or invokes the development-cheat factory.

## Observed results

| Observed statistic | Relay Alpha | Relay Bravo |
| --- | ---: | ---: |
| Paid base spins | 200,000 | 200,000 |
| Total wagered | 4,000,000 | 4,000,000 |
| Total payout | 3,868,169 | 3,784,332 |
| Observed RTP | 96.7042% | 94.6083% |
| Observed base-game contribution | 29.1013% | 29.3256% |
| Observed feature contribution | 67.6029% | 65.2827% |
| Bonus entries | 1,659 | 1,681 |
| Observed paid spins per bonus | 120.55 | 118.98 |
| Feature spins played | 17,402 | 13,242 |
| Retriggers | 119 | 740 |
| Total feature payout | 2,704,117 | 2,611,308 |
| Conditional feature payout per entry | 1,629.97 | 1,553.43 |
| Paid-spin return standard deviation | 9.9716 | 10.7774 |
| RTP standard error | 2.2297 percentage points | 2.4099 percentage points |
| Any-payout hit rate | 45.0820% | 45.0245% |
| Payout-above-wager rate | 7.1050% | 7.0535% |
| Largest observed paid-spin payout | 17,231 | 16,904 |

The largest observed payouts equal 861.55 and 845.20 times the 20-credit wager respectively. They are sample maxima, not theoretical maximum-win claims.

## Route comparison

The conditional feature averages differ by about 4.9%, which is close enough for the prototype to present route selection primarily as a volatility choice rather than a clearly dominant expected-value choice. Relay Bravo's paid-spin return standard deviation is about 8.1% higher than Relay Alpha's in this sample. The distinction is measurable but modest and should continue to be monitored if reel composition or payouts change.

The observed bonus-entry samples differ because feature spins consume the same deterministic stream as the session and therefore change the later base-spin stream position. The exact base-entry probability remains identical for both routes.

## Interpretation and caveats

- **Theoretical** labels above apply only to exact base-game and bonus-entry analysis.
- **Observed** route RTP, feature averages, standard deviations, hit rates, and maxima describe the named 200,000-spin samples.
- Relay Alpha's observed one-in-120.55 entry rate is narrowly outside the early one-in-100-to-120 sample target, while the exact theoretical rate of one in 116.82 is inside it.
- The approximately 45% any-payout hit rate is above the early 25-30% aspiration. That is a remaining product-tuning choice, not a hidden correction applied after a spin.
- Standard error reflects the high-variance paid-spin return distribution. A point estimate inside a target band does not convert it into a theoretical RTP.
- Any change to ordered strips, paytable values, feature rules, PRNG policy, or wager attribution requires fresh analysis and a new reproducible report.

## Related documents

- [Mathematical model](math-model.md)
- [Initial game math and Relay bonus ADR](adr/0004-initial-game-math-and-relay-bonus.md)
- [Architecture](architecture.md)
- [Prototype QA report](qa-report.md)
