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
test('existing version-four play data gains a hit clock without losing saved drops', t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-migrate-')), path = join(folder, 'test.sqlite');
  const old = new DatabaseSync(path);
  old.exec('CREATE TABLE play_state (player_id TEXT PRIMARY KEY, last_action INTEGER NOT NULL, collect_until INTEGER NOT NULL, drops TEXT NOT NULL) STRICT; PRAGMA user_version = 4;');
  old.prepare('INSERT INTO play_state VALUES (?,?,?,?)').run('alice', 123, 456, '[]');
  old.close();
  const store = openGameStore(path);
  t.after(() => { store.close(); rmSync(folder, { recursive: true, force: true }); });
  const migrated = new DatabaseSync(path);
  assert.equal(migrated.prepare('PRAGMA user_version').get().user_version, 6);
  assert.deepEqual({ ...migrated.prepare('SELECT last_action, collect_until, drops, last_hit FROM play_state WHERE player_id=?').get('alice') },
    { last_action: 123, collect_until: 456, drops: '[]', last_hit: 0 });
  migrated.close();
});
test('server hit produces expiring wood, idempotent collection and fatigue', t => {
  const f = fixture(t), r = f.command('hit'), first = f.store.execute('alice', r);
  assert.equal(first.lastDamage, 3); assert.equal(first.progress.fatigue, 1); assert.equal(first.progress.wood, 10);
  assert.equal(first.drops[0].value, 2);
  assert.deepEqual(first.hitEvents, [{ hit: 1, damage: 3, critical: false }]);
  assert.deepEqual(f.store.execute('alice', r), first);
  assert.throws(() => f.store.execute('alice', f.command('hit')), /ACTION_TOO_FAST/);
  f.advance(150);
  const pickup = f.command('collectDrop', { dropId: first.drops[0].id });
  const collected = f.store.execute('alice', pickup);
  assert.equal(collected.progress.wood, 12); assert.equal(collected.progress.harvested, 2); assert.equal(collected.drops.length, 0);
  assert.equal(collected.hitEvents, undefined);
  assert.deepEqual(f.store.execute('alice', pickup), collected);
  f.advance(150); assert.throws(() => f.store.execute('alice', f.command('hit')), /ACTION_TOO_FAST/);
  f.advance(100); assert.throws(() => f.store.execute('alice', f.command('collectDrop', { dropId: first.drops[0].id })), /DROP_UNAVAILABLE/);
});

test('first-record permanent speed changes server cadence from two seconds to one', t => {
  const f = fixture(t);
  f.store.execute('alice', f.command('hit'));
  f.advance(999);
  assert.throws(() => f.store.execute('alice', f.command('hit')), /ACTION_TOO_FAST/);
  const db = new DatabaseSync(f.path), progress = f.store.load('alice').progress;
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify({ ...progress,
    firstRecordClaimed: true, skinQuestHarvestStart: 0,
    receipt: { address: 'test', signature: 'test', status: 'confirmed' } }), 'alice');
  db.close();
  f.advance(1);
  assert.equal(f.store.execute('alice', f.command('hit')).progress.totalHits, 2);
  f.advance(999);
  assert.throws(() => f.store.execute('alice', f.command('hit')), /ACTION_TOO_FAST/);
  f.advance(1);
  assert.equal(f.store.execute('alice', f.command('hit')).progress.totalHits, 3);
});

test('queued collection stays responsive while hits obey the two-second server cadence', t => {
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
  q.push({ type: 'collectDrop', dropId: first.drops[0].id }, now);
  now += 150; f.advance(150);
  assert.equal(send(now).progress.wood, 12);
  q.push({ type: 'hit' }, now);
  assert.equal(q.take(now, now + 250).wait, 250);
  now += 1850; f.advance(1850);
  assert.deepEqual(send(now).hitEvents.map(e => e.hit), [2]);
  assert.throws(() => f.store.execute('alice', f.command('hit')), /ACTION_TOO_FAST/);
  assert.equal(q.size, 0);
});
test('another account and exact-expiry collection fail; client rewards rejected', t => {
  const f = fixture(t), state = f.store.execute('alice', f.command('hit')), dropId = state.drops[0].id;
  assert.throws(() => f.store.execute('bob', f.command('collectDrop', { dropId }, 'bob')), /DROP_UNAVAILABLE/);
  assert.throws(() => f.store.execute('alice', f.command('hit', { damage: 999 })), /INVALID_COMMAND/);
  f.advance(5000);
  assert.throws(() => f.store.execute('alice', f.command('collectDrop', { dropId })), /DROP_UNAVAILABLE/);
  assert.equal(f.store.load('alice').progress.wood, 10);
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
  assert.equal(f.store.load('alice').progress.treeHp, 40);
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
