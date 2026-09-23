# Axe mastery and Restoration Axe

Mastery is derived from individual saved axe levels and ownership. No claim button, currency cost or new save field is needed; bonuses remain active with another axe equipped. Values are cumulative totals, not rewards to add together.

| Axe | Level 50 | Level 100 | Level 150 |
| --- | --- | --- | --- |
| Default | damage 1% | 2% | 3% |
| First Record | hit XP 1% | 2% | 3% |
| Pioneer | defeat coins 2% | 5% | 8% + Restoration Axe |
| Deepwood | critical damage 3pp | 6pp | 10pp |

- Damage adds to lumber talent percentage; XP adds to learning and equipped Pioneer bonuses. XP fractional hundredths retain the existing carry mechanism. Entry XP and random coin drops are unaffected.
- Defeat coins (including boss and repeat-tree defeat coins) use floor(base coins × (100 + bonus)/100).
- Level 200 grants no additional mastery in this version.
- Restoration unlocks automatically at owned Pioneer level 150. It is shown locked in the wardrobe before that; tapping shows the requirement. It does not auto-equip.
- Restoration level 1 base damage is fixed 200, with +1 per upgrade through level 200; shared slots and global modifiers still apply.
- While Restoration is equipped, each accepted hit independently has a 30% chance to prevent that hit's fatigue increment. It does not heal fatigue, bypass 100 fatigue, bank rest, alter recovery timestamps on prevented hits, or change wood/XP rewards.
- A sixth RNG draw is used only for this passive. Other axes retain their existing RNG sequence.
- Existing v9 saves and individual axe upgrades are retained. New axe ownership is derived, so it cannot be repeatedly claimed to reset its level.

Manual QA: inspect all four mastery cards at 49/50, 99/100, 149/150 on disposable test data; switch axes and verify bonuses remain. Test the locked Restoration card, Pioneer 150 unlock, independent upgrades, fixed base damage, fatigue prevention and reloading. Do not change real user saves to run these checks.
