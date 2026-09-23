# Local HTTP stability check — 2026-09-15

Run from the project: `node --experimental-strip-types server/load-check.mjs`.

The script generates 20 temporary signing keys, a private temporary SQLite DB and a loopback server on an ephemeral port. It never contacts Solana, uses an existing wallet, or opens `server/local-dev.sqlite`. Temporary data is removed on completion.

Each account submits 20 four-hit batches, waiting 630ms between requests. Total: 1,600 hits, 400 committed commands. First character level-up resets fatigue; this is expected gameplay, not lost hits.

Measured run:

| Metric | Result |
| --- | --- |
| Play phase wall time | 13.458 seconds |
| Command HTTP latency p50 / p95 | 23.88 / 56.93 ms |
| Command response body bytes | 709,883 |
| Whole-process CPU during play | 1,265 ms |
| Whole-process RSS after play | 87 MB |
| Closed database size | 1,806,336 bytes |
| Request failures | 0 |

The client generator and server share one Node process, so CPU/RSS are not server-only measurements. This is short loopback traffic, not a capacity benchmark or mobile latency test. Gameplay randomness changes payload sizes slightly between runs. Full audit snapshots and retry receipts account for storage growth; production retention/compaction is still required.

Additional checks passed: graceful shutdown and reopen preserve all 20 sessions and progress; retrying each last command returns the original receipt; exhausting one account's rate quota does not block another account on the same IP. Abrupt process termination, poor network conditions and long-duration load are not covered by this script.

## Next implementation boundary

The main forest remains the existing local prototype; only the development server-play panel uses these commands. Do not mark local saves ranking-eligible or upload final local balances as trusted progress. Next: connect main-screen inputs to the verified command path while preserving the local test save, then test delayed replies/reconnect on Android. Public deployment, paid entitlements and ranking payouts remain unavailable.
