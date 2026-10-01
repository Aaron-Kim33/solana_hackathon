import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openGameStore } from './sqlite-store.mjs';
import { parseRequest } from './game-service.ts';
import { initialProgress, treeHealth } from '../src/game/progression.ts';

test('server owns planting time, wood cost, puzzle seed and one-time karma', t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-farm-')), path = join(folder, 'farm.sqlite');
  let now = 100_000;
  const stores = [];
  const open = () => { const store = openGameStore(path, { now: () => now, random: () => 0.25 }); stores.push(store); return store; };
  let store = open(); store.createPlayer('alice');
  t.after(() => { for (const item of stores) { try { item.close(); } catch {} } rmSync(folder, { recursive: true, force: true }); });
  const db = new DatabaseSync(path);
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify({ ...initialProgress('ko'),
    treeLevel: 15, treeHp: treeHealth(15), wood: 300, harvested: 300 }), 'alice');
  db.close();
  const start = { requestId: 'farm_start_01', expectedRevision: 0, command: { type: 'startFarmPuzzle', plot: 0 } };
  const started = store.execute('alice', start);
  assert.equal(started.progress.farm.puzzle.startedAt, now);
  assert.equal(started.progress.wood, 300);
  assert.deepEqual(store.execute('alice', start), started);
  const plant = { requestId: 'farm_plant_01', expectedRevision: 1, command: { type: 'finishFarmPuzzle', rotations: Array(9).fill(0) } };
  now += 1000;
  const planted = store.execute('alice', plant);
  assert.equal(planted.progress.wood, 200);
  assert.equal(planted.progress.farm.plots[0].quick, true);
  assert.equal(planted.progress.farm.karma, 0);
  assert.deepEqual(store.execute('alice', plant), planted);
  assert.throws(() => store.execute('alice', { ...plant, requestId: 'farm_double_01', expectedRevision: 2 }), /ACTION_UNAVAILABLE/);
  const claim = { requestId: 'farm_claim_01', expectedRevision: 2, command: { type: 'claimFarmTree', plot: 0 } };
  assert.throws(() => store.execute('alice', claim), /ACTION_UNAVAILABLE/);
  now = planted.progress.farm.plots[0].readyAt;
  const claimed = store.execute('alice', claim);
  assert.equal(claimed.progress.farm.karma, 1);
  assert.equal(claimed.progress.farm.plots[0], null);
  store.close(); store = open();
  assert.deepEqual(store.execute('alice', claim), claimed);
  assert.equal(store.load('alice').progress.farm.karma, 1);
  assert.equal(store.audit('alice').length, 3);
});

test('farm commands reject client timestamps, costs and malformed tile states', () => {
  for (const command of [
    { type: 'startFarmPuzzle', plot: 2 },
    { type: 'startFarmPuzzle', plot: 0, seed: 42 },
    { type: 'finishFarmPuzzle', rotations: [0] },
    { type: 'finishFarmPuzzle', rotations: Array(9).fill(4) },
    { type: 'finishFarmPuzzle', rotations: Array(9).fill(0), quick: true },
    { type: 'claimFarmTree', plot: 0, karma: 100 },
  ]) assert.throws(() => parseRequest({ requestId: 'farm_invalid_01', expectedRevision: 0, command }), /INVALID_COMMAND/);
});
