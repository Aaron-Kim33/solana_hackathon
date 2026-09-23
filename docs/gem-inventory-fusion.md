# Gem inventory and fusion

- Inventory grid displays all five tiers, including zero counts. Selecting a tier displays its effect table and single-gem opening action.
- Distinct code-native designs: green rough stone, blue elongated shard, purple inset diamond, orange three-crystal cluster, gold ringed jewel. Color is supplemented by silhouette, labels and exact counts.
- Fusion: three unopened gems of the selected tier, 20% independent chance of one unopened next-tier gem: Low → Medium → High → Supreme → Legendary. Legendary is terminal. All three materials are lost on failure too. No extra wood charge, no pity guarantee and no conversion of already opened/equipped options.
- Select the source tier in the inventory grid. Cost/chance/failure consumption are visible before confirmation. Confirmation captures the recipe, checks the latest balance and executes once; save succeeds before result presentation.

## Initial balance

| Inputs per attempt | Expected Low consumption per Medium success | Long-run extra Medium per 100 wood draws |
| --- | --- | --- |
| 10 | 50 | 1.4 |
| 5 | 25 | 2.8 |
| 3 (chosen) | 15 | 4.67 |

At 70% Low / 25% Medium / 5% High and 10,000 wood per draw, 100 draws already produce an expected 25 Medium gems directly. Recycling all Low gems at 3/20% increases long-run Medium supply about 18.7%; leftover materials make finite batches slightly lower. This is not a guaranteed conversion count. No gem should be opened automatically before players choose between use and fusion.

Synthetic current-code examples (seed 42, 100 accepted hits, all wood collected, tree upgrades when depleted, no other spending; fatigue reset only to measure hits, no live save access):

| Start tree / Deepwood level / lumber rank | Generated wood | Tree upgrade spend | Surplus |
| --- | --- | --- | --- |
| 101 / 1 / 10 | 28,742 | 9,180 | 19,562 |
| 101 / 100 / 20 | 51,952 | 18,630 | 33,322 |
| 200 / 100 / 20 | 52,832 | 18,090 | 34,742 |

Character level 20 at start, no slots/other mastery. These are sensitivity examples, not measured player averages or calendar-time forecasts. Three-input fusion gives surplus lows a use without replacing the main draw economy. Local RNG/save remain prototype-only, not suitable for a paid/tradable economy without authoritative validation.

Each conversion consumes an expected 15 source-tier gems per success, not a guaranteed amount. Chaining from Low alone has expected material costs of 225 Low per High, 3,375 per Supreme and 50,625 per Legendary; direct wood draws of Medium/High provide additional entry points. Upper-tier pacing still requires playtesting.

Manual QA: narrow-screen grid/counts and selected border, both languages, zero-count opening disabled, fewer than three selected gems fusion disabled, all four recipes, Legendary terminal state, cancellation, successful/failed fusion and restart persistence. Actual player resources were not consumed during tests.
