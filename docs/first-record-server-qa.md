# First Record — server integration, 2026-09-20

## Implemented / evidence

Existing quest UI now uses server commands for wallet acknowledgement (after 20 harvested wood), First Record reward claim and axe equip. Record preparation checks server-owned prerequisite progress and the wallet linked by authenticated login. A durable per-player intent contains a random unique Devnet Memo. The client cannot submit a completed flag, transaction body, reward or wallet identity.

Server reads `getTransaction` from fixed Devnet RPC at **finalized** commitment. It checks the first signature, fee-payer signer, Memo program and exact issued memo; absent transaction remains pending, missing metadata/mismatch fails closed. Only successful finalized transactions complete the quest. This is a commemorative record, not on-chain gameplay or a verified ranked score.

The record receipt, progress revision and audit commit atomically. Confirmed retries do not increment revision again. Claim is a separate idempotent command; first equip activates the existing permanent +1 and opens the 100-wood quest. DB schema v3 adds the record intent table without importing/changing local saves. Local transaction-signature recovery files are separate from game saves and contain no private keys.

Verification: 134 tests and TypeScript pass. Tests cover wrong evidence, pending/failed transactions, prerequisite rejection, rollback, reopen, duplicate claim, first equip and authenticated HTTP journey. The HTTP service is actually closed/reopened during a pending record, then an RPC outage is injected and recovered. Client recovery tests verify request ordering, corrupted receipts, lost responses and no transaction-broadcast path. RPC responses are fixtures, **not live wallet/Devnet proof**.

## Reconnect behavior

- `GET /record` reads only the authenticated account's existing intent; reading/checking an account without an intent does not create one.
- Successful login/explicit server refresh checks for an existing record once. A device-persisted signature missing from the server is registered before verification; no wallet authorization or new blockchain send occurs in recovery.
- Menu action **Check record status · No resend** repeats this recovery explicitly. RPC trouble is reported separately from login; it never grants local rewards or claims account login failed after progress was loaded.
- Actual external record RPC checks are limited to 12/minute/account and one in flight/account. Confirmed DB receipts need no external RPC. This is a local safeguard, not production capacity evidence.
- App restart can reuse a SecureStore token after the server validates it through `/me`; expired or revoked tokens require a new wallet sign-in. The user confirmed automatic return to the server save. This does not prove the record receipt recovery path or logout/expiry failure cases.

## Manual gate — pending

1. Restart local API, then reload app. No reinstall or save deletion.
2. Connect server save from existing menu; harvest 20 and use wallet quest action to acknowledge the authenticated wallet. Complete axe/character/tree prerequisites on this server save.
3. First Record button asks for approval. Cancel: no reward/progression. Approve with the same wallet and sufficient **Devnet** SOL.
4. Pending: use menu **Check record status · No resend**. Re-login also tries recovery once. Verify finalization then claim reward, equip First Record axe, check permanent bonus and new 100-wood objective.
5. Restart/relogin: confirmed record and claimed reward remain. Repeat claim cannot pay twice. Switch accounts: neither record nor reward transfers.
6. Test offline after sending: persisted signature should recover on re-login or explicit status check. Failed finalized transaction grants nothing and allows a new intent only through the user-initiated record flow.
7. Verify Korean/English labels, wallet cancellation and insufficient-fee feedback on a real device before marking complete.

## Limits retained

Development-only loopback API; release/public deployment remains incomplete. Persistent device login is implemented, but its expiry/logout/network-failure QA remains incomplete. Later quest rewards/gems/talents/auto-pickup remain disconnected in server UI. No real payments or airdrops enabled. Performance investigation remains deferred by user.

A submitted signature that never appears in finalized RPC remains pending; automatic replacement is deliberately disabled to avoid duplicate signing. Wallet-send success followed by app termination before signature persistence is still a recovery gap. Public deployment needs intent/blockhash expiry and reconciliation, bounded RPC checking and receipt retention. Do not call the complete release recovery gate finished.

Reference: https://solana.com/docs/rpc/http/gettransaction
