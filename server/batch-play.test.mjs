import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { openGameStore } from './sqlite-store.mjs';
test('100-hit comparison: fewer committed receipts with equivalent results', () => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-batch-'));
  try {
    const results = [];
    for (const count of [1, 4]) {
      let time = 100000, bytes = 0;
      const store = openGameStore(join(folder, `${count}.sqlite`), { random: () => 0.9, now: () => time });
      try {
        store.createPlayer('player'); const start = performance.now();
        for (let n = 0; n < 100 / count; n++) {
          time += count * 150;
          const r = { requestId: `request_${n}`, expectedRevision: n, command: count === 1 ? { type: 'hit' } : { type: 'hitBatch', count } };
          const result = store.execute('player', r); bytes += Buffer.byteLength(JSON.stringify(result));
          if (count === 4) assert.deepEqual(store.execute('player', r), result);
        }
        const state = store.load('player');
        results.push({ count, commits: store.audit('player').length, responseBytes: bytes, elapsedMs: Math.round(performance.now() - start), hits: state.progress.totalHits, hp: state.progress.treeHp, xp: state.progress.xp });
      } finally { store.close(); }
    }
    assert.equal(results[0].commits, 100); assert.equal(results[1].commits, 25);
    for (const key of ['hits', 'hp', 'xp']) assert.equal(results[0][key], results[1][key]);
    console.log('LOCAL_BATCH_MEASUREMENT', JSON.stringify(results));
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
test('batch count, time budget and retry identity cannot inflate rewards', () => {
  let time = 100000;
  const store = openGameStore(':memory:', { random: () => 0.9, now: () => time });
  try {
    store.createPlayer('player');
    const r = { requestId: 'batch_001', expectedRevision: 0, command: { type: 'hitBatch', count: 4 } };
    const first = store.execute('player', r);
    assert.equal(first.progress.totalHits, 4);
    assert.throws(() => store.execute('player', { ...r, command: { type: 'hitBatch', count: 3 } }), /REQUEST_ID_REUSED/);
    time += 150;
    assert.throws(() => store.execute('player', { ...r, requestId: 'batch_002', expectedRevision: 1 }), /ACTION_TOO_FAST/);
    for (const count of [0, 5, -1, 1.5]) assert.throws(() => store.execute('player', { ...r, command: { type: 'hitBatch', count } }), /INVALID_COMMAND/);
    assert.equal(store.load('player').progress.totalHits, 4);
  } finally { store.close(); }
});
