# Lumber Rush

Lumber Rush is a mobile-first forest progression game for Android, built with React Native, Expo, Solana Mobile Wallet Adapter, and a small authoritative game API. This repository is the source for the CLOCK IN Solana Mobile Hackathon entry.

The player holds to chop an ancient tree, sweeps fallen wood into a trolley or drags it to storage, and spends earned resources on tree and axe progression. Quests introduce the mechanics. Mainnet wallet login uses a free message signature to identify a server-saved player. Growth rewards never require an on-chain transaction. Players may optionally publish their first growth milestone as a Mainnet Memo, verified by the server. The app supports English and Korean.

## Play the submitted build

1. Install the Android APK linked in the hackathon submission. It is a standalone build: Metro, a PC server, and `adb reverse` are not needed.
2. Open Lumber Rush and follow the short tutorial. Hold on the tree to chop; release and sweep the dropped wood toward the trolley, or drag it into the storage crate. Tap a loaded trolley to send it to storage.
3. Collect 20 wood to unlock the wallet quest. Connect a compatible Solana Mobile Wallet Adapter wallet to use server-saved progress. Local practice progress is separate and is not imported into the server account.
4. Complete the early growth quests and claim the free First Growth Axe. Equip it to continue. No SOL balance or transaction is required for this reward.
5. Optional: choose the commemorative record below the main quests. Review the real SOL network fee and public Memo notice before signing with a Mainnet wallet. Cancel, lack of SOL or a record-service outage never prevents progression. Recording adds a verified badge and Explorer link, not extra currency or combat advantages.

The current source uses **Mainnet** for wallet authorization and optional records. Older installed previews used Devnet; those receipts are preserved and labelled separately. The game does not sell SOL/SKR items, award real tokens, or operate a ranked airdrop. These changes require server deployment and a new APK before they describe a downloadable build.

## Current source and release status

The current source also includes a shared forest with daily/weekly material quests, contributions to a mine and sapling trail, and a squirrel pet that explores either facility for four hours. Facility levels affect the expedition reward quoted at departure. The world-boss forest records up to 100 attacks per account each week; **boss reward settlement is not implemented**. The sapling farm unlocks at tree level 15: plant, solve a water-path puzzle, grow and collect karma. Spend 4 karma for 20 minutes of double wood and coins from chopping and felling only. Original CC0 music and sound effects have separate volume controls.

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
