# CLOCK IN submission kit (draft — verify against the final APK)

This is preparation, not a claim that the current source has passed real-device QA. Do not submit a video of Metro, a debug-signed local build, or simulated wallet success as the final demo.

## One-sentence pitch

Lumber Rush is a cozy mobile forest game where one-finger harvesting fuels personal growth and weekly community facilities, whose levels improve squirrel expeditions; MWA wallet identity preserves server progress and a verified Devnet First Record marks the player's first milestone.

This pitch describes current source capabilities. Verify the shared-facility/expedition loop in the final hosted build before presenting it as demonstrated functionality. Community progress is server-managed, not an on-chain vote or proof of unique humans.

## What judges can actually try

1. Install the signed Android APK; open it without a PC, Metro, or `adb reverse`.
2. Use English by default, with Korean available in the menu.
3. Hold the tree to chop, drag a dropped log to storage, sweep several logs into the trolley, then dispatch the trolley to storage. Verify that wood arrives once, after the trolley reaches the crate.
4. Upgrade the tree and equipped axe, view the character and quest panels, and watch the first-harvest progress.
5. After 20 collected wood, connect a compatible MWA wallet. Explain that local practice is separate from the server account.
6. Complete the Devnet First Record only when the account is eligible and the wallet has sufficient Devnet SOL. Show the wallet approval, on-chain transaction link, one-time reward, and persistence after restarting the app.
7. On a clearly labeled progressed account, open the map and shared forest. Claim quest materials, contribute to a facility, and show the updated shared totals from another account. Claim the squirrel once and dispatch it to the mine or sapling trail; the quoted reward depends on tree/facility levels at departure.
8. If verified in the final APK, briefly show the sapling farm and water-path puzzle. Karma currently accumulates but has no spending system. The world-boss scene records weekly attacks/damage but does not distribute rewards.

Do not describe planned SOL/SKR purchases, ranked rewards, boss settlement, airdrops, automatic pet trips or mainnet token rewards as working features. Do not claim every chop is on-chain; that would be incorrect and a poor mobile experience.

## Three-minute demo video outline

| Time | Actual footage / narration |
| --- | --- |
| 0:00–0:15 | Name, shared-forest hook, standalone Android app opening. |
| 0:15–0:50 | Hold, sweep and dispatch trolley; receive wood on arrival. Show upgrades and short onboarding. |
| 0:50–1:35 | Real wallet login and finalized Devnet First Record; one-time reward and restored server state. Label any cut to an eligible account. |
| 1:35–2:25 | Label a progressed account; quest materials → facility contributions visible from two accounts → improved squirrel reward quote. |
| 2:25–2:45 | Real pet return/one-time collection footage from a completed trip; optionally a brief planting puzzle. Never fast-forward server time on the submitted API. |
| 2:45–3:00 | Why mobile/Solana, current limits and next milestone. |

If wallet approval takes longer than expected, record the real sequence in separate takes and disclose any cut. Never splice a different account into a continuous-looking transaction flow without labeling it.

## Five-slide pitch outline

1. **Hook:** Chopping is easy; deciding when to stop and secure a five-second drop is the game.
2. **Mobile play:** One-finger hold, sweep and trolley; short sessions; tactile progression and quests.
3. **Solana use today:** MWA wallet sign-in, server-saved identity, explicit verified Devnet First Record and one-time reward. Ordinary combat stays off-chain.
4. **Why return / differentiation:** Personal harvesting → limited quest materials → weekly community facilities → improved squirrel expeditions. Show actual cross-account state and no unmeasured retention numbers; this is not Seeker ownership verification.
5. **Current build / roadmap:** Verified APK/source links, planting prototype and weekly boss participation. Boss settlement, fair ranked rewards, paid purchases and SKR remain future work.

## Submission gate

- [ ] Confirm participant registration, eligibility, and the exact deadline time in the official portal.
- [ ] EAS preview APK built from the intended final commit; record build ID, commit SHA, SHA-256 and download link.
- [ ] Install on Android without Metro/adb reverse; verify English and Korean layouts, chopping, storage, trolley, upgrades, quests and relaunch.
- [ ] Connect a real compatible wallet; check cancel/deny/offline flows and persisted server state.
- [ ] Verify one complete First Record path and its on-chain explorer link; no duplicate reward after relaunch.
- [ ] Confirm debug-only rest, grants and quest-skip controls are absent in the release APK.
- [ ] Confirm Railway API health, persistent volume, backup/export procedure and a working identity icon.
- [ ] Review GitHub access, tracked secrets, asset ownership, privacy/support contact, README accuracy and APK download permission.
- [ ] Record actual 3-minute Android footage and export the pitch deck or short presentation.
- [ ] Enter all four required materials in the official submission and open each link from a signed-out browser before finalizing.

Official requirements: [Solana Mobile CLOCK IN announcement](https://solanamobile.com/blog/clock-in-the-solana-mobile-hackathon) and [event terms](https://solanamobile.radiant.nexus/legal/clock-in-terms.pdf). Internal target: submit by October 7; do not rely on an unconfirmed October 8 time zone.
