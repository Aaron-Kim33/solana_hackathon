# Milestone bosses

- First arrival at level 50: Root Guardian, 15,000 HP, unlocks daily auto pickup on defeat.
- First arrival at level 100: Twisted Forest Guardian, 60,000 HP, awards one High Gem on defeat. Normal wood-cost upgrade enters level 101 / second forest.
- No timer, loss reset, or separate combat currency. Every hit saves remaining HP. Existing fatigue/recovery rules apply.
- Defeat flags and reward save atomically with the finishing hit. Repeated trees at these levels have normal HP and no boss reward.
- Existing saves without boss metadata grandfather already reached milestones (including current level 50 or 100). No retroactive boss rewards, HP reset, trial reset, or forced replay.
- Boss art is a code-drawn placeholder: changed canopy/trunk palette and glowing eyes; a dedicated health bar color/name/hint identifies the encounter.
- Existing level-100 adventure quest reward remains separate from the boss reward.
- Regular level 101+ HP, wood costs, and XP curves are unchanged in this iteration. The second forest currently uses the existing palette progression with a region label, not a complete new biome.

## Synthetic sensitivity check

Run `node --experimental-strip-types src/game/simulate-bosses.mjs`. Five seeds, no test gems/slots; first-record axe at 50, Pioneer at 100, permanent +1. Reset fatigue only in simulation to measure hits, not days. These are explicit hypothetical builds, not proven player distributions.

| Boss | Build: axe / character / lumber rank | Hits |
| --- | --- | --- |
| 50 low | 40 / 8 / 0 | 342–343 |
| 50 baseline | 70 / 10 / 6 | 156–157 |
| 50 high | 100 / 12 / 12 | 90–91 |
| 100 low | 25 / 12 / 5 | 382–384 |
| 100 baseline | 60 / 15 / 10 | 249–250 |
| 100 high | 140 / 20 / 20 | 124–125 |

Baseline generated wood: about 11k / 44k, before missed manual pickups. Bosses therefore do not solve excess wood by themselves. Validate actual progression/wood sinks and weak-build difficulty before release; do not increase HP solely to counter auto pickup.

Manual QA: enter 50 and 100 on a disposable test save, verify visual distinction, close/reopen mid-fight, defeat/reward/auto-pickup unlock, regrow without repeated rewards, and enter 101. Never reset real player data for this test.
