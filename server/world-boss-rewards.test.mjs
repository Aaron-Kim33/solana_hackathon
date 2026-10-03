import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openGameStore } from './sqlite-store.mjs';
import { parseRequest } from './game-service.ts';
import { fatiguePotionCount, parseProgress, treeHealth } from '../src/game/progression.ts';
import { worldBossWeekStart } from '../src/shared/world-boss.ts';

function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-boss-rewards-')), path = join(folder, 'game.sqlite');
  let clock = Date.UTC(2026, 8, 28, 12), store = openGameStore(path, { now: () => clock, random: () => .99 });
  store.createPlayer('alice'); store.createPlayer('bob');
  const db = new DatabaseSync(path);
  t.after(() => { db.close(); store.close(); rmSync(folder, { recursive: true, force: true }); });
  let serial = 0;
  const request = (command, player = 'alice') => ({ requestId: `reward_test_${++serial}`, expectedRevision: store.load(player).revision, command });
  return { db, get store() { return store; }, get clock() { return clock; },
    advance(ms) { clock += ms; }, request,
    execute(command, player = 'alice') { return store.execute(player, request(command, player)); },
    hit(count) { for (let i = 0; i < count; i++) { clock += 2000; store.execute('alice', request({ type: 'hitWorldBoss' })); } },
    reopen() { store.close(); store = openGameStore(path, { now: () => clock, random: () => .99 }); },
    tree(level) { const progress = store.load('alice').progress; db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify({ ...progress, treeLevel: level, treeHp: treeHealth(level) }), 'alice'); } };
}

test('boss rewards unlock at 20/50/100, fix coins at first hit and persist each claim once', t => {
  const f = fixture(t); f.tree(20);
  const weekStart = worldBossWeekStart(f.clock);
  const claim = stage => ({ type: 'claimWorldBossReward', weekStart, stage });
  assert.throws(() => f.execute(claim(0)), /ACTION_UNAVAILABLE/);
  f.hit(1); f.tree(30); f.hit(18);
  assert.equal(f.store.load('alice').worldBoss.rewardTreeLevel, 20);
  assert.throws(() => f.execute(claim(0)), /ACTION_UNAVAILABLE/);
  f.hit(1);
  const lowBefore = f.store.load('alice').progress.gems.low;
  const first = f.request(claim(0));
  const result = f.store.execute('alice', first);
  assert.equal(result.progress.gems.low, lowBefore + 1);
  f.reopen(); assert.deepEqual(f.store.execute('alice', first), result);
  assert.throws(() => f.execute(claim(0)), /ACTION_UNAVAILABLE/);
  assert.throws(() => f.store.execute('bob', f.request(claim(0), 'bob')), /ACTION_UNAVAILABLE/);
  f.hit(29); assert.throws(() => f.execute(claim(1)), /ACTION_UNAVAILABLE/);
  f.hit(1); const coinsBefore = f.store.load('alice').progress.coins;
  assert.equal(f.execute(claim(1)).progress.coins, coinsBefore + 400);
  f.hit(49); assert.throws(() => f.execute(claim(2)), /ACTION_UNAVAILABLE/);
  f.hit(1);
  const potion = f.execute(claim(2));
  assert.equal(potion.progress.fatigue, 100); // Receiving is not using.
  assert.equal(fatiguePotionCount(potion.progress), 1);
  assert.deepEqual(parseProgress(JSON.stringify(potion.progress)), potion.progress);
  const consumed = f.execute({ type: 'useFatiguePotion' });
  assert.equal(consumed.progress.fatigue, 0);
  assert.equal(fatiguePotionCount(consumed.progress), 0);
  assert.throws(() => f.execute(claim(2)), /ACTION_UNAVAILABLE/);
  f.advance(2000); assert.throws(() => f.execute({ type: 'hitWorldBoss' }), /ACTION_UNAVAILABLE/);
  assert.equal(f.store.load('alice').worldBoss.rewards.filter(item => item.claimed).length, 3);
});

test('earned unclaimed rewards survive reset; new week has its own first-hit quote and grants', t => {
  const f = fixture(t); f.tree(10); f.hit(50);
  const previousWeek = worldBossWeekStart(f.clock);
  f.advance(7 * 86400000); f.tree(25);
  const currentWeek = worldBossWeekStart(f.clock);
  assert.equal(f.store.load('alice').worldBoss.hits, 0);
  assert.equal(f.store.load('alice').worldBoss.rewardTreeLevel, null);
  const oldCoins = f.store.load('alice').progress.coins;
  const claim = { type: 'claimWorldBossReward', weekStart: previousWeek, stage: 1 };
  const request = f.request(claim);
  assert.equal(f.store.execute('alice', request).progress.coins, oldCoins + 200);
  assert.throws(() => f.store.execute('alice', { ...request, command: { ...claim, weekStart: currentWeek } }), /REQUEST_ID_REUSED/);
  f.hit(50);
  assert.equal(f.store.load('alice').worldBoss.rewardTreeLevel, 25);
  assert.equal(f.execute({ ...claim, weekStart: currentWeek }).progress.coins, oldCoins + 700);
});

test('claim receipt, inventory, audit and claim marker roll back atomically; overflow does not grant', t => {
  const f = fixture(t); f.hit(20);
  const command = { type: 'claimWorldBossReward', weekStart: worldBossWeekStart(f.clock), stage: 0 };
  const before = f.store.load('alice'), request = f.request(command);
  f.db.exec("CREATE TRIGGER fail_boss_reward BEFORE INSERT ON economy_events BEGIN SELECT RAISE(ABORT, 'TEST_FAILURE'); END");
  assert.throws(() => f.store.execute('alice', request), /TEST_FAILURE/);
  assert.deepEqual(f.store.load('alice'), before);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM world_boss_reward_claims').get().n, 0);
  f.db.exec('DROP TRIGGER fail_boss_reward');
  const progress = { ...before.progress, gems: { ...before.progress.gems, low: Number.MAX_SAFE_INTEGER } };
  f.db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify(progress), 'alice');
  assert.throws(() => f.store.execute('alice', request), /RESOURCE_OVERFLOW/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM world_boss_reward_claims').get().n, 0);
  f.db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify(before.progress), 'alice');
  assert.equal(f.store.execute('alice', request).worldBoss.rewards[0].claimed, true);
});

test('legacy v7 migration preserves attacks and freezes existing participants at migration level', t => {
  const f = fixture(t); f.tree(15); f.hit(20);
  const before = f.store.load('alice');
  f.db.exec('DROP TABLE world_boss_reward_claims; DROP TABLE world_boss_reward_weeks; PRAGMA user_version=7;');
  f.reopen();
  const after = f.store.load('alice');
  assert.deepEqual(after.progress, before.progress);
  assert.equal(after.worldBoss.hits, 20);
  assert.equal(after.worldBoss.rewardTreeLevel, 15);
  f.tree(40); f.reopen();
  assert.equal(f.store.load('alice').worldBoss.rewardTreeLevel, 15);
  assert.equal(f.execute({ type: 'claimWorldBossReward', weekStart: before.worldBoss.weekStart, stage: 0 }).progress.gems.low, before.progress.gems.low + 1);
});

test('boss reward payload rejects forged rewards, invalid stages and malformed weeks', () => {
  const valid = { requestId: 'boss_reward_1', expectedRevision: 0, command: { type: 'claimWorldBossReward', weekStart: 0, stage: 0 } };
  assert.deepEqual(parseRequest(valid), valid);
  for (const patch of [{ stage: -1 }, { stage: 3 }, { stage: .5 }, { weekStart: '0' }, { weekStart: .5 }, { coins: 9999 }, { treeLevel: 999 }, { playerId: 'bob' }])
    assert.throws(() => parseRequest({ ...valid, command: { ...valid.command, ...patch } }), /INVALID_COMMAND/);
});

test('optional earned potion counter validates saves without changing legacy inventories', t => {
  const f = fixture(t), state = f.store.load('alice').progress;
  assert.equal(fatiguePotionCount(state), 0);
  for (const value of [-1, .5, '1', null]) assert.throws(() => parseProgress(JSON.stringify({ ...state, bossFatiguePotionsEarned: value })), /INVALID_SAVE/);
  const earned = { ...state, bossFatiguePotionsEarned: 2, fatiguePotionsUsed: 1 };
  assert.equal(fatiguePotionCount(parseProgress(JSON.stringify(earned))), 1);
  assert.throws(() => parseProgress(JSON.stringify({ ...earned, fatiguePotionsUsed: 3 })), /INVALID_SAVE/);
});
