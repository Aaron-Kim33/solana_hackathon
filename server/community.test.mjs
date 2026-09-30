import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openGameStore } from './sqlite-store.mjs';
import { COMMUNITY_QUESTS, communityDayStart, communityWeekStart } from '../src/shared/community.ts';

test('server actions advance quests; claims grant only once and a new week starts empty', t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-community-'));
  const path = join(folder, 'game.sqlite');
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  let clock = Date.UTC(2026, 8, 28, 12);
  let store = openGameStore(path, { now: () => clock, random: () => 0.9 });
  store.createPlayer('alice'); store.createPlayer('bob');
  let sequence = 0;
  const command = (type, extra = {}) => ({ requestId: `community_${++sequence}`, expectedRevision: store.load('alice').revision, command: { type, ...extra } });
  for (let i = 0; i < 10; i++) {
    store.execute('alice', command('hit'));
    clock += 2_000;
  }
  assert.equal(store.load('alice').community.quests.find(q => q.id === 'd_hits').progress, 10);
  assert.equal(store.load('alice').community.quests.find(q => q.id === 'w_hits').progress, 10);
  const claim = command('claimCommunityQuest', { questId: 'd_hits' });
  const claimed = store.execute('alice', claim);
  assert.equal(claimed.community.materials, 5);
  assert.equal(claimed.community.quests.find(q => q.id === 'd_hits').claimed, true);
  assert.deepEqual(store.execute('alice', claim), claimed);
  const contribute = command('contributeCommunity', { facility: 'mine', amount: 5 });
  const built = store.execute('alice', contribute);
  assert.equal(built.community.materials, 0);
  assert.equal(built.community.facilities.find(f => f.id === 'mine').total, 5);
  assert.equal(store.load('bob').community.facilities.find(f => f.id === 'mine').total, 5);
  assert.deepEqual(store.execute('alice', contribute), built);
  assert.throws(() => store.execute('alice', command('contributeCommunity', { facility: 'mine', amount: 1 })), /ACTION_UNAVAILABLE/);
  assert.throws(() => store.execute('alice', command('claimCommunityQuest', { questId: 'd_hits' })), /ACTION_UNAVAILABLE/);
  assert.equal(store.load('bob').community.materials, 0);
  store.close();
  store = openGameStore(path, { now: () => clock, random: () => 0.9 });
  assert.equal(store.load('alice').community.materials, 0);
  assert.equal(store.load('alice').community.myContribution, 5);
  clock += 7 * 86_400_000;
  assert.equal(store.load('alice').community.materials, 0);
  assert.equal(store.load('alice').community.quests.find(q => q.id === 'd_hits').progress, 0);
  assert.equal(store.load('alice').community.quests.find(q => q.id === 'w_hits').progress, 0);
  assert.equal(store.load('alice').community.facilities.find(f => f.id === 'mine').total, 0);
  store.close();
});

test('quest grants roll back with the audit write and accept only defined IDs', t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-community-'));
  const path = join(folder, 'game.sqlite');
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const time = Date.UTC(2026, 8, 28, 12);
  const store = openGameStore(path, { now: () => time });
  store.createPlayer('alice');
  const db = new DatabaseSync(path);
  db.prepare('INSERT INTO community_activity VALUES (?,?,?,?,?)').run('alice', communityDayStart(time), 10, 3, 1);
  const claim = { requestId: 'community_claim_001', expectedRevision: 0, command: { type: 'claimCommunityQuest', questId: 'd_hits' } };
  assert.throws(() => store.execute('alice', { ...claim, command: { ...claim.command, questId: 'invalid' } }), /INVALID_COMMAND/);
  assert.throws(() => store.execute('alice', { ...claim, command: { ...claim.command, materials: 999 } }), /INVALID_COMMAND/);
  assert.throws(() => store.execute('alice', { ...claim, command: { type: 'contributeCommunity', facility: 'fake', amount: 1 } }), /INVALID_COMMAND/);
  assert.throws(() => store.execute('alice', { ...claim, command: { type: 'contributeCommunity', facility: 'mine', amount: 151 } }), /INVALID_COMMAND/);
  db.exec("CREATE TRIGGER deny_audit BEFORE INSERT ON economy_events BEGIN SELECT RAISE(ABORT, 'DENIED'); END;");
  assert.throws(() => store.execute('alice', claim), /DENIED/);
  assert.equal(store.load('alice').community.materials, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM community_claims').get().n, 0);
  db.exec('DROP TRIGGER deny_audit');
  const successful = store.execute('alice', claim);
  assert.equal(successful.community.materials, 5);
  db.exec("CREATE TRIGGER deny_contribution_audit BEFORE INSERT ON economy_events BEGIN SELECT RAISE(ABORT, 'DENIED'); END;");
  const contribute = { requestId: 'community_contribute_001', expectedRevision: 1, command: { type: 'contributeCommunity', facility: 'saplings', amount: 5 } };
  assert.throws(() => store.execute('alice', contribute), /DENIED/);
  assert.equal(store.load('alice').community.materials, 5);
  assert.equal(store.load('alice').community.facilities.find(f => f.id === 'saplings').total, 0);
  db.exec('DROP TRIGGER deny_contribution_audit');
  assert.equal(store.execute('alice', contribute).community.facilities.find(f => f.id === 'saplings').total, 5);
  assert.equal(store.load('alice').community.weekStart, communityWeekStart(time));
  assert.equal(COMMUNITY_QUESTS.reduce((sum, quest) => sum + quest.materials * (quest.period === 'daily' ? 7 : 1), 0), 150);
  db.close(); store.close();
});

test('facility level targets use distinct participants from the closed prior week', t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-community-'));
  const path = join(folder, 'game.sqlite');
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const now = Date.UTC(2026, 9, 5, 12);
  const previousWeek = communityWeekStart(now) - 7 * 86_400_000;
  const store = openGameStore(path, { now: () => now });
  for (const player of ['alice', 'bob', 'charlie']) store.createPlayer(player);
  const db = new DatabaseSync(path);
  for (const player of ['alice', 'bob']) {
    db.prepare('INSERT INTO community_claims VALUES (?,?,?,?)').run(player, previousWeek, 'd_hits', previousWeek + 1);
    db.prepare('INSERT INTO community_claims VALUES (?,?,?,?)').run(player, previousWeek, 'w_hits', previousWeek + 2);
  }
  db.prepare('INSERT INTO community_contributions VALUES (?,?,?,?)').run('alice', communityWeekStart(now), 'mine', 20);
  db.prepare('INSERT INTO community_contributions VALUES (?,?,?,?)').run('charlie', communityWeekStart(now), 'saplings', 10);
  const alice = store.load('alice').community;
  const charlie = store.load('charlie').community;
  assert.equal(alice.targetUnit, 2);
  assert.equal(alice.facilities.find(f => f.id === 'mine').level, 2);
  assert.equal(alice.facilities.find(f => f.id === 'mine').nextTarget, 50);
  assert.equal(charlie.facilities.find(f => f.id === 'mine').total, 20);
  assert.equal(charlie.myContribution, 10);
  db.close(); store.close();
});
