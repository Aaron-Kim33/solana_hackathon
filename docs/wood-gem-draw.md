# Wood gem draw — initial balance

- Cost: 10,000 wood per single draw. No SOL/SKR, coins, auto-repeat, batch purchase, or cash-out.
- Independent probabilities: Low 70%, Medium 25%, High 5%. No pity guarantee. Supreme/Legendary cannot be drawn.
- The result is an unopened gem; opening separately yields one same-tier random option (three types equally likely). Equipping remains consumable and replaces the old slot permanently.
- UI shows cost, owned wood and odds before confirmation. Result is displayed only after a successful atomic save. Stale/double confirmation cannot spend twice from the same snapshot.
- Expected cost for one High gem: 200,000 wood, not a guarantee. This is an initial tuning choice, not validated against live play.

| Tier | Damage | Crit chance pp | Crit damage pp |
| --- | --- | --- | --- |
| Low | 3 | 1 | 13 |
| Medium | 15 | 5 | 65 |
| High | 30 | 10 | 130 |
| Supreme | 60 | 20 | 260 |
| Legendary | 120 | 40 | 520 |

Existing equipped and unused options use the new tier values. Supreme and Legendary are now obtainable through next-tier fusion (three source gems, 20% success); wood draws still stop at High. Existing developer test grants are preserved. This table supersedes the temporary inverted tiers noted in deepwood-axe.md.

Release caveat: randomness and balances are currently client-side. If wood can be purchased, transferred or redeemed later, review the economy and applicable store requirements and implement server-authoritative draws before release. No live player resources were spent for testing.

Manual QA: insufficient wood disables draw; cancel leaves balance unchanged; confirm removes 10,000 and adds exactly one gem; restarting preserves result; opening and equipping are separate steps; check Korean and English layouts.
