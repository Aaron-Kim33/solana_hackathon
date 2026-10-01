# Submission candidate preflight — 2026-10-01

Status: local source checks passed; **not a final APK or real-device sign-off**.
Base HEAD at inspection: `e11c22e`. The working tree includes uncommitted gameplay/art changes; freeze and record the intended release commit before deployment/build. Do not discard existing saves or replace an installed app to solve signing conflicts.

## Verified this pass

- Full automated suite: 217 tests passed, zero failed/skipped, including shared drop-lifetime checks. Temporary databases/accounts only; existing local/server player saves were not edited.
- TypeScript: `npx tsc --noEmit` passed.
- Lockfile: `npm ci --dry-run --ignore-scripts --offline --no-audit --no-fund` passed. This checks consistency, not a clean remote installation or vulnerability audit.
- Live read-only preflight: public Railway `/health` and wallet identity PNG responded correctly. This does not prove the hosted API contains this working-tree revision or that backup restoration works.
- Release source guards: test rest, resource grants and wallet-quest skip require development mode and local/offline play. The rest button previously appeared during connected development play; both its display and handler now also require offline play.
- Public command parser rejects test rest/grants/admin/wallet-skip command types and an injected `admin` field.
- Local-admin regression: preview mode ignores the local fatigue exemption, keeps the account's test provenance, and rejects operator grants. Test progress is excluded from ranking eligibility. No HTTP admin grant route exists.
- Git candidate filename scan found no credentials, environment secrets, wallet keypairs, signing keys or runtime databases (the public `.env.example` is allowed). Nested exclusion patterns passed regression checks. This is not a full historical secret audit.
- Android production JS export with preview HTTPS inputs passed (792 modules, 12 assets, including all four trolley stages). Output: `C:\Users\User\AppData\Local\Temp\lumber-rc-2026-10-01`. A JS export does not prove signing, installation, native wallet handoff, release performance or absence of debug buttons on an actual APK. Existing Solana dependency export-resolution warnings remain; they did not fail the bundle.

## Source feature boundaries

- Shared forest: quest materials, cross-account facility contributions and contributor/amount gates. Wallet accounts are not verified unique humans or verified Seeker owners.
- Squirrel: one-time quest reward; one four-hour expedition at a time; reward quote fixed at departure; return reward claimed once. No automatic repeat dispatch.
- Farm: tree Lv.15 unlock, 100 wood per planting, two plots, three plantings/day (UTC), water-path puzzle; first growth 30 seconds, later growth 30 minutes, quick solution reduces growth time by 10%. Karma accumulates only.
- World boss: up to 100 attacks/account/week, damage aggregation; **no reward settlement**.
- Real purchases, ranked token rewards and automatic airdrops are not enabled. Server talents remain unavailable.

## Next release gates, in order

1. Review/freeze all intended source/assets and record a commit. Do not stage secrets, databases, ignored backups or local Android signing artifacts.
2. Back up the hosted persistent SQLite database using a WAL-safe procedure; deploy the approved source; verify migration/startup and existing account progress without resetting it. Confirm one service replica. Restore rehearsal uses an isolated copy, never overwrites live data.
3. Build a signed preview APK from the same source with public HTTPS settings. Record EAS build ID, commit, APK SHA-256 and accessible download link. Check monthly build availability without guessing from an old reset message.
4. Install/update on a real Android device with Metro stopped and no adb reverse. Check English default/Korean layouts, first tutorial, fatigue stop, storage/trolley, upgrades, unlocked map, farm and pet. Verify no development rest/grant/skip UI. Measure extended play and background/foreground behavior.
5. Use two normal test accounts to verify community contribution totals/level gates and pet reward quote. Verify real four-hour return/claim; no time modification or local-admin account for release evidence.
6. Real MWA wallet: cancel, deny, insufficient Devnet SOL, finalized First Record, one-time claim, disconnect/relogin/relaunch. Network failures/retries must not duplicate rewards or silently lose progress.
7. Complete privacy/support/asset rights review; update source/deployed version labels. Record video and pitch only for verified features; label progressed accounts and cuts.
8. Confirm registration/eligibility/exact portal deadline and signed-out access to APK/source/video/pitch before final submission. Internal target remains October 7.

No Railway deployment, EAS build, real purchase, DNS change or account reset was performed during this preflight.
