# Lumber Rush

Lumber Rush is a mobile-first forest progression game for Android, built with React Native, Expo, Solana Mobile Wallet Adapter, and a small authoritative game API. This repository is the source for the CLOCK IN Solana Mobile Hackathon entry.

The player holds to chop an ancient tree, sweeps fallen wood into a trolley or drags it to storage, and spends earned resources on tree and axe progression. Quests introduce the mechanics. Mainnet wallet login uses a free message signature to identify a server-saved player. Growth rewards never require an on-chain transaction. Players may optionally publish their first growth milestone as a Mainnet Memo, verified by the server. The app supports English and Korean.

## Play the submitted build

1. Install the Android APK linked in the hackathon submission. It is a standalone build: Metro, a PC server, and `adb reverse` are not needed.
2. Open Lumber Rush and follow the short tutorial. Hold on the tree to chop; release and sweep the dropped wood toward the trolley, or drag it into the storage crate. Tap a loaded trolley to send it to storage.
3. Collect 20 wood to unlock the wallet quest. Connect a compatible Solana Mobile Wallet Adapter wallet to use server-saved progress. Local practice progress is separate and is not imported into the server account.
4. Complete the early growth quests and claim the free First Growth Axe. Equip it to continue. No SOL balance or transaction is required for this reward.
5. Optional: choose the commemorative record below the main quests. Review the real SOL network fee and public Memo notice before signing with a Mainnet wallet. Cancel, lack of SOL or a record-service outage never prevents progression. Recording adds a verified badge and Explorer link, not extra currency or combat advantages.

The October 3 preview uses **Mainnet** for wallet authorization and optional records. Older previews used Devnet; those receipts are preserved and labelled separately. The game does not sell SOL/SKR items, award real tokens, or operate a ranked airdrop. Optional real Mainnet transaction QA is separate from successful gameplay testing.

## Current source and release status

The released October 3 preview includes a shared forest with daily/weekly material quests,
contributions to a mine and sapling trail, and a squirrel pet that explores either facility
for four hours. Facility levels affect the expedition reward quoted at departure.

The world-boss forest records up to 100 attacks per account each week. Once-per-stage
personal rewards: 20 attacks grant one low-tier gem, 50 grant first-attack tree level × 20
coins, and 100 grant one fatigue potion. Community damage goals initially start at
10,000/20,000/30,000, granting an additional 1 low-tier gem / 2 low-tier gems / 1 medium-tier
gem to everyone with at least 20 weekly attacks. Goals adapt within ±25% each week and
stay fixed during that week. Earned unclaimed rewards persist across weeks. These are
in-game rewards, not on-chain payouts or damage-ranked prizes.

The sapling farm unlocks at tree level 15: plant, solve a water-path puzzle, grow and collect
karma. Spend 4 karma for 20 minutes of double wood and coins from chopping and felling
only. Third-party CC0 music and sound effects have separate volume controls.

The October 3 server and signed Preview APK were released from commit `637060aa8d5d9a8e75fab246622d4fcf4b5f7e1d`. The maintainer reported successful phone gameplay checks on October 5; this is not a penetration-test certificate or proof of every optional blockchain flow. See [release evidence](docs/release-2026-10-03.md). Subsequent security edits require a new deployment/APK and must not be described as already included. Demo accounts with prior progression must be identified; ordinary chopping and community activity are server-managed, not on-chain transactions.

The current [Preview APK](https://expo.dev/artifacts/eas/36aJjxCCqCyx_y_YYwS8IMOapKN0Ua6kJBE8dkAj_ug.apk) has an EAS expiration date of October 17. A durable final-submission download URL is still pending; do not rely on this temporary link for the full judging period.

## Architecture

October 5 local source adds weekly contribution rankings inside the community forest
and world-boss forest (not the map): top 10 and your own rank, with shared ranks for ties.
Forest scores combine materials donated to both facilities; boss scores use server-recorded
damage. Only wallet-linked server-origin accounts qualify; local test admins are excluded.
Labels are stable pseudonyms, not wallet addresses. Rankings award no extra prizes and
reset Monday 00:00 UTC without deleting history. This requires a server update and new
APK; it is **not included in the October 3 download above**.

- `App.tsx` and `src/`: Expo/React Native game UI, local practice, Solana wallet and server client code.
- `server/`: Node 24 HTTP API, game rules and persistent SQLite store. Server-confirmed data is authoritative for connected accounts.
- `scripts/`: preview preflight and identity-site build checks.
- `identity-site/`: static wallet identity page served at `https://lumber.mellowcat.xyz`.

The hosted preview API is `https://solanahackathon-production-aeb1.up.railway.app`; its health endpoint is `/health`. The API uses a persistent Railway volume. Wallet identity is a separate HTTPS site. Source files contain no production wallet private key or player database.

## Develop and verify

Use Node 24, Java 17, Android SDK and an Android emulator or device. Solana Mobile's setup checker is `npx solana-mobile@latest doctor`.

```powershell
npm ci
npx expo run:android
node --experimental-strip-types --test src/*.test.mjs src/game/*.test.mjs src/solana/*.test.mjs src/shared/*.test.mjs server/*.test.mjs scripts/*.test.mjs
npx tsc --noEmit
```

The production API and EAS environment URLs must be configured by the maintainer; do not put secrets in `EXPO_PUBLIC_*`. See [preview setup](docs/external-preview.md), [delivery status](docs/CLOCK-IN-DELIVERY.md), and [server details](server/README.md). Some historical notes in those documents describe earlier pre-deployment states; the submission APK and current `/health` response are the source of truth for the deployed version.

## Build profiles

`eas.json` defines `preview` (`com.lumberrush.seeker.preview`) for internal APK testing and `dapp-store` (`com.lumberrush.seeker`) for a store-signed APK. EAS provides the signing credentials. A locally generated Android `assembleRelease` build may use a debug key and must not be submitted as the store build. Before building, run `node --experimental-strip-types scripts/check-preview.mjs --live`, verify the EAS environment values, and test the resulting APK on Android without Metro.

## Limits and safety

Connected progress depends on the hosted API and its database. Local practice and connected accounts are intentionally separate. Solana transactions are only used for explicit record steps, not every chop. Public rankings, paid items, automatic airdrops, and pet automation are not enabled. Support/privacy/deletion requests: **hi.mellowcat@gmail.com**. See [privacy and support](docs/privacy.md) and [audio provenance](assets/audio/README.md). A backup restoration exercise and edge-level attack protection are not yet verified.
