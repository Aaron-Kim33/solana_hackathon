# CLOCK IN submission kit (draft — verify against the final APK)

October 5 follow-up: the latest preparation checklist is `submission-final-checklist-2026-10-05.md`.
Use `demo-script-2026-10-05.md` for the current shot list, including weekly forest/boss rankings.
The user supplied the accepted deck formats: submit a Google Drive PDF under 20 MB and
40 pages, no password, Anyone with the link can view, downloading allowed. PPTX is an
editable working copy and needs conversion. October 5 rankings/security still need release
and final phone QA. Do not describe the October 3 APK as already containing them.

This is preparation, not a claim that the current source has passed real-device QA. Do not submit a video of Metro, a debug-signed local build, or simulated wallet success as the final demo.

## One-sentence pitch

Lumber Rush is a cozy mobile forest game where your harvest helps grow a shared forest, improving everyone's squirrel expeditions; free MWA wallet sign-in preserves your server progress, with an optional Mainnet growth milestone.

This pitch describes current source capabilities. Verify the shared-facility/expedition loop in the final hosted build before presenting it as demonstrated functionality. Community progress is server-managed, not an on-chain vote or proof of unique humans.

## What judges can actually try

1. Install the signed Android APK; open it without a PC, Metro, or `adb reverse`.
2. Use English by default, with Korean available in the menu.
3. Hold the tree to chop, drag a dropped log to storage, sweep several logs into the trolley, then dispatch the trolley to storage. Verify that wood arrives once, after the trolley reaches the crate.
4. Upgrade the tree and equipped axe, view the character and quest panels, and watch the first-harvest progress.
5. After 20 collected wood, connect a compatible MWA wallet. Explain that local practice is separate from the server account.
6. Complete the first growth quests, claim the free commemorative axe and equip it. No transaction or SOL is needed for growth rewards. Restart and verify restored server progress. Optional: open the separate Mainnet record card below the main quests, review the real SOL fee and public Memo notice, and sign only with explicit consent. Show the verified Explorer link only after an actual finalized record. Cancelling or having no SOL must not block the game.
7. On a clearly labeled progressed account, open the map and shared forest. Claim quest materials, contribute to a facility, and show the updated shared totals from another account. Claim the squirrel once and dispatch it to the mine or sapling trail; the quoted reward depends on tree/facility levels at departure.
8. If verified in the final APK, show planting a sapling, watering via the water-path puzzle, growth and transplanting. Current source removes the daily cap and allows spending 4 karma for a 20-minute double chopping wood/coin blessing; verify the hosted server and signed APK before presenting this as released. Quest/pet rewards are not doubled. The world-boss scene records weekly attacks/damage; personal and shared rewards require the compatible server/client release and device QA. Personal-forest news links to a returned squirrel, a grown sapling or an earned boss reward, one ready item at a time.

Current source adds personal boss rewards at 20/50/100 weekly attacks (low-tier gem / first-attack tree level × 20 coins / fatigue potion), with once-only server claims and persistent earned rewards. Community damage goals initially start at 10,000/20,000/30,000, granting an additional 1 low-tier gem / 2 low-tier gems / 1 medium-tier gem to everyone with at least 20 weekly attacks. Goals adapt within ±25% each week and stay fixed during the week. These are in-game rewards, not token payouts or individual damage-ranked prizes. Server/client deployment and final device QA are required before showing these as released.

Do not describe planned SOL/SKR purchases, ranked rewards, airdrops, automatic pet trips or mainnet token rewards as working features. Do not claim every chop is on-chain; that would be incorrect and a poor mobile experience.

## Three-minute demo video outline

| Time | Actual footage / narration |
| --- | --- |
| 0:00–0:15 | Open the standalone Android app. Hook: “Your harvest grows a forest we share.” |
| 0:15–0:45 | Hold, sweep and dispatch trolley; receive wood on arrival. Show one upgrade and the clear next goal. |
| 0:45–1:10 | Real MWA message-signature login, free growth reward and restored server progress. No SOL transaction is required. Label any cut to an eligible account. |
| 1:10–2:00 | Label a progressed account; map → shared forest → quest materials → facility contribution → life-tree response and increased expedition reward quote. Use actual cross-account footage only if available; otherwise show confirmed shared totals without claiming a second player. |
| 2:00–2:25 | Real returned squirrel → one-time reward collection; a short planting/water-path shot shows restoring the forest. Label footage recorded at a later time; never change server time. |
| 2:25–2:45 | Show a real optional Mainnet milestone fee review, consent and finalized Explorer link only if device QA and spending approval are complete. Otherwise show the optional card without signing and honestly state that this transaction has not been demonstrated. Keep normal growth visibly independent of recording. |
| 2:45–3:00 | Why mobile/Solana: one-finger play, MWA wallet identity and optional verifiable milestones. Ordinary play/shared facilities are server-managed; no unique-human or Seeker-ownership proof is claimed. |

If wallet approval takes longer than expected, record the real sequence in separate takes and disclose any cut. Never splice a different account into a continuous-looking transaction flow without labeling it.

## Five-slide pitch outline

1. **Hook:** Chopping is easy; deciding when to stop and secure a five-second drop is the game.
2. **Mobile play:** One-finger hold, sweep and trolley; short sessions; tactile progression and quests.
3. **Solana use today:** Free MWA wallet message-signature sign-in, server-saved identity and an optional verified Mainnet Memo milestone with explicit fee consent. Growth rewards remain free. Ordinary combat stays off-chain. Mark any unverified real-wallet flow as pending rather than demonstrated.
4. **Why return / differentiation:** Personal harvesting → limited quest materials → weekly community facilities → improved squirrel expeditions. Show actual cross-account state and no unmeasured retention numbers; this is not Seeker ownership verification.
5. **Current build / roadmap:** Verified APK/source links, planting and weekly boss participation. Personal and community boss rewards are in current source but require release QA. Fair ranked rewards, paid purchases and SKR remain future work.

## Submission gate

- [ ] Confirm participant registration, eligibility, and the exact deadline time in the official portal.
- [ ] EAS preview APK built from the intended final commit; record build ID, commit SHA, SHA-256 and download link.
- [ ] Install on Android without Metro/adb reverse; verify English and Korean layouts, chopping, storage, trolley, upgrades, quests and relaunch.
- [ ] Connect a real compatible wallet; check cancel/deny/offline flows and persisted server state.
- [ ] Verify free growth reward → equip → next quest → relaunch without any on-chain record; no duplicate reward.
- [ ] Verify optional Mainnet fee review, cancellation/no-SOL handling and non-blocking progression. With explicit fee approval, verify one finalized record and Explorer link, then restart/recover without broadcasting again. If this gate is incomplete, do not claim a demonstrated Mainnet transaction.
- [ ] Confirm debug-only rest, grants and quest-skip controls are absent in the release APK.
- [ ] Confirm Railway API health, persistent volume, backup/export procedure and a working identity icon.
- [ ] Review GitHub access, tracked secrets, asset ownership, privacy/support contact, README accuracy and APK download permission.
- [ ] Record actual 3-minute Android footage and export the pitch deck or short presentation.
- [ ] Enter all four required materials in the official submission and open each link from a signed-out browser before finalizing.

Official requirements: [Solana Mobile CLOCK IN announcement](https://solanamobile.com/blog/clock-in-the-solana-mobile-hackathon) and [event terms](https://solanamobile.radiant.nexus/legal/clock-in-terms.pdf). Internal target: submit by October 7; do not rely on an unconfirmed October 8 time zone.
