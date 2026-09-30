# CLOCK IN submission kit (draft — verify against the final APK)

This is preparation, not a claim that the current source has passed real-device QA. Do not submit a video of Metro, a debug-signed local build, or simulated wallet success as the final demo.

## One-sentence pitch

Lumber Rush turns a simple mobile chopping game into a tactile decision loop: hold to strike, pause to sweep expiring wood into a trolley, grow your forest, and connect a Solana wallet to preserve progress and sign a verifiable first record on Devnet.

## What judges can actually try

1. Install the signed Android APK; open it without a PC, Metro, or `adb reverse`.
2. Use English by default, with Korean available in the menu.
3. Hold the tree to chop, drag a dropped log to storage, sweep several logs into the trolley, then dispatch the trolley to storage. Verify that wood arrives once, after the trolley reaches the crate.
4. Upgrade the tree and equipped axe, view the character and quest panels, and watch the first-harvest progress.
5. After 20 collected wood, connect a compatible MWA wallet. Explain that local practice is separate from the server account.
6. Complete the Devnet First Record only when the account is eligible and the wallet has sufficient Devnet SOL. Show the wallet approval, on-chain transaction link, one-time reward, and persistence after restarting the app.

Do not describe planned SOL/SKR purchases, pets, rankings, airdrops, or mainnet token rewards as working features. Do not claim every chop is on-chain; that would be incorrect and a poor mobile experience.

## Three-minute demo video outline

| Time | Actual footage / narration |
| --- | --- |
| 0:00–0:20 | Name, one-sentence hook, Android app opening with no development overlay. |
| 0:20–0:55 | Hold-to-chop animation; release and sweep logs; show 5-second urgency and direct storage alternative. |
| 0:55–1:20 | Dispatch trolley, keep playing during its three-second outward trip, receive stored wood only on arrival. |
| 1:20–1:50 | Quest, forest/axe progression, fatigue and reason to return. Use a real account, not an invented ranking. |
| 1:50–2:35 | Wallet login and a real finalized Devnet First Record, or clearly label a cut to a previously prepared eligible account. Show one-time reward and re-opened server state. |
| 2:35–3:00 | Why mobile/Solana, bilingual support, current limits and next release milestone. |

If wallet approval takes longer than expected, record the real sequence in separate takes and disclose any cut. Never splice a different account into a continuous-looking transaction flow without labeling it.

## Five-slide pitch outline

1. **Hook:** Chopping is easy; deciding when to stop and secure a five-second drop is the game.
2. **Mobile play:** One-finger hold, sweep and trolley; short sessions; tactile progression and quests.
3. **Solana use today:** MWA wallet sign-in, server-saved identity, explicit verified Devnet First Record and one-time reward. Ordinary combat stays off-chain.
4. **Why return:** Forest, axe, character and gem progression, fatigue cadence, bilingual onboarding. Show real footage and no unmeasured retention numbers.
5. **Current build / roadmap:** Working APK and source links after verification. Fair competition, pets, optional purchases and SKR are future work, not current features.

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
