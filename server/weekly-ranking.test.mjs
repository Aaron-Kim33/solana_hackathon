import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openGameStore } from './sqlite-store.mjs';
import { openAuthService } from './auth-service.mjs';
import { communityWeekStart } from '../src/shared/community.ts';

function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-ranking-')), path = join(folder, 'game.sqlite');
  let clock = Date.UTC(2026, 9, 5, 12);
  let store = openGameStore(path, { now: () => clock, random: () => 0.9 });
  const auth = openAuthService(path, { origin: 'https://lumber-rush.example', now: () => clock });
  auth.close();
  const db = new DatabaseSync(path);
  t.after(() => { db.close(); store.close(); rmSync(folder, { recursive: true, force: true }); });
  return {
    db, get store() { return store; }, get clock() { return clock; }, get week() { return communityWeekStart(clock); },
    advance: ms => { clock += ms; },
    restart: () => { store.close(); store = openGameStore(path, { mode: 'preview', now: () => clock }); },
    player: (name, linked = true) => {
      store.createPlayer(name);
      if (linked) db.prepare('INSERT INTO wallet_links VALUES (?,?)').run(`private-wallet-${name}`, name);
    },
    contribute: (name, amount, facility = 'mine') => db.prepare('INSERT INTO community_contributions VALUES (?,?,?,?)').run(name, communityWeekStart(clock), facility, amount),
    boss: (name, damage) => db.prepare('INSERT INTO world_boss_hits VALUES (?,?,?,?)').run(name, communityWeekStart(clock), 20, damage),
  };
}

test('weekly ranks combine facilities, share tie ranks, include own rank outside top 10, and never disclose identities', t => {
  const f = fixture(t);
  for (let i = 0; i < 12; i++) { const name = `player${String(i).padStart(2, '0')}`; f.player(name); f.contribute(name, 120 - i * 5); f.boss(name, 100.25 - i); }
  f.contribute('player01', 5, 'saplings');
  const list = f.store.leaderboard('player11', 'community');
  assert.equal(list.entries.length, 10);
  assert.equal(list.participants, 12);
  assert.deepEqual(list.entries.slice(0, 3).map(row => row.rank), [1, 1, 3]);
  assert.equal(list.entries[1].mine, 115); assert.equal(list.entries[1].saplings, 5);
  assert.equal(list.mine.rank, 12); assert.equal(list.mine.score, 65); assert.equal(list.mine.isMe, true);
  assert.equal(list.entries.some(row => row.isMe), false);
  assert.equal(list.eligible, true);
  assert.doesNotMatch(JSON.stringify(list), /private-wallet|player11|player_id|playerId/);
  const boss = f.store.leaderboard('player00', 'world-boss');
  assert.equal(boss.entries[0].score, 100.25); assert.equal(boss.entries[0].hits, 20);
  assert.equal(boss.mine.rank, 1); assert.equal(boss.mine.tag, list.entries[0].tag);
  assert.throws(() => f.store.leaderboard('player00', 'invalid'), /INVALID_COMMAND/);
});

test('test admins and unlinked practice are excluded, restart preserves ranks, new week reads empty without deleting history', t => {
  const f = fixture(t);
  f.player('alice'); f.player('admin'); f.player('practice', false);
  for (const name of ['alice', 'admin', 'practice']) { f.contribute(name, name === 'alice' ? 5 : 100); f.boss(name, name === 'alice' ? 10 : 999); }
  f.store.grantLocalTestAdmin('private-wallet-admin');
  for (const category of ['community', 'world-boss']) {
    const list = f.store.leaderboard('admin', category);
    assert.equal(list.participants, 1); assert.equal(list.mine, null); assert.equal(list.eligible, false);
    assert.equal(f.store.leaderboard('alice', category).mine.rank, 1);
  }
  const previous = f.store.leaderboard('alice', 'community');
  f.restart();
  assert.deepEqual(f.store.leaderboard('alice', 'community'), previous);
  assert.equal(f.store.leaderboard('admin', 'world-boss').eligible, false);
  f.advance(previous.resetsAt - f.clock);
  for (const category of ['community', 'world-boss']) {
    const next = f.store.leaderboard('alice', category);
    assert.equal(next.participants, 0); assert.deepEqual(next.entries, []); assert.equal(next.mine, null);
    assert.equal(next.weekStart, previous.resetsAt);
  }
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM community_contributions').get().n, 3);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM world_boss_hits').get().n, 3);
});

test('only successful server contributions and attacks count; duplicate requests do not inflate ranks and reads do not change progress', t => {
  const f = fixture(t); f.player('alice');
  f.db.prepare('INSERT INTO community_balances VALUES (?,?,?)').run('alice', f.week, 5);
  const contribute = { requestId: 'rank-contribute', expectedRevision: 0, command: { type: 'contributeCommunity', facility: 'mine', amount: 5 } };
  f.store.execute('alice', contribute); f.store.execute('alice', contribute);
  assert.equal(f.store.leaderboard('alice', 'community').mine.score, 5);
  assert.throws(() => f.store.execute('alice', { ...contribute, requestId: 'rank-reject', expectedRevision: 1 }), /ACTION_UNAVAILABLE/);
  assert.equal(f.store.leaderboard('alice', 'community').mine.score, 5);
  const attack = { requestId: 'rank-attack', expectedRevision: 1, command: { type: 'hitWorldBoss' } };
  const response = f.store.execute('alice', attack); f.store.execute('alice', attack);
  assert.equal(f.store.leaderboard('alice', 'world-boss').mine.score, response.lastBossDamage);
  assert.equal(f.store.leaderboard('alice', 'world-boss').mine.hits, 1);
  const before = f.store.load('alice');
  f.store.leaderboard('alice', 'community'); f.store.leaderboard('alice', 'world-boss');
  assert.deepEqual(f.store.load('alice'), before);
});
