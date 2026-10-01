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
  const seed = { requestId: 'farm_seed_01', expectedRevision: 0, command: { type: 'plantFarmSeed', plot: 0 } };
  const seeded = store.execute('alice', seed);
  assert.equal(seeded.progress.wood, 200);
  assert.equal(seeded.progress.farm.plots[0].readyAt, 0);
  assert.deepEqual(store.execute('alice', seed), seeded);
  assert.throws(() => store.execute('alice', { ...seed, command: { type: 'plantFarmSeed', plot: 1 } }), /REQUEST_ID_REUSED/);
  const start = { requestId: 'farm_start_01', expectedRevision: 1, command: { type: 'startFarmPuzzle', plot: 0 } };
  const started = store.execute('alice', start);
  assert.equal(started.progress.farm.puzzle.startedAt, now);
  assert.equal(started.progress.wood, 200);
  assert.deepEqual(store.execute('alice', start), started);
  const plant = { requestId: 'farm_plant_01', expectedRevision: 2, command: { type: 'finishFarmPuzzle', rotations: Array(9).fill(0) } };
  now += 1000;
  const planted = store.execute('alice', plant);
  assert.equal(planted.progress.wood, 200);
  assert.equal(planted.progress.farm.plots[0].quick, true);
  assert.equal(planted.progress.farm.karma, 0);
  assert.deepEqual(store.execute('alice', plant), planted);
  assert.throws(() => store.execute('alice', { ...plant, requestId: 'farm_double_01', expectedRevision: 3 }), /ACTION_UNAVAILABLE/);
  const claim = { requestId: 'farm_claim_01', expectedRevision: 3, command: { type: 'claimFarmTree', plot: 0 } };
  assert.throws(() => store.execute('alice', claim), /ACTION_UNAVAILABLE/);
  now = planted.progress.farm.plots[0].readyAt;
  const claimed = store.execute('alice', claim);
  assert.equal(claimed.progress.farm.karma, 1);
  assert.equal(claimed.progress.farm.plots[0], null);
  store.close(); store = open();
  assert.deepEqual(store.execute('alice', claim), claimed);
  assert.equal(store.load('alice').progress.farm.karma, 1);
  assert.equal(store.audit('alice').length, 4);
});

test('farm commands reject client timestamps, costs and malformed tile states', () => {
  for (const command of [
    { type: 'plantFarmSeed', plot: 0, cost: 0 },
    { type: 'activateBlessing', now: 1 },
    { type: 'activateBlessing', multiplier: 99 },
    { type: 'startFarmPuzzle', plot: 2 },
    { type: 'startFarmPuzzle', plot: 0, seed: 42 },
    { type: 'finishFarmPuzzle', rotations: [0] },
    { type: 'finishFarmPuzzle', rotations: Array(9).fill(4) },
    { type: 'finishFarmPuzzle', rotations: Array(9).fill(0), quick: true },
    { type: 'claimFarmTree', plot: 0, karma: 100 },
  ]) assert.throws(() => parseRequest({ requestId: 'farm_invalid_01', expectedRevision: 0, command }), /INVALID_COMMAND/);
});

test('server blessing charges four karma once, persists on restart and expires by server time', t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-blessing-')), path = join(folder, 'game.sqlite');
  let now = 100_000;
  const stores = [];
  const open = () => { const store = openGameStore(path, { now: () => now, random: () => 0.5 }); stores.push(store); return store; };
  let store = open();
  t.after(() => { for (const item of stores) { try { item.close(); } catch {} } rmSync(folder, { recursive: true, force: true }); });
  store.createPlayer('alice'); store.createPlayer('bob');
  const db = new DatabaseSync(path);
  const progress = { ...initialProgress('ko'), treeLevel: 15, treeHp: 1, wood: 300, harvested: 300,
    farm: { karma: 8, grown: 8, dayStart: 0, plantedToday: 3, plots: [null, null], puzzle: null } };
  for (const account of ['alice', 'bob']) db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify(progress), account);
  db.close();
  const request = { requestId: 'blessing_activate', expectedRevision: 0, command: { type: 'activateBlessing' } };
  const activated = store.execute('alice', request);
  assert.equal(activated.progress.farm.karma, 4);
  assert.equal(activated.progress.farm.blessingUntil, now + 20 * 60_000);
  assert.throws(() => store.execute('alice', { ...request, requestId: 'blessing_stack', expectedRevision: 1 }), /ACTION_UNAVAILABLE/);
  store.close(); store = open();
  assert.deepEqual(store.execute('alice', request), activated);
  assert.equal(store.load('alice').progress.farm.karma, 4);
  const boosted = store.execute('alice', { requestId: 'boosted_hit_01', expectedRevision: 1, command: { type: 'hit' } });
  const plain = store.execute('bob', { requestId: 'plain_hit_01', expectedRevision: 0, command: { type: 'hit' } });
  assert.equal(boosted.drops[0].value, plain.drops[0].value * 2);
  assert.equal(boosted.progress.coins, plain.progress.coins * 2);
  now += 300;
  const collected = store.execute('alice', { requestId: 'boosted_collect', expectedRevision: 2, command: { type: 'collectDrop', dropId: boosted.drops[0].id } });
  assert.equal(collected.progress.wood - boosted.progress.wood, boosted.drops[0].value);
  now = activated.progress.farm.blessingUntil;
  const renewed = store.execute('alice', { ...request, requestId: 'blessing_renew', expectedRevision: 3 });
  assert.equal(renewed.progress.farm.karma, 0);
  assert.equal(renewed.progress.farm.blessingUntil, now + 20 * 60_000);
  assert.equal(store.audit('alice').length, 4);
});
