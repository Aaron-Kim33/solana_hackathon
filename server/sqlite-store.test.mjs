import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openGameStore } from './sqlite-store.mjs';
import { initialProgress, xpFloor, treeHealth, questSteps } from '../src/game/progression.ts';

const request = { requestId: 'persist_001', expectedRevision: 0, command: { type: 'fuse', tier: 'low' } };
function fixture(t, roll = 0) {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-db-test-'));
  const path = join(folder, 'test.sqlite');
  const stores = [];
  t.after(() => { for (const s of stores) { try { s.close(); } catch {} } rmSync(folder, { recursive: true, force: true }); });
  const open = () => { const s = openGameStore(path, { random: () => roll }); stores.push(s); return s; };
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
test('server growth reward, gem opening and slot quest are atomic, single-use and persistent', t => {
  const { store, open, path } = fixture(t);
  const eligible = { ...initialProgress('ko'), harvested: 100, xp: xpFloor(5), axeLevel: 15,
    treeLevel: 10, treeHp: treeHealth(10), walletCompleted: true,
    receipt: { address: 'test', signature: 'test', status: 'confirmed' },
    firstRecordClaimed: true, axeSkin: 'firstRecord', skinQuestHarvestStart: 0 };
  const db = new DatabaseSync(path);
  db.prepare('UPDATE players SET progress = ? WHERE id = ?').run(JSON.stringify(eligible), 'alice');
  db.close();
  assert.equal(questSteps(store.load('alice').progress)[10], 'active');
  const claim = { requestId: 'growth_claim', expectedRevision: 0, command: { type: 'claimGrowthReward' } };
  const claimed = store.execute('alice', claim);
  assert.equal(claimed.progress.gems.low, 1);
  assert.deepEqual(store.execute('alice', claim), claimed);
  assert.throws(() => store.execute('alice', { ...claim, requestId: 'growth_again', expectedRevision: 1 }), /ACTION_UNAVAILABLE/);
  assert.throws(() => store.execute('alice', { ...claim, requestId: 'growth_bad', expectedRevision: 1, command: { type: 'openGem', tier: 'low', item: 'low:damage' } }), /INVALID_COMMAND/);
  const opened = store.execute('alice', { requestId: 'growth_open', expectedRevision: 1, command: { type: 'openGem', tier: 'low' } });
  assert.equal(opened.progress.gems.low, 0);
  assert.deepEqual(opened.progress.inventory, ['low:damage']);
  assert.equal(opened.progress.rewardOption, 'low:damage');
  assert.throws(() => store.execute('alice', { requestId: 'growth_wrong_slot', expectedRevision: 2,
    command: { type: 'equipOption', slot: 1, item: 'low:damage' } }), /ACTION_UNAVAILABLE/);
  const equip = { requestId: 'growth_equip', expectedRevision: 2, command: { type: 'equipOption', slot: 0, item: 'low:damage' } };
  const equipped = store.execute('alice', equip);
  assert.deepEqual(equipped.progress.slots, ['low:damage', null]);
  assert.deepEqual(equipped.progress.inventory, []);
  assert.equal(equipped.progress.gemSlotQuestDone, true);
  store.close();
  const reopened = open();
  assert.deepEqual(reopened.execute('alice', equip), equipped);
  assert.equal(questSteps(reopened.load('alice').progress)[12], 'complete');
  assert.equal(reopened.audit('alice').length, 3);
  assert.equal(reopened.load('bob').progress.growthRewardClaimed, false);
});
test('Deepwood mastery claim is server-owned, single-use and survives reopening', t => {
  const { store, open, path } = fixture(t);
  const eligible = { ...initialProgress('ko'), treeLevel: 101, treeHp: treeHealth(101),
    axeSkin: 'warden', axeLevel: 150 };
  const db = new DatabaseSync(path);
  db.prepare('UPDATE players SET progress = ? WHERE id = ?').run(JSON.stringify(eligible), 'alice');
  db.close();
  const claim = { requestId: 'warden_claim_1', expectedRevision: 0, command: { type: 'claimWardenReward' } };
  const claimed = store.execute('alice', claim);
  assert.equal(claimed.progress.wardenRewardsClaimed, 1);
  assert.equal(claimed.progress.gems.high, 1);
  assert.deepEqual(store.execute('alice', claim), claimed);
  assert.throws(() => store.execute('alice', { ...claim, requestId: 'warden_claim_2', expectedRevision: 1 }), /ACTION_UNAVAILABLE/);
  assert.equal(store.audit('alice').length, 1);
  store.close();
  const reopened = open();
  assert.deepEqual(reopened.execute('alice', claim), claimed);
  assert.equal(reopened.load('alice').progress.gems.high, 1);
  assert.equal(reopened.load('bob').progress.wardenRewardsClaimed ?? 0, 0);
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

test('server wood draw and gem fusion spend once, return outcomes, and persist across restart', t => {
  const { store, open, path } = fixture(t, 0.97);
  const db = new DatabaseSync(path);
  const seeded = { ...store.load('alice').progress, wood: 20000, harvested: 20000, gems: { low: 6, medium: 3, high: 3, supreme: 3, legendary: 0 } };
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify(seeded), 'alice');
  db.close();
  const draw = { requestId: 'draw_high_01', expectedRevision: 0, command: { type: 'drawGem' } };
  const drawn = store.execute('alice', draw);
  assert.equal(drawn.progress.wood, 10000);
  assert.equal(drawn.progress.gems.high, 4);
  assert.deepEqual(store.execute('alice', draw), drawn);
  assert.throws(() => store.execute('alice', { ...draw, requestId: 'draw_stale_02' }), /REVISION_CONFLICT/);
  const fuse = { requestId: 'fuse_high_03', expectedRevision: 1, command: { type: 'fuse', tier: 'high' } };
  const failed = store.execute('alice', fuse);
  assert.equal(failed.progress.gems.high, 1);
  assert.equal(failed.progress.gems.supreme, 3);
  assert.deepEqual(store.execute('alice', fuse), failed);
  assert.throws(() => store.execute('alice', { ...fuse, requestId: 'fuse_invalid_04', expectedRevision: 2 }), /ACTION_UNAVAILABLE/);
  store.close();
  const reopened = open();
  assert.deepEqual(reopened.execute('alice', draw), drawn);
  assert.equal(reopened.load('alice').progress.wood, 10000);
  assert.equal(reopened.load('alice').progress.gems.high, 1);
  assert.equal(reopened.audit('alice').length, 2);
  assert.equal(reopened.load('bob').progress.wood, 10);
});

test('every gem tier opens once per request and equipped options cannot be recovered by replacement', t => {
  const { store, open, path } = fixture(t, 0.7);
  const tiers = ['low', 'medium', 'high', 'supreme', 'legendary'];
  const db = new DatabaseSync(path);
  const seeded = store.load('alice').progress;
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify({ ...seeded,
    gems: Object.fromEntries(tiers.map(tier => [tier, 2])) }), 'alice');
  db.close();
  let revision = 0;
  for (const tier of tiers) {
    const before = store.load('alice').progress;
    const command = { requestId: `open_${tier}_01`, expectedRevision: revision, command: { type: 'openGem', tier } };
    const opened = store.execute('alice', command);
    assert.equal(opened.progress.gems[tier], before.gems[tier] - 1);
    assert.equal(opened.progress.inventory.filter(item => item === `${tier}:critDamage`).length, 1);
    assert.deepEqual(store.execute('alice', command), opened);
    assert.throws(() => store.execute('alice', { ...command, requestId: `stale_${tier}_01` }), /REVISION_CONFLICT/);
    revision++;
  }
  const first = store.execute('alice', { requestId: 'equip_low_01', expectedRevision: revision++,
    command: { type: 'equipOption', slot: 0, item: 'low:critDamage' } });
  assert.equal(first.progress.slots[0], 'low:critDamage');
  assert.equal(first.progress.inventory.includes('low:critDamage'), false);
  const replaced = store.execute('alice', { requestId: 'equip_medium_01', expectedRevision: revision++,
    command: { type: 'equipOption', slot: 0, item: 'medium:critDamage' } });
  assert.equal(replaced.progress.slots[0], 'medium:critDamage');
  assert.equal(replaced.progress.inventory.includes('low:critDamage'), false);
  assert.equal(replaced.progress.inventory.includes('medium:critDamage'), false);
  store.close();
  const reopened = open();
  assert.equal(reopened.load('alice').revision, revision);
  assert.equal(reopened.load('alice').progress.inventory.length, 3);
  assert.equal(reopened.audit('alice').length, revision);
  assert.equal(reopened.load('bob').progress.gems.low, 6);
});

test('server fusion success and failed ledger write have no partial resource changes', t => {
  const { store, path } = fixture(t);
  const db = new DatabaseSync(path);
  const progress = store.load('alice').progress;
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify({ ...progress, wood: 10000, harvested: 10000 }), 'alice');
  const fuse = { requestId: 'fuse_low_01', expectedRevision: 0, command: { type: 'fuse', tier: 'low' } };
  const fused = store.execute('alice', fuse);
  assert.equal(fused.progress.gems.low, 3);
  assert.equal(fused.progress.gems.medium, 1);
  db.exec("CREATE TRIGGER fail_gem_event BEFORE INSERT ON economy_events BEGIN SELECT RAISE(ABORT, 'INJECTED_FAILURE'); END;");
  const draw = { requestId: 'draw_rollback_02', expectedRevision: 1, command: { type: 'drawGem' } };
  assert.throws(() => store.execute('alice', draw), /INJECTED_FAILURE/);
  assert.equal(store.load('alice').progress.wood, 10000);
  assert.equal(store.load('alice').progress.gems.low, 3);
  assert.equal(store.audit('alice').length, 1);
  assert.equal(db.prepare('SELECT count(*) AS count FROM commands').get().count, 1);
  db.exec('DROP TRIGGER fail_gem_event'); db.close();
  const drawn = store.execute('alice', draw);
  assert.equal(drawn.progress.wood, 0);
  assert.equal(drawn.progress.gems.low, 4);
});
