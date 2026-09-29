import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openGameStore } from './sqlite-store.mjs';
import { initialProgress } from '../src/game/progression.ts';
import { parseRequest } from './game-service.ts';

test('trolley loads a live drop, banks once, and survives a server restart', t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-trolley-'));
  const path = join(folder, 'test.sqlite');
  let time = 1_000_000;
  const stores = [];
  const open = () => { const store = openGameStore(path, { now: () => time, random: () => 0.9 }); stores.push(store); return store; };
  const store = open();
  store.createPlayer('alice');
  t.after(() => { for (const s of stores) { try { s.close(); } catch {} } rmSync(folder, { recursive: true, force: true }); });
  const db = new DatabaseSync(path);
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify({ ...initialProgress('en'), axeLevel: 2 }), 'alice');
  db.close();

  const hit = store.execute('alice', { requestId: 'trolley_hit_01', expectedRevision: 0, command: { type: 'hit' } });
  assert.equal(hit.progress.wood, 0);
  assert.equal(hit.drops.length, 1);
  const drop = hit.drops[0];
  const load = { requestId: 'trolley_load_01', expectedRevision: 1, command: { type: 'loadTrolley', dropId: drop.id } };
  time += 200;
  const loaded = store.execute('alice', load);
  assert.equal(loaded.progress.trolleyWood, drop.value);
  assert.equal(loaded.progress.wood, 0);
  assert.equal(loaded.progress.harvested, 0);
  assert.equal(loaded.drops.length, 0);
  assert.deepEqual(store.execute('alice', load), loaded);
  store.close();
  const resumed = open();
  assert.equal(resumed.load('alice').progress.trolleyWood, drop.value);
  time += 300;
  assert.throws(() => resumed.execute('alice', { ...load, requestId: 'trolley_load_again', expectedRevision: 2 }), /DROP_UNAVAILABLE/);

  const bank = { requestId: 'trolley_bank_01', expectedRevision: 2, command: { type: 'collectTrolley' } };
  const dispatched = resumed.execute('alice', bank);
  assert.equal(dispatched.progress.trolleyWood, drop.value);
  assert.equal(dispatched.progress.wood, 0);
  assert.equal(dispatched.progress.trolleyTrip.arrivesAt, time + 3000);
  assert.deepEqual(resumed.execute('alice', bank), dispatched);
  time += 300;
  assert.throws(() => resumed.execute('alice', { ...bank, requestId: 'trolley_bank_again', expectedRevision: 3 }), /ACTION_UNAVAILABLE/);
  resumed.close();
  const reopened = open();
  assert.deepEqual(reopened.execute('alice', bank), dispatched);
  assert.equal(reopened.load('alice').progress.trolleyWood, drop.value);
  time = dispatched.progress.trolleyTrip.arrivesAt - 200;
  const early = reopened.execute('alice', { requestId: 'trolley_early_01', expectedRevision: 3, command: { type: 'recover' } });
  assert.equal(early.progress.wood, 0);
  time += 200;
  const banked = reopened.execute('alice', { requestId: 'trolley_arrive_01', expectedRevision: 4, command: { type: 'recover' } });
  assert.equal(banked.progress.trolleyWood, 0);
  assert.equal(banked.progress.wood, drop.value);
  assert.equal(banked.progress.harvested, drop.value);
  time = dispatched.progress.trolleyTrip.returnsAt;
  const returned = reopened.execute('alice', { requestId: 'trolley_return_01', expectedRevision: 5, command: { type: 'recover' } });
  assert.equal(returned.progress.trolleyTrip, null);
  assert.equal(reopened.load('alice').progress.wood, drop.value);
  assert.equal(reopened.audit('alice').length, 6);
});

test('trolley rejects fabricated and expired drops without minting wood', t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-trolley-expiry-'));
  const path = join(folder, 'test.sqlite');
  let time = 1_000_000;
  const store = openGameStore(path, { now: () => time, random: () => 0.9 });
  t.after(() => { store.close(); rmSync(folder, { recursive: true, force: true }); });
  store.createPlayer('alice');
  const db = new DatabaseSync(path);
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify({ ...initialProgress('en'), axeLevel: 2 }), 'alice');
  db.close();
  assert.throws(() => parseRequest({ requestId: 'trolley_fake_01', expectedRevision: 0,
    command: { type: 'loadTrolley', dropId: 'fabricated', value: 999 } }), /INVALID_COMMAND/);
  const hit = store.execute('alice', { requestId: 'trolley_hit_02', expectedRevision: 0, command: { type: 'hit' } });
  time += 5001;
  assert.throws(() => store.execute('alice', { requestId: 'trolley_late_01', expectedRevision: 1,
    command: { type: 'loadTrolley', dropId: hit.drops[0].id } }), /DROP_UNAVAILABLE/);
  assert.equal(store.load('alice').progress.trolleyWood, 0);
  assert.equal(store.load('alice').progress.wood, 0);
  assert.equal(store.audit('alice').length, 1);
});

test('one sweep atomically loads multiple live drops and cannot be replayed for extra cargo', t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-trolley-sweep-'));
  const path = join(folder, 'test.sqlite');
  let time = 1_000_000;
  const store = openGameStore(path, { now: () => time, random: () => 0.9 });
  t.after(() => { store.close(); rmSync(folder, { recursive: true, force: true }); });
  store.createPlayer('alice');
  const db = new DatabaseSync(path);
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify({ ...initialProgress('en'), axeLevel: 2 }), 'alice');
  db.close();
  const first = store.execute('alice', { requestId: 'sweep_hit_01', expectedRevision: 0, command: { type: 'hit' } });
  time += 2000;
  const second = store.execute('alice', { requestId: 'sweep_hit_02', expectedRevision: 1, command: { type: 'hit' } });
  const ids = second.drops.map(drop => drop.id);
  assert.equal(ids.length, 2);
  const command = { requestId: 'sweep_load_01', expectedRevision: 2, command: { type: 'loadTrolleyBatch', dropIds: ids } };
  time += 200;
  const loaded = store.execute('alice', command);
  assert.equal(loaded.progress.trolleyWood, first.drops[0].value + second.drops[1].value);
  assert.equal(loaded.progress.wood, 0);
  assert.equal(loaded.drops.length, 0);
  assert.deepEqual(store.execute('alice', command), loaded);
  time += 300;
  assert.throws(() => store.execute('alice', { requestId: 'sweep_reuse_01', expectedRevision: 3,
    command: { type: 'loadTrolleyBatch', dropIds: ids } }), /DROP_UNAVAILABLE/);
  assert.equal(store.audit('alice').length, 3);
  for (const dropIds of [[], [ids[0], ids[0]], Array(9).fill('fake_id_123')]) {
    assert.throws(() => parseRequest({ requestId: 'sweep_bad_01', expectedRevision: 3,
      command: { type: 'loadTrolleyBatch', dropIds } }), /INVALID_COMMAND/);
  }
  assert.throws(() => store.execute('alice', { requestId: 'sweep_fake_01', expectedRevision: 3,
    command: { type: 'loadTrolleyBatch', dropIds: ['fake_id_123'] } }), /DROP_UNAVAILABLE/);
});

test('server rejects over-capacity loading without consuming the drop or legacy cargo', t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-trolley-cap-'));
  const path = join(folder, 'test.sqlite');
  let time = 1_000_000;
  const store = openGameStore(path, { now: () => time, random: () => 0.9 });
  t.after(() => { store.close(); rmSync(folder, { recursive: true, force: true }); });
  store.createPlayer('alice');
  const db = new DatabaseSync(path);
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify({ ...initialProgress('en'), axeLevel: 2, trolleyWood: 13 }), 'alice');
  db.close();

  const hit = store.execute('alice', { requestId: 'cap_hit_01', expectedRevision: 0, command: { type: 'hit' } });
  const drop = hit.drops[0];
  assert.ok(drop.value > 1);
  time += 200;
  assert.throws(() => store.execute('alice', { requestId: 'cap_load_01', expectedRevision: 1,
    command: { type: 'loadTrolley', dropId: drop.id } }), /ACTION_UNAVAILABLE/);
  assert.equal(store.load('alice').progress.trolleyWood, 13);
  assert.equal(store.load('alice').drops[0].id, drop.id);
  assert.equal(store.audit('alice').length, 1);

  const direct = store.execute('alice', { requestId: 'cap_collect_01', expectedRevision: 1,
    command: { type: 'collectDrop', dropId: drop.id } });
  assert.equal(direct.progress.wood, drop.value);
  assert.equal(direct.progress.trolleyWood, 13);
  assert.equal(direct.drops.length, 0);
});
