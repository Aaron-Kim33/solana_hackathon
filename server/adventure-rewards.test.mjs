import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openGameStore } from './sqlite-store.mjs';
import { parseRequest } from './game-service.ts';
import { initialProgress, xpFloor, treeHealth, pioneerOwned, axeLevelFor } from '../src/game/progression.ts';

function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-adventure-'));
  const path = join(folder, 'test.sqlite');
  const stores = [];
  const open = () => { const store = openGameStore(path); stores.push(store); return store; };
  const store = open(); store.createPlayer('alice'); store.createPlayer('bob');
  const db = new DatabaseSync(path);
  t.after(() => { db.close(); for (const s of stores) { try { s.close(); } catch {} } rmSync(folder, { recursive: true, force: true }); });
  const seed = changes => db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify({
    ...initialProgress('ko'), treeLevel: 50, treeHp: treeHealth(50), axeLevel: 25, xp: xpFloor(10),
    harvested: 1000, walletCompleted: true, receipt: { address: 'test', signature: 'test', status: 'confirmed' },
    firstRecordClaimed: true, skinQuestHarvestStart: 900, growthRewardClaimed: true,
    rewardOption: 'low:damage', gemSlotQuestDone: true, slots: ['low:damage', 'low:damage'], ...changes,
  }), 'alice');
  seed({});
  return { store, open, db, seed };
}
const request = (stage, revision = stage, requestId = `adventure_${stage}`) => ({ requestId, expectedRevision: revision, command: { type: 'claimAdventure', stage } });

test('server adventure rewards unlock pioneer once and survive restart', t => {
  const { store, open } = fixture(t);
  assert.throws(() => store.execute('alice', request(3, 0)), /ACTION_UNAVAILABLE/);
  const first = store.execute('alice', request(0));
  assert.equal(first.progress.gems.low, 1);
  assert.deepEqual(store.execute('alice', request(0)), first);
  assert.throws(() => store.execute('alice', request(0, 1, 'double_claim')), /ACTION_UNAVAILABLE/);
  assert.throws(() => store.execute('alice', request(1, 0, 'stale_claim')), /REVISION_CONFLICT/);
  assert.throws(() => store.execute('alice', request(1, 0, 'adventure_0')), /REQUEST_ID_REUSED/);
  assert.equal(store.execute('alice', request(1)).progress.coins, 300);
  assert.equal(store.execute('alice', request(2)).progress.gems.medium, 1);
  const pioneer = store.execute('alice', request(3));
  assert.equal(pioneer.progress.coins, 1200);
  assert.equal(pioneerOwned(pioneer.progress), true);
  store.close();
  const reopened = open();
  assert.deepEqual(reopened.execute('alice', request(3)), pioneer);
  assert.equal(reopened.audit('alice').length, 4);
  assert.equal(reopened.load('bob').progress.adventureClaimed, 0);
  assert.throws(() => reopened.execute('alice', request(4)), /ACTION_UNAVAILABLE/);
  const equipped = reopened.execute('alice', { requestId: 'equip_pioneer', expectedRevision: 4, command: { type: 'equipAxe', skin: 'pioneer' } });
  assert.equal(equipped.progress.axeSkin, 'pioneer');
  assert.equal(axeLevelFor(equipped.progress, 'pioneer'), 1);
});

test('server validates prerequisites and rolls back reward, receipt and audit together', t => {
  const { store, db, seed } = fixture(t);
  for (const changes of [{ treeLevel: 14, treeHp: treeHealth(14) }, { walletCompleted: false }, { gemSlotQuestDone: false }]) {
    seed(changes);
    assert.throws(() => store.execute('alice', request(0)), /ACTION_UNAVAILABLE/);
    assert.equal(store.load('alice').revision, 0);
  }
  seed({});
  db.exec("CREATE TRIGGER fail_event BEFORE INSERT ON economy_events BEGIN SELECT RAISE(ABORT, 'INJECTED_FAILURE'); END;");
  assert.throws(() => store.execute('alice', request(0)), /INJECTED_FAILURE/);
  assert.equal(store.load('alice').progress.adventureClaimed, 0);
  assert.equal(store.load('alice').progress.gems.low, 0);
  assert.equal(store.audit('alice').length, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM commands').get().n, 0);
  db.exec('DROP TRIGGER fail_event');
  assert.equal(store.execute('alice', request(0)).progress.adventureClaimed, 1);
});

test('third adventure reward requires tree 20 and an owned axe at level 25', t => {
  const { store, seed } = fixture(t);
  seed({ adventureClaimed: 2, treeLevel: 19, treeHp: treeHealth(19), axeLevel: 25 });
  assert.throws(() => store.execute('alice', request(2, 0, 'too_small_tree')), /ACTION_UNAVAILABLE/);
  seed({ adventureClaimed: 2, treeLevel: 20, treeHp: treeHealth(20), axeLevel: 24 });
  assert.throws(() => store.execute('alice', request(2, 0, 'too_small_axe')), /ACTION_UNAVAILABLE/);
  seed({ adventureClaimed: 2, treeLevel: 20, treeHp: treeHealth(20), axeLevel: 25 });
  assert.equal(store.execute('alice', request(2, 0, 'new_boundary')).progress.gems.medium, 1);
});

test('adventure commands reject invalid stage and client-selected reward', () => {
  for (const stage of [-1, 6, 0.5, '0', null, undefined]) assert.throws(() => parseRequest(request(stage)), /INVALID_COMMAND/);
  assert.throws(() => parseRequest({ ...request(0), command: { type: 'claimAdventure', stage: 0, coins: 900 } }), /INVALID_COMMAND/);
});

test('pioneer training and final adventure require their own conditions', t => {
  const { store, seed } = fixture(t);
  seed({ adventureClaimed: 4 });
  assert.throws(() => store.execute('alice', request(4, 0)), /ACTION_UNAVAILABLE/);
  seed({ adventureClaimed: 4, axeSkin: 'pioneer', axeLevel: 9, unequippedAxeLevels: { default: 20 } });
  assert.throws(() => store.execute('alice', request(4, 0)), /ACTION_UNAVAILABLE/);
  seed({ adventureClaimed: 4, axeSkin: 'pioneer', axeLevel: 10, unequippedAxeLevels: { default: 20 } });
  assert.equal(store.execute('alice', request(4, 0)).progress.coins, 1000);
  assert.throws(() => store.execute('alice', request(5, 1)), /ACTION_UNAVAILABLE/);
  seed({ adventureClaimed: 5, treeLevel: 100, treeHp: treeHealth(100), xp: xpFloor(20), unequippedAxeLevels: { pioneer: 10 } });
  const final = store.execute('alice', request(5, 1));
  assert.equal(final.progress.adventureClaimed, 6);
  assert.equal(final.progress.gems.high, 1);
  assert.throws(() => store.execute('alice', request(5, 2, 'final_again')), /ACTION_UNAVAILABLE/);
});
