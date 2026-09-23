import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openGameStore } from './sqlite-store.mjs';

const request = { requestId: 'persist_001', expectedRevision: 0, command: { type: 'fuse', tier: 'low' } };
function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-db-test-'));
  const path = join(folder, 'test.sqlite');
  const stores = [];
  t.after(() => { for (const s of stores) { try { s.close(); } catch {} } rmSync(folder, { recursive: true, force: true }); });
  const open = () => { const s = openGameStore(path, { random: () => 0 }); stores.push(s); return s; };
  const store = open();
  store.createPlayer('alice'); store.createPlayer('bob');
  // Explicit test fixture seeding, not an exposed import/grant route.
  const db = new DatabaseSync(path);
  for (const player of ['alice', 'bob']) {
    const state = store.load(player).progress; state.gems.low = 6;
    db.prepare('UPDATE players SET progress = ?, provenance = ? WHERE id = ?').run(JSON.stringify(state), 'local-test', player);
  }
  db.close();
  return { store, open, path };
}
test('receipts and resources survive reopening; retries do not pay twice', t => {
  const { store, open } = fixture(t);
  const result = store.execute('alice', request); store.close();
  const reopened = open();
  assert.deepEqual(reopened.execute('alice', request), result);
  assert.equal(reopened.load('alice').progress.gems.low, 3);
  assert.equal(reopened.audit('alice').length, 1);
  assert.equal(reopened.load('alice').provenance, 'local-test');
});
test('independent connections serialize stale updates and isolate accounts', t => {
  const { store, open } = fixture(t), other = open();
  store.execute('alice', request);
  assert.throws(() => other.execute('alice', { ...request, requestId: 'persist_002' }), /REVISION_CONFLICT/);
  assert.throws(() => other.execute('alice', { ...request, command: { type: 'drawGem' } }), /REQUEST_ID_REUSED/);
  assert.equal(other.execute('bob', request).progress.gems.medium, 1);
  assert.equal(other.audit('alice').length, 1);
});
test('injected ledger write failure rolls back balance and receipt together', t => {
  const { store, path } = fixture(t);
  const db = new DatabaseSync(path);
  db.exec("CREATE TRIGGER fail_event BEFORE INSERT ON economy_events BEGIN SELECT RAISE(ABORT, 'INJECTED_FAILURE'); END;");
  assert.throws(() => store.execute('alice', request), /INJECTED_FAILURE/);
  assert.equal(store.load('alice').revision, 0);
  assert.equal(store.load('alice').progress.gems.low, 6);
  assert.equal(store.audit('alice').length, 0);
  assert.equal(db.prepare('SELECT count(*) AS count FROM commands').get().count, 0);
  db.exec('DROP TRIGGER fail_event'); db.close();
  assert.equal(store.execute('alice', request).progress.gems.medium, 1);
});
test('new player creation does not overwrite progress; bad commands do not write', t => {
  const { store } = fixture(t);
  assert.throws(() => store.createPlayer('alice'));
  assert.throws(() => store.execute('alice', { ...request, wood: 999 }), /INVALID_COMMAND/);
  assert.throws(() => store.execute('missing', request), /PLAYER_NOT_FOUND/);
  assert.equal(store.load('alice').progress.gems.low, 6);
  assert.equal(store.audit('alice').length, 0);
});
test('wallet quest grants 20 server coins once, including completed legacy accounts', t => {
  const { store, open, path } = fixture(t);
  const db = new DatabaseSync(path);
  db.exec('CREATE TABLE wallet_links (wallet TEXT PRIMARY KEY, player_id TEXT UNIQUE)');
  db.prepare('INSERT INTO wallet_links VALUES (?, ?)').run('test_wallet', 'alice');
  db.prepare('INSERT INTO wallet_links VALUES (?, ?)').run('other_wallet', 'bob');
  for (const player of ['alice', 'bob']) {
    const progress = store.load(player).progress;
    db.prepare('UPDATE players SET progress = ? WHERE id = ?').run(JSON.stringify({ ...progress, harvested: 20,
      walletCompleted: player === 'bob', coins: player === 'bob' ? 7 : 0 }), player);
  }
  assert.equal(store.load('bob').walletCoinRewardClaimed, false);
  const aliceRequest = { requestId: 'wallet_alice', expectedRevision: 0, command: { type: 'acknowledgeWallet' } };
  const alice = store.execute('alice', aliceRequest);
  assert.equal(alice.progress.coins, 20);
  assert.equal(alice.progress.walletCompleted, true);
  assert.equal(alice.walletCoinRewardClaimed, true);
  const bobRequest = { requestId: 'wallet_bob', expectedRevision: 0, command: { type: 'acknowledgeWallet' } };
  const bob = store.execute('bob', bobRequest);
  assert.equal(bob.progress.coins, 27);
  assert.equal(bob.walletCoinRewardClaimed, true);
  assert.deepEqual(store.execute('bob', bobRequest), bob);
  assert.throws(() => store.execute('bob', { ...bobRequest, requestId: 'wallet_bob_again', expectedRevision: 1 }), /ACTION_UNAVAILABLE/);
  assert.equal(store.load('bob').progress.coins, 27);
  assert.equal(store.audit('bob').length, 1);
  store.close();
  assert.equal(open().load('bob').walletCoinRewardClaimed, true);
  db.close();
});
test('wallet grant and its receipt roll back together on ledger failure', t => {
  const { store, path } = fixture(t);
  const db = new DatabaseSync(path);
  db.exec('CREATE TABLE wallet_links (wallet TEXT PRIMARY KEY, player_id TEXT UNIQUE)');
  db.prepare('INSERT INTO wallet_links VALUES (?, ?)').run('test_wallet', 'alice');
  const progress = store.load('alice').progress;
  db.prepare('UPDATE players SET progress = ? WHERE id = ?').run(JSON.stringify({ ...progress, harvested: 20 }), 'alice');
  db.exec("CREATE TRIGGER fail_wallet_event BEFORE INSERT ON economy_events BEGIN SELECT RAISE(ABORT, 'INJECTED_FAILURE'); END");
  const command = { requestId: 'wallet_rollback', expectedRevision: 0, command: { type: 'acknowledgeWallet' } };
  assert.throws(() => store.execute('alice', command), /INJECTED_FAILURE/);
  assert.equal(store.load('alice').progress.coins, 0);
  assert.equal(store.load('alice').walletCoinRewardClaimed, false);
  assert.equal(db.prepare('SELECT count(*) AS count FROM wallet_coin_grants').get().count, 0);
  db.exec('DROP TRIGGER fail_wallet_event');
  assert.equal(store.execute('alice', command).progress.coins, 20);
  db.close();
});
