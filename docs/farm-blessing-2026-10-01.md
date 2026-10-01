# Farm / forest blessing — 2026-10-01

User-approved: no daily planting cap; plant separately, water through the existing random
waterway puzzle, grow, then transplant. Spend 4 karma for 20 minutes of double wood/coins.

- Two plots retained. Planting costs 100 wood once; a planted seed waits indefinitely for water.
- Waterway must be solved. Growth starts only after confirmed watering, not at planting.
  Before the first harvest growth takes 30 seconds, later 30 minutes; a solution within
  15 seconds retains the existing 10% faster-growth bonus.
- Transplanting grants 1 karma once. Existing growing plots, karma and unfinished old puzzles
  are preserved; old unplanted puzzles charge the old planting cost once when completed.
- Blessing costs 4 karma, lasts 20 real-time minutes including background/offline time;
  no stacking or spending again while active. The server supplies all authoritative times.
- Doubles chopping wood (including bountiful drops) and chopping coins (random coin and
  felled-tree coins). Existing tree upgrade awards XP, not coins; no new coin source is added.
  XP, attack power, boss damage, quest rewards, pet rewards and gem results are unchanged.
- Wood quantity is fixed at hit time, not collection time; collecting or unloading never
  doubles it a second time. Server batches evaluate each hit timestamp at the expiry boundary.
- Settings/UI: farm activation button + existing personal-forest info row countdown;
  no extra floating panel or layout-shifting toast. Plant/water/blessing use audio cues.
- New server commands use strict payload validation, account revision checks, the same
  atomic progress/receipt/audit transaction, and idempotent request replay. No DB reset.

Verification: TypeScript and the complete 231-test suite passed. Tests include more than
three same-day plantings, required watering, old save/puzzle preservation, four-karma spend,
no stacking, exact expiry, wood/coin-only doubling, server request replay/ID reuse rejection,
restart persistence, and no double multiplication at collection. Android production JS export
passed with 831 modules and all 25 audio files; `git diff --check` passed.

No EAS build, public server deployment or actual account reset was performed. Native audio
was already compiled into the updated local dev APK in the previous task; these changes add
no native dependency. New farming interactions and sound quality still need human device QA.
Restart the local API to test new commands; the hosted API and signed Preview APK both need
coordinated updates before testing this flow on a phone. Older clients cannot interpret the
new waiting-for-water plot marker or spent-karma state, so use the updated client after changing
an account's farm state. Do not downgrade that account's app for the test.
