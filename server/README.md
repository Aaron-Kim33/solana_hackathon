# Lumber Rush game API

Status as of 2026-09-30: the single-replica Node 24 API is deployed in Railway preview mode with a persistent SQLite volume and a public HTTPS endpoint. The Android app can authenticate through a Solana Mobile Wallet Adapter wallet and load server-saved progress. This is a **Devnet hackathon preview**, not a production payment, ranking, or airdrop service.

## Purpose and trust boundary

The app sends player intent. The server checks the wallet-linked session, expected state revision, rate limits, action timing, tree/axe/fatigue rules, drop IDs and five-second expiry, then commits the resulting state. A client cannot submit its own final wood balance, damage, random gem result or score. Successful commands, request receipts and economy audits are stored together in SQLite transactions. Repeating a request ID cannot grant the same successful reward twice; a stale revision is rejected. Local practice saves are separate and are never imported into a connected account.

Normal chopping and collection do **not** create Solana transactions. The explicit First Record quest prepares a unique record, asks the player's wallet to sign a Devnet transaction, checks its network result, then unlocks a one-time reward. Do not describe this record as an NFT, real token, anti-bot proof or ranked score.

## API surface

- `GET /health`: preview mode, wallet identity origin and supported client capabilities.
- `POST /auth/challenge`, `POST /auth/login`, `POST /auth/logout`: short-lived sign-message challenge, signature verification and session lifecycle.
- `GET /me`, `POST /commands`: authenticated snapshot and game commands, including attacks, ground-drop collection, trolley loading/dispatch/recovery, progression, quests and gems.
- `GET /record`, `POST /record/prepare`, `POST /record/submit`, `POST /record/check`: First Record state and explicit Devnet verification.

The server accepts JSON bodies up to 4 KiB on its defined POST routes. An authenticated request uses a bearer session token, not a wallet private key. Sessions are stored as token hashes, expire, and can be revoked. Authentication proves control of a wallet address; it does **not** prove one human or prevent all automation.

## Run locally

```powershell
node --experimental-strip-types server/start.mjs
```

The default launcher binds `127.0.0.1:8787` and uses an ignored local SQLite file. It is for development only. `node:sqlite` in Node 24 currently emits an experimental warning.

Preview hosting explicitly requires `LUMBER_SERVER_MODE=preview`, `LUMBER_ALLOW_PUBLIC_BIND=true`, `LUMBER_DB_PATH`, `LUMBER_IDENTITY_ORIGIN` and an HTTPS reverse proxy. Railway supplies `PORT` and its volume location. Startup rejects a missing Railway volume or a DB path outside that volume. Keep one replica while using this SQLite design. See [external preview setup](../docs/external-preview.md) for deployment history and [current delivery status](../docs/CLOCK-IN-DELIVERY.md) for verification gaps.

## Verify

```powershell
node --experimental-strip-types --test server/*.test.mjs
npx tsc --noEmit
```

Tests cover command idempotency, revisions, transaction rollback, challenge replay, independent accounts, First Record failure paths, trolley recovery, gems and authenticated HTTP journeys using disposable databases. They are not a substitute for actual wallet/device tests, a database restore drill, edge-level abuse controls or production security review. The hosted preview has no payment verifier, public ranking, real reward payout or automatic airdrop. Do not use its records for financial rewards.
