import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openGameStore } from './sqlite-store.mjs';
import { parseRequest } from './game-service.ts';
import { initialProgress, xpFloor, treeHealth, fatiguePotionCount } from '../src/game/progression.ts';

function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-potion-')), path = join(folder, 'test.sqlite');
  let store = openGameStore(path, { now: () => 2000 });
  store.createPlayer('alice'); store.createPlayer('bob');
  const db = new DatabaseSync(path);
  const state = { ...initialProgress('ko'), treeLevel: 20, treeHp: treeHealth(20), axeLevel: 25,
    xp: xpFloor(5), harvested: 1000, walletCompleted: true, firstRecordClaimed: true, skinQuestHarvestStart: 900,
    growthRewardClaimed: true, rewardOption: 'low:damage', gemSlotQuestDone: true,
    slots: ['low:damage', 'low:damage'], adventureClaimed: 1, fatigue: 100, recoveryAt: 1000 };
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify(state), 'alice');
  t.after(() => { db.close(); store.close(); rmSync(folder, { recursive: true, force: true }); });
  return { get store() { return store; }, db, reopen() { store.close(); store = openGameStore(path, { now: () => 2000 }); } };
}
const use = (revision, requestId = 'use_potion_1') => ({ requestId, expectedRevision: revision, command: { type: 'useFatiguePotion' } });

test('server earns then consumes once; request replay and restart never double-spend or replenish', t => {
  const f = fixture(t);
  assert.throws(() => f.store.execute('alice', use(0)), /ACTION_UNAVAILABLE/);
  const claimed = f.store.execute('alice', { requestId: 'quest_slot_2', expectedRevision: 0, command: { type: 'claimAdventure', stage: 1 } });
  assert.equal(fatiguePotionCount(claimed.progress), 1);
  const consumed = f.store.execute('alice', use(claimed.revision));
  assert.equal(consumed.progress.fatigue, 0);
  assert.equal(consumed.progress.recoveryAt, null);
  assert.equal(fatiguePotionCount(consumed.progress), 0);
  f.reopen();
  assert.deepEqual(f.store.execute('alice', use(claimed.revision)), consumed);
  assert.equal(fatiguePotionCount(f.store.load('alice').progress), 0);
  assert.throws(() => f.store.execute('alice', use(consumed.revision, 'another_use')), /ACTION_UNAVAILABLE/);
  assert.throws(() => f.store.execute('bob', use(0, 'bob_use_potion')), /ACTION_UNAVAILABLE/);
  assert.equal(f.store.audit('alice').length, 2);
});

test('potion spend, fatigue reset, command receipt and audit roll back together', t => {
  const f = fixture(t);
  const claimed = f.store.execute('alice', { requestId: 'quest_slot_2', expectedRevision: 0, command: { type: 'claimAdventure', stage: 1 } });
  f.db.exec("CREATE TRIGGER fail_potion BEFORE INSERT ON economy_events BEGIN SELECT RAISE(ABORT, 'TEST_FAILURE'); END");
  assert.throws(() => f.store.execute('alice', use(claimed.revision)), /TEST_FAILURE/);
  assert.equal(f.store.load('alice').progress.fatigue, 100);
  assert.equal(fatiguePotionCount(f.store.load('alice').progress), 1);
  assert.equal(f.store.audit('alice').length, 1);
  f.db.exec('DROP TRIGGER fail_potion');
  assert.equal(f.store.execute('alice', use(claimed.revision)).progress.fatigue, 0);
});

test('potion command never accepts client-provided count, fatigue or item grants', () => {
  assert.equal(parseRequest(use(0)).command.type, 'useFatiguePotion');
  for (const patch of [{ count: 10 }, { fatigue: 0 }, { fatiguePotionsUsed: 0 }, { grant: 1 }]) {
    assert.throws(() => parseRequest({ ...use(0), command: { type: 'useFatiguePotion', ...patch } }), /INVALID_COMMAND/);
  }
});
