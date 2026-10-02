import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openGameStore } from './sqlite-store.mjs';
import { parseRequest } from './game-service.ts';
import { initialProgress, xpFloor, treeHealth } from '../src/game/progression.ts';

function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-trail-'));
  const path = join(folder, 'test.sqlite');
  let store = openGameStore(path);
  store.createPlayer('alice');
  const db = new DatabaseSync(path);
  const state = { ...initialProgress('ko'), treeLevel: 25, treeHp: treeHealth(25), axeLevel: 25, xp: xpFloor(5),
    harvested: 1000, walletCompleted: true, firstRecordClaimed: true, skinQuestHarvestStart: 900,
    growthRewardClaimed: true, rewardOption: 'low:damage', gemSlotQuestDone: true,
    slots: ['low:damage', 'low:damage'], adventureClaimed: 3 };
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify(state), 'alice');
  t.after(() => { db.close(); store.close(); rmSync(folder, { recursive: true, force: true }); });
  return { db, store, reopen: () => { store.close(); store = openGameStore(path); return store; } };
}
const request = (stage = 0, expectedRevision = 0, requestId = 'forest_trail_0') =>
  ({ requestId, expectedRevision, command: { type: 'claimForestTrail', stage } });
test('server trail reward is authoritative, idempotent, stage-bound and survives restart', t => {
  const f = fixture(t);
  assert.throws(() => f.store.execute('alice', request(1)), /ACTION_UNAVAILABLE/);
  const result = f.store.execute('alice', request());
  assert.equal(result.progress.coins, 150);
  assert.equal(result.progress.forestTrailClaimed, 1);
  assert.equal(result.progress.adventureClaimed, 3);
  assert.deepEqual(f.store.execute('alice', request()), result);
  assert.throws(() => f.store.execute('alice', request(1)), /REQUEST_ID_REUSED/);
  assert.throws(() => f.store.execute('alice', request(0, 1, 'forest_again')), /ACTION_UNAVAILABLE/);
  assert.throws(() => f.store.execute('alice', request(1, 0, 'forest_stale')), /REVISION_CONFLICT/);
  const reopened = f.reopen();
  assert.deepEqual(reopened.execute('alice', request()), result);
  assert.equal(reopened.load('alice').progress.coins, 150);
  assert.equal(reopened.audit('alice').length, 1);
});
test('trail reward rolls back with receipt and audit on transaction failure', t => {
  const f = fixture(t);
  const before = f.store.load('alice');
  f.db.exec("CREATE TRIGGER reject_trail BEFORE INSERT ON economy_events BEGIN SELECT RAISE(ABORT, 'TRAIL_TEST_FAILURE'); END;");
  assert.throws(() => f.store.execute('alice', request()), /TRAIL_TEST_FAILURE/);
  assert.deepEqual(f.store.load('alice').progress, before.progress);
  assert.equal(f.store.load('alice').revision, before.revision);
  f.db.exec('DROP TRIGGER reject_trail');
  assert.equal(f.store.execute('alice', request()).progress.coins, 150);
});
test('trail command accepts only an index, never client reward values', () => {
  for (const stage of [-1, 10, 0.5, '0', null]) assert.throws(() => parseRequest(request(stage)), /INVALID_COMMAND/);
  for (const extra of [{ coins: 1000 }, { treeLevel: 25 }, { gems: { high: 1 } }])
    assert.throws(() => parseRequest({ ...request(), command: { ...request().command, ...extra } }), /INVALID_COMMAND/);
});
