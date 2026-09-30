import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openGameStore } from './sqlite-store.mjs';
import { WORLD_BOSS_WEEKLY_HITS } from '../src/shared/world-boss.ts';

test('world boss uses server-owned weekly 100 hits without tree or resource rewards', t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-world-boss-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  let clock = Date.UTC(2026, 8, 28, 12);
  const store = openGameStore(join(folder, 'game.sqlite'), { now: () => clock, random: () => 0.99 });
  store.createPlayer('alice'); store.createPlayer('bob');
  const before = store.load('alice').progress;
  const command = (player, index) => ({ requestId: `boss_${player}_${index}`, expectedRevision: store.load(player).revision,
    command: { type: 'hitWorldBoss' } });
  const first = command('alice', 0);
  const response = store.execute('alice', first);
  assert.equal(response.worldBoss.hits, 1);
  assert.ok(response.lastBossDamage > 0);
  assert.equal(response.progress.treeHp, before.treeHp);
  assert.equal(response.progress.xp, before.xp);
  assert.equal(response.progress.wood, before.wood);
  assert.equal(response.progress.coins, before.coins);
  assert.equal(response.progress.fatigue, before.fatigue + 1);
  assert.deepEqual(store.execute('alice', first), response);
  assert.throws(() => store.execute('alice', { ...first, command: { type: 'hitWorldBoss', damage: 999999 } }), /INVALID_COMMAND/);
  assert.throws(() => store.execute('alice', command('alice', 1)), /ACTION_TOO_FAST/);
  for (let i = 1; i < WORLD_BOSS_WEEKLY_HITS; i++) {
    clock += 2_000;
    store.execute('alice', command('alice', i));
  }
  const full = store.load('alice');
  assert.equal(full.worldBoss.hits, 100);
  assert.equal(full.worldBoss.totalHits, 100);
  assert.equal(full.worldBoss.participants, 1);
  assert.equal(full.progress.fatigue, 100);
  clock += 2_000;
  assert.throws(() => store.execute('alice', command('alice', 100)), /ACTION_UNAVAILABLE/);
  store.execute('bob', command('bob', 0));
  assert.equal(store.load('alice').worldBoss.totalHits, 101);
  assert.equal(store.load('alice').worldBoss.participants, 2);
  clock += 7 * 86_400_000;
  assert.equal(store.load('alice').worldBoss.hits, 0);
  assert.equal(store.load('alice').worldBoss.totalHits, 0);
  assert.equal(store.execute('alice', command('alice', 101)).worldBoss.hits, 1);
  store.close();
});
