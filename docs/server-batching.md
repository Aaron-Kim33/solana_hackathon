# Server traffic reduction: measured prototype, September 15

> Historical prototype and measurements below. September 20: the separate forest was removed; main-screen input now sends the first tap immediately and merges only already queued taps within the server time budget. Collection is queued rather than discarded during in-flight hits. See `main-server-qa.md` for current behavior and limitations. The historical 600ms batching policy and 75% full-batch savings are not claims about current live gameplay.

Implemented in the isolated server test panel, NOT the main forest:

- Input collected over 600ms, max four taps per request, immediate pressed-state visual feedback. Damage/wood are displayed only after authoritative confirmation. No blockchain transaction/signature per tap.
- One transaction/receipt/audit per batch, not per hit. Entire batch is atomic. Server owns RNG and assigns virtual hit times within the last 450ms; 150ms minimum spacing and previous action/collection lock are enforced. Clients cannot provide timestamps, damage or random results. At fatigue/HP limits, remaining hits are not executed.
- Each drop still has its own server ID and expiry based on its assigned hit time. Collection stays immediate and unbatched for now. Queued attacks must finish before collection. While a hit batch is in flight, up to four additional taps can queue with immediate pressed-state feedback. Requests stay serial and respect the server time budget. Unsent inputs expire locally after two seconds or an unresolved prior request; confirmed rewards and sent request IDs remain intact. This is NOT final latency-hiding gameplay.
- Removed unconditional `/me` after successful commands. Retried receipts, explicit refresh and conflicts still refresh current state.
- Input not yet sent is discarded on menu unmount; committed requests remain in the DB. Uncertain sent requests keep their ID for retry. No local reward fallback.

## Reproducible measurement

Run `node --experimental-strip-types --test --test-isolation=none server/batch-play.test.mjs`.

Observed on this Windows/Node24 machine: 100 deterministic hits, separate temporary SQLite DBs, no real accounts, simulated elapsed game time, no network or wallet cost included:

| Mode | Commits | Command response JSON bytes | Loop elapsed ms |
| --- | ---: | ---: | ---: |
| Individual | 100 | 282343 | 344 |
| Four per batch | 25 | 71501 | 103 |

Both ended at 100 hits, 0 tree HP, 100 XP. Batched loop also replayed each receipt to verify idempotency; timings are illustrative, not a fair standalone throughput claim. Payload totals exclude HTTP headers and the previous extra `/me` reads. Commits drop 75% at full batches; slow single taps achieve less saving. Replay test verifies no extra commits/rewards. Unknown counts, oversized batches, time-budget violations and altered request reuse are rejected.

## Remaining work before deployment

Real-device latency/UX testing; concurrent multi-client load testing with p95 latency, CPU/memory, DB size and contention; bounded retention of command receipts/audits with an explicit retry policy; eventually delta-based audit/checkpoints; secure persistent sessions; batched mixed collection/input stream with bounded latency; full forest integration. Full snapshots are still retained once per batch for recovery simplicity. Current global API rate limit is a local safeguard, not production capacity management. Do not claim anti-bot completeness or ranked fairness from these tests.
