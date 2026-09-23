# Server migration — phase 2: durable local database

Status: contracts, reference logic, file-backed SQLite, signature authentication and a loopback-only HTTP API are implemented. A development-only mobile login test panel is connected in code; actual device signing remains unverified. No RPC payment verifier, live ranking or public deployment exists yet. Gameplay STILL uses local saves. Do not use current records for financial rewards. See LOCAL-TEST.md for startup and limitations.

## Signature authentication foundation

`auth-service.mjs` uses a server-generated, five-minute, single-use message challenge bound to the wallet and configured HTTPS origin. Ed25519 verification uses Node crypto; this is a custom sign-message flow, NOT an implemented SIWS/MWA client integration. Initialize `openGameStore` before opening authentication on the same DB. The configured origin is mandatory, not supplied by the login caller.

Successful verification atomically creates/looks up a wallet-linked fresh player, consumes the challenge and stores a SHA-256 hash of a cryptographically random session token. Sessions expire after 24 hours, survive restart and can be revoked by logout. A failed response after commit requires a new challenge; a consumed signature cannot mint another session. Existing device saves are never imported. Wallet ownership alone does not prove one human or fair gameplay.

`authenticatedGame` resolves player identity from the session before loading or executing commands. Tokens must not appear in URLs, logs or ordinary device save files. No seed phrase, private key or actual wallet was accessed; tests generate ephemeral keypairs.

Before network exposure: HTTP body/schema/size checks, per-IP and per-wallet rate limits, bounded challenge storage/expiry cleanup, TLS, safe error mapping, protected client token storage, signature-cancellation UX, key/wallet-switch policy, schema migration/versioning for auth tables, security review and real-wallet tests. No public listener exists yet. Current code is not a claim of production readiness.

## September 15 persistence milestone

`sqlite-store.mjs` runs on the server host, never inside the Expo bundle. Uses Node 24.14 built-in SQLite (currently emits an experimental warning) with WAL, FULL synchronous mode and explicit immediate transactions. No dependency install or cloud account required. This is a single-host prototype, not a horizontally scaled production database.

- Player state, successful command receipt and before/after economy audit are committed together. A failure rolls all three back.
- Unique player/request keys survive process restarts and prevent a repeated successful command from spending again. Two connections using the same old revision cannot both commit different commands.
- Fresh player initialization cannot overwrite existing accounts. No mobile-save import or test-grant endpoint exists. Test fixtures are explicitly local-test and stay excluded from ranked data.
- Server RNG uses Node crypto by default; deterministic RNG injection is for tests only.
- Tests cover reopen/retry, independent connections with stale revisions, account isolation, ledger failure rollback, malformed requests and duplicate player creation. These are not yet parallel-process stress tests, abrupt process-kill tests, disk/power-loss tests or backup/restore verification.
- DB files are ignored by Git. Local OS access can still modify the database; audits are not cryptographically tamper-proof. Deploy only with authenticated routes, protected storage, backups and operational monitoring.

Run `node --experimental-strip-types --test --test-isolation=none server/sqlite-store.test.mjs`. Tests use disposable OS-temp databases and remove them afterward. Existing device saves are untouched.

## Implemented

- Shared product IDs, preview contents, planned once-per-account limits and SOL/SKR currency types. The app renders package quantities from this catalog. All products remain preview-only.
- Command contracts for gem draw/fusion and Deepwood milestone claims. Clients send intent, request ID and expected revision, never a new balance or random result.
- Test-only service verifies input, uses injected server-side randomness, checks revisions and caches successful request receipts. Repeated identical requests return their original result. Reused IDs with different payloads fail. This cache is memory-only and provides NO cross-process/restart guarantee.
- Server/test record provenance contract and ranking eligibility guard. Provenance must come from trusted DB records; a client can forge this field and must never be allowed to set it.

## Next implementation steps

1. Extend durable storage with wallet links and sessions; add parallel-process/crash tests and backup recovery before connecting real accounts. State/commands/economy transaction foundation is implemented locally.
2. Wallet challenge authentication: server nonce, domain, expiry, single-use signature verification, secure sessions. A connected address or MWA authorization token is not server authentication. Never request seed phrases.
3. Authenticated API and asynchronous app gateway. Keep the local development mode explicit; never silently fall back to local rewards after network failure. Fetch authoritative state on reconnect. Existing test saves stay isolated; do not upload them into ranked accounts.
4. Online gameplay validation: server time, fatigue, rate limits, short-lived play sessions, server RNG, valid drop IDs, collection expiry, maximum hit rates. Client animations can predict feedback, but balances come from validated server actions. No client-supplied final damage/score. This is not a guarantee against bots or multiple accounts.
5. Payment service: server-priced expiring orders with exact integer base units, allowed network and verified mint/decimals, recipient, product version and wallet binding. Verify successful finalized transfers via trusted RPC; do not trust client receipts. Globally unique network/transaction consumption; atomic order fulfillment + inventory credit + entitlement. Handle delayed/under/over/wrong-currency payments without automatic double grants. No configured price, recipient or SKR mint yet; selling stays disabled.
6. Ranked seasons: forest and axe mastery for progression; a separately balanced challenge for reward competition. Server-generated scores only, audit/review before frozen season snapshots. Paid buffs excluded from the proposed challenge. Payout rules, ties, anti-Sybil policy and distribution require separate implementation and review; no airdrop promise or automated payout exists.

## Validation

`node --experimental-strip-types --test --test-isolation=none server/game-service.test.mjs`

No new services, paid infrastructure, secret keys or live player mutations are needed for this phase. Deployment provider selection and production secrets remain separate decisions.
