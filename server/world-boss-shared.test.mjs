import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openGameStore } from './sqlite-store.mjs';
import { parseRequest } from './game-service.ts';
import { nextWorldBossSharedBase, worldBossWeekStart } from '../src/shared/world-boss.ts';

function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-shared-boss-')), path = join(folder, 'game.sqlite');
  let clock = Date.UTC(2026, 8, 28, 12), store = openGameStore(path, { now: () => clock, random: () => .99 });
  const db = new DatabaseSync(path);
  for (const player of ['alice', 'bob', 'eve']) store.createPlayer(player);
  let serial = 0;
  const request = (player, command) => ({ requestId: `shared_boss_${++serial}`, expectedRevision: store.load(player).revision, command });
  for (const player of ['alice', 'bob']) store.execute(player, request(player, { type: 'hitWorldBoss' }));
  const week = worldBossWeekStart(clock);
  // Fixtures only: control recorded damage to exercise exact community thresholds.
  const damage = total => {
    db.prepare('UPDATE world_boss_hits SET hits=20,damage=100 WHERE player_id=? AND week_start=?').run('alice', week);
    db.prepare('UPDATE world_boss_hits SET hits=19,damage=? WHERE player_id=? AND week_start=?').run(total - 100, 'bob', week);
  };
  t.after(() => { db.close(); store.close(); rmSync(folder, { recursive: true, force: true }); });
  return { db, week, damage, request, get store() { return store; }, advance(ms) { clock += ms; },
    execute(player, command) { return store.execute(player, request(player, command)); },
    reopen() { store.close(); store = openGameStore(path, { now: () => clock, random: () => .99 }); } };
}
const claim = (weekStart, stage) => ({ type: 'claimWorldBossSharedReward', weekStart, stage });

test('community thresholds and 20-hit eligibility grant equal cumulative rewards, independent of individual damage', t => {
  const f = fixture(t); f.damage(9999);
  assert.deepEqual(f.store.load('alice').worldBoss.sharedRewards.map(r => r.target), [10000, 20000, 30000]);
  assert.throws(() => f.execute('alice', claim(f.week, 0)), /ACTION_UNAVAILABLE/);
  f.damage(10000);
  assert.throws(() => f.execute('bob', claim(f.week, 0)), /ACTION_UNAVAILABLE/);
  assert.throws(() => f.execute('eve', claim(f.week, 0)), /ACTION_UNAVAILABLE/);
  const before = f.store.load('alice');
  const request = f.request('alice', claim(f.week, 0));
  const first = f.store.execute('alice', request);
  assert.equal(first.progress.gems.low, before.progress.gems.low + 1);
  f.reopen(); assert.deepEqual(f.store.execute('alice', request), first);
  assert.throws(() => f.execute('alice', claim(f.week, 0)), /ACTION_UNAVAILABLE/);
  assert.throws(() => f.store.execute('alice', { ...request, command: claim(f.week, 1) }), /REQUEST_ID_REUSED/);
  f.db.prepare('UPDATE world_boss_hits SET hits=20 WHERE player_id=?').run('bob');
  const bobBefore = f.store.load('bob');
  assert.equal(f.execute('bob', claim(f.week, 0)).progress.gems.low, bobBefore.progress.gems.low + 1);
  f.damage(19999); assert.throws(() => f.execute('alice', claim(f.week, 1)), /ACTION_UNAVAILABLE/);
  f.damage(20000); f.execute('alice', claim(f.week, 1));
  f.damage(29999); assert.throws(() => f.execute('alice', claim(f.week, 2)), /ACTION_UNAVAILABLE/);
  f.damage(30000); const all = f.execute('alice', claim(f.week, 2));
  assert.equal(all.progress.gems.low, before.progress.gems.low + 3);
  assert.equal(all.progress.gems.medium, before.progress.gems.medium + 1);
  assert.equal(all.progress.coins, before.progress.coins);
  assert.equal(all.progress.fatigue, before.progress.fatigue);
  assert.equal(all.worldBoss.hits, 20);
  assert.equal(all.worldBoss.rewards[0].claimed, false); // Personal reward is separate.
});

test('targets change at most 25 percent with a floor; high current-week damage never moves a fixed target', t => {
  assert.equal(nextWorldBossSharedBase(0, 10000), 10000);
  assert.equal(nextWorldBossSharedBase(1e6, 10000), 12500);
  assert.equal(nextWorldBossSharedBase(0, 20000), 15000);
  assert.equal(nextWorldBossSharedBase(44000, 20000), 22000);
  const f = fixture(t); f.damage(100000);
  assert.equal(f.store.load('alice').worldBoss.sharedRewards[0].target, 10000);
  f.advance(7 * 86400000);
  const newWeek = f.week + 7 * 86400000;
  assert.equal(f.store.load('alice').worldBoss.sharedRewards[0].target, 12500);
  // Viewing a new week must not write goal rows or change account revision.
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM world_boss_shared_weeks WHERE week_start=?').get(newWeek).n, 0);
  f.execute('alice', { type: 'hitWorldBoss' });
  assert.equal(f.db.prepare('SELECT base_target FROM world_boss_shared_weeks WHERE week_start=?').get(newWeek).base_target, 12500);
  f.damage(100); f.reopen();
  assert.equal(f.store.load('alice').worldBoss.sharedRewards[0].target, 12500);
});

test('past eligible unclaimed shared rewards remain claimable; past nonparticipants cannot use this week hits', t => {
  const f = fixture(t); f.damage(30000);
  const before = f.store.load('alice').progress;
  f.advance(7 * 86400000); f.reopen();
  assert.equal(f.store.load('alice').worldBoss.hits, 0);
  const old = f.store.load('alice').worldBoss.sharedRewards.filter(r => r.weekStart === f.week);
  assert.equal(old.length, 3); assert.ok(old.every(r => r.ready));
  assert.equal(f.execute('alice', claim(f.week, 2)).progress.gems.medium, before.gems.medium + 1);
  assert.throws(() => f.execute('bob', claim(f.week, 2)), /ACTION_UNAVAILABLE/);
  assert.throws(() => f.execute('alice', claim(f.week + 7 * 86400000, 2)), /ACTION_UNAVAILABLE/);
});

test('new week goal is fixed with the first successful hit, never a failed command', t => {
  const f = fixture(t); f.damage(100000); f.advance(7 * 86400000);
  const newWeek = f.week + 7 * 86400000;
  const request = f.request('alice', { type: 'hitWorldBoss' });
  f.db.exec("CREATE TRIGGER fail_goal BEFORE INSERT ON economy_events BEGIN SELECT RAISE(ABORT, 'TEST_FAILURE'); END");
  assert.throws(() => f.store.execute('alice', request), /TEST_FAILURE/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM world_boss_shared_weeks WHERE week_start=?').get(newWeek).n, 0);
  assert.equal(f.store.load('alice').worldBoss.hits, 0);
  f.db.exec('DROP TRIGGER fail_goal');
  f.store.execute('alice', request);
  assert.equal(f.db.prepare('SELECT base_target FROM world_boss_shared_weeks WHERE week_start=?').get(newWeek).base_target, 12500);
});

test('shared claim rolls inventory, receipt and claim mark back together; revision and overflow fail closed', t => {
  const f = fixture(t); f.damage(30000);
  const before = f.store.load('alice'), request = f.request('alice', claim(f.week, 0));
  assert.throws(() => f.store.execute('alice', { ...request, expectedRevision: before.revision + 1 }), /REVISION_CONFLICT/);
  f.db.exec("CREATE TRIGGER fail_shared BEFORE INSERT ON economy_events BEGIN SELECT RAISE(ABORT, 'TEST_FAILURE'); END");
  assert.throws(() => f.store.execute('alice', request), /TEST_FAILURE/);
  assert.deepEqual(f.store.load('alice'), before);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM world_boss_shared_claims').get().n, 0);
  f.db.exec('DROP TRIGGER fail_shared');
  f.db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify({ ...before.progress, gems: { ...before.progress.gems, low: Number.MAX_SAFE_INTEGER } }), 'alice');
  assert.throws(() => f.store.execute('alice', request), /RESOURCE_OVERFLOW/);
  f.db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify(before.progress), 'alice');
  assert.equal(f.store.execute('alice', request).worldBoss.sharedRewards[0].claimed, true);
});

test('v8 migration preserves personal claims, attacks and balances while adding shared goals', t => {
  const f = fixture(t); f.damage(30000);
  f.execute('alice', { type: 'claimWorldBossReward', weekStart: f.week, stage: 0 });
  const before = f.store.load('alice');
  f.db.exec('DROP TABLE world_boss_shared_claims; DROP TABLE world_boss_shared_weeks; PRAGMA user_version=8;');
  f.reopen(); const after = f.store.load('alice');
  assert.deepEqual(after.progress, before.progress);
  assert.equal(after.worldBoss.hits, before.worldBoss.hits);
  assert.equal(after.worldBoss.rewards[0].claimed, true);
  assert.equal(after.worldBoss.sharedRewards[0].target, 10000);
  assert.equal(f.execute('alice', claim(f.week, 0)).progress.gems.low, before.progress.gems.low + 1);
});

test('shared reward parser accepts only week and stage, not damage, identity or reward quantities', () => {
  const valid = { requestId: 'shared_reward_1', expectedRevision: 0, command: claim(0, 0) };
  assert.deepEqual(parseRequest(valid), valid);
  for (const patch of [{ stage: 3 }, { stage: -1 }, { stage: .5 }, { weekStart: null }, { damage: 99999 }, { playerId: 'bob' }, { lowGems: 100 }])
    assert.throws(() => parseRequest({ ...valid, command: { ...valid.command, ...patch } }), /INVALID_COMMAND/);
});
