# Lumber Rush

Lumber Rush is a mobile-first forest progression game for Android, built with React Native, Expo, Solana Mobile Wallet Adapter, and a small authoritative game API. This repository is the source for the CLOCK IN Solana Mobile Hackathon entry.

The player holds to chop an ancient tree, sweeps fallen wood into a trolley or drags it to storage, and spends earned resources on tree and axe progression. Quests introduce the mechanics. A connected Devnet wallet identifies a server-saved player and can sign the First Record transaction; the server verifies that record before granting its one-time reward. The app supports English and Korean.

## Play the submitted build

1. Install the Android APK linked in the hackathon submission. It is a standalone build: Metro, a PC server, and `adb reverse` are not needed.
2. Open Lumber Rush and follow the short tutorial. Hold on the tree to chop; release and sweep the dropped wood toward the trolley, or drag it into the storage crate. Tap a loaded trolley to send it to storage.
3. Collect 20 wood to unlock the wallet quest. Connect a compatible Solana Mobile Wallet Adapter wallet to use server-saved progress. Local practice progress is separate and is not imported into the server account.
4. Continue the quest chain to the Devnet First Record. The wallet asks for a transaction signature at that step; ordinary chopping does not require a blockchain approval. The server verifies the finalized record and grants the reward once.

The preview uses Solana **Devnet**. It does not sell SOL/SKR items, award real tokens, or operate a ranked airdrop. Paid purchases and ranked rewards remain future work.

## Current source and release status

The current source also includes a shared forest with daily/weekly material quests, contributions to a mine and sapling trail, and a squirrel pet that explores either facility for four hours. Facility levels affect the expedition reward quoted at departure. The world-boss forest records up to 100 attacks per account each week; **boss reward settlement is not implemented**. A small sapling farm unlocks at tree level 15, with a randomized water-path puzzle and accumulated karma; karma has no spending/reward system yet.

These are source-level features, not proof that the downloadable APK or hosted API contains the same version. See [release candidate checks](docs/release-candidate-2026-10-01.md) for verified checks and remaining real-device gates. Demo accounts with prior progression must be identified; ordinary chopping and community activity are server-managed, not on-chain transactions.

## Architecture

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

Connected progress depends on the hosted API and its database. Local practice and connected accounts are intentionally separate. Solana transactions are only used for explicit record steps, not every chop. Public rankings, paid items, automatic airdrops, and pet automation are not enabled. Report issues through the contact information in the hackathon submission.
