import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openGameStore } from './sqlite-store.mjs';
import { createLiveInputQueue } from '../src/game/live-input-queue.ts';
function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-play-')), path = join(folder, 'test.sqlite');
  let clock = 100000, seq = 0;
  const store = openGameStore(path, { random: () => 0.9, now: () => clock });
  store.createPlayer('alice'); store.createPlayer('bob');
  t.after(() => { store.close(); rmSync(folder, { recursive: true, force: true }); });
  return { store, path, advance: ms => { clock += ms; }, command: (type, extra = {}, player = 'alice') => ({ requestId: `command_${++seq}`, expectedRevision: store.load(player).revision, command: { type, ...extra } }) };
}
test('server hit produces expiring wood, idempotent collection and fatigue', t => {
  const f = fixture(t), r = f.command('hit'), first = f.store.execute('alice', r);
  assert.equal(first.lastDamage, 3); assert.equal(first.progress.fatigue, 1); assert.equal(first.progress.wood, 0);
  assert.equal(first.drops[0].value, 2);
  assert.deepEqual(first.hitEvents, [{ hit: 1, damage: 3, critical: false }]);
  assert.deepEqual(f.store.execute('alice', r), first);
  assert.throws(() => f.store.execute('alice', f.command('hit')), /ACTION_TOO_FAST/);
  f.advance(150);
  const pickup = f.command('collectDrop', { dropId: first.drops[0].id });
  const collected = f.store.execute('alice', pickup);
  assert.equal(collected.progress.wood, 2); assert.equal(collected.drops.length, 0);
  assert.equal(collected.hitEvents, undefined);
  assert.deepEqual(f.store.execute('alice', pickup), collected);
  f.advance(150); assert.throws(() => f.store.execute('alice', f.command('hit')), /ACTION_TOO_FAST/);
  f.advance(100); assert.throws(() => f.store.execute('alice', f.command('collectDrop', { dropId: first.drops[0].id })), /DROP_UNAVAILABLE/);
});

test('queued hits and collection obey server timing and return every confirmed hit', t => {
  const f = fixture(t), q = createLiveInputQueue();
  let now = 100000;
  q.push({ type: 'hit' }, now);
  const send = readyAt => {
    const step = q.take(now, readyAt);
    assert.ok(step.command);
    const request = { requestId: `queue_${now}`, expectedRevision: f.store.load('alice').revision, command: step.command };
    const result = f.store.execute('alice', request);
    assert.deepEqual(f.store.execute('alice', request), result);
    return result;
  };
  const first = send(0);
  for (let i = 0; i < 4; i++) q.push({ type: 'hit' }, now);
  q.push({ type: 'collectDrop', dropId: first.drops[0].id }, now);
  q.push({ type: 'hit' }, now);
  now += 600; f.advance(600);
  const batch = send(100150);
  assert.deepEqual(batch.hitEvents.map(e => e.hit), [2, 3, 4, 5]);
  assert.equal(batch.hitEvents.every(e => e.damage === 3 && e.critical === false), true);
  now += 150; f.advance(150);
  assert.equal(send(now).progress.wood, 2);
  assert.equal(q.take(now, now + 250).wait, 250);
  now += 250; f.advance(250);
  assert.equal(send(now).progress.totalHits, 6);
  assert.equal(q.size, 0);
});
test('another account and exact-expiry collection fail; client rewards rejected', t => {
  const f = fixture(t), state = f.store.execute('alice', f.command('hit')), dropId = state.drops[0].id;
  assert.throws(() => f.store.execute('bob', f.command('collectDrop', { dropId }, 'bob')), /DROP_UNAVAILABLE/);
  assert.throws(() => f.store.execute('alice', f.command('hit', { damage: 999 })), /INVALID_COMMAND/);
  f.advance(5000);
  assert.throws(() => f.store.execute('alice', f.command('collectDrop', { dropId })), /DROP_UNAVAILABLE/);
  assert.equal(f.store.load('alice').progress.wood, 0);
});
test('full fatigue blocks hits; only server elapsed time recovers it', t => {
  const f = fixture(t), db = new DatabaseSync(f.path), state = f.store.load('alice').progress;
  state.fatigue = 100; state.recoveryAt = 100000;
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify(state), 'alice'); db.close();
  assert.throws(() => f.store.execute('alice', f.command('hit')), /ACTION_UNAVAILABLE/);
  f.advance(1800000);
  const recovered = f.store.execute('alice', f.command('recover'));
  assert.equal(recovered.progress.fatigue, 80);
});
test('failed audit rolls back both drop creation and hit damage', t => {
  const f = fixture(t), db = new DatabaseSync(f.path);
  db.exec("CREATE TRIGGER fail_play BEFORE INSERT ON economy_events BEGIN SELECT RAISE(ABORT, 'FAIL_TEST'); END");
  assert.throws(() => f.store.execute('alice', f.command('hit')), /FAIL_TEST/);
  assert.equal(f.store.load('alice').progress.treeHp, 300);
  assert.equal(f.store.load('alice').drops.length, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM play_state').get().n, 0); db.close();
});

test('server axe upgrades spend coins once and cannot equip an unowned axe', t => {
  const f = fixture(t);
  assert.throws(() => f.store.execute('alice', f.command('upgradeAxe')), /ACTION_UNAVAILABLE/);
  assert.throws(() => f.store.execute('alice', f.command('equipAxe', { skin: 'warden' })), /ACTION_UNAVAILABLE/);
  assert.throws(() => f.store.execute('alice', f.command('equipAxe', { skin: 'fake' })), /INVALID_COMMAND/);
  assert.throws(() => f.store.execute('alice', f.command('upgradeAxe', { coins: 999 })), /INVALID_COMMAND/);
  const db = new DatabaseSync(f.path), progress = f.store.load('alice').progress;
  progress.coins = 100;
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify(progress), 'alice'); db.close();
  const request = f.command('upgradeAxe');
  const result = f.store.execute('alice', request);
  assert.equal(result.progress.axeLevel, 2);
  assert.equal(result.progress.coins, 80);
  assert.deepEqual(f.store.execute('alice', request), result);
  assert.equal(f.store.load('bob').progress.axeLevel, 1);
});

test('server equip keeps independent axe levels and fingerprints the requested skin', t => {
  const f = fixture(t), db = new DatabaseSync(f.path), progress = f.store.load('alice').progress;
  // Test-only fixture; never import client saves through a public API.
  progress.treeLevel = 101; progress.treeHp = 0; progress.axeLevel = 5;
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify(progress), 'alice'); db.close();
  const request = f.command('equipAxe', { skin: 'warden' });
  const result = f.store.execute('alice', request);
  assert.equal(result.progress.axeSkin, 'warden'); assert.equal(result.progress.axeLevel, 1);
  assert.deepEqual(f.store.execute('alice', request), result);
  assert.throws(() => f.store.execute('alice', { ...request, command: { type: 'equipAxe', skin: 'default' } }), /REQUEST_ID_REUSED/);
  f.advance(150);
  assert.equal(f.store.execute('alice', f.command('equipAxe', { skin: 'default' })).progress.axeLevel, 5);
});
