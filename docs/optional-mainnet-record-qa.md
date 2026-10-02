# Optional Mainnet growth record — 2026-10-01

## Approved behavior

- Wallet login uses Mainnet authorization and a nonce-bound message signature: no transaction or SOL fee.
- Complete first growth prerequisites, claim the axe once and equip it. No chain receipt is required.
- The record is a separate optional card below the main quests. A real SOL fee is quoted before signing a public Memo; this is not a purchase or NFT mint.
- Cancel, no SOL, RPC outage and failed records never remove growth rewards or lock later quests.
- `/milestone` verifies finalized Mainnet signer, signature and unique Memo. `/record` remains legacy Devnet. Separate tables and receipt fields preserve both.
- The record adds a verified badge and Explorer link only. Gameplay and community activity remain server-managed, not entirely on-chain.
- Preparing an intent costs no game currency. Submitted signatures are persisted locally before HTTP registration. Recovery never broadcasts a new transaction.
- Schema 7 adds a table without deleting saves. Older server binaries cannot open schema 7; a rollback needs compatible migration planning.

## Verified locally

- 237 tests passed: authenticated HTTP journeys for both networks with mocked chain evidence, free rewards without receipts, replay protection, rollback, restart and legacy preservation.
- TypeScript passed. Android export passed: 831 modules, 37 assets. An export is not a signed APK or real-wallet validation.
- No actual Mainnet transaction, paid action, deployment or new EAS request was performed for this change.

## Submission gates still required

1. Deploy the compatible server before distributing a new APK. Existing hosted versions do not receive source edits automatically.
2. Seeker/Mainnet wallet: free login with no SOL, free axe, equip, next quest, restart and restore. Do not reset an existing account for this test.
3. Cancel fee review and reject wallet signing: unchanged resources and normal progression.
4. Only after explicit approval to spend the displayed fee: sign one real Mainnet Memo, verify server result and Explorer, restart and check without resending.
5. Simulate network failure and restore: no duplicate broadcast.
6. Review Korean/English screens and wallet network/domain warnings. The app cannot suppress wallet-controlled safety warnings.
7. Match the submission README/video to the actual APK. A Memo alone does not guarantee hackathon eligibility or innovation scores.
