import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openGameStore } from './sqlite-store.mjs';
import { communityDayStart } from '../src/shared/community.ts';
import { SQUIRREL_EXPEDITION_MS, squirrelReward } from '../src/shared/pets.ts';

test('squirrel quest unlocks permanently after one material quest and grants one pet', t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-squirrel-'));
  const path = join(folder, 'game.sqlite');
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  let clock = Date.UTC(2026, 8, 28, 12);
  let store = openGameStore(path, { now: () => clock });
  store.createPlayer('alice'); store.createPlayer('bob');
  const command = (player, type, extra = {}) => ({ requestId: `${type}_${player}_${clock}`, expectedRevision: store.load(player).revision,
    command: { type, ...extra } });
  assert.equal(store.load('alice').squirrel.questReady, false);
  assert.throws(() => store.execute('alice', command('alice', 'claimSquirrel')), /ACTION_UNAVAILABLE/);
  const db = new DatabaseSync(path);
  db.prepare('INSERT INTO community_activity VALUES (?,?,?,?,?)').run('alice', communityDayStart(clock), 20, 0, 0);
  store.execute('alice', command('alice', 'claimCommunityQuest', { questId: 'd_hits' }));
  const reward = command('alice', 'claimSquirrel');
  const claimed = store.execute('alice', reward);
  assert.equal(claimed.squirrel.owned, true);
  assert.deepEqual(store.execute('alice', reward), claimed);
  assert.equal(store.load('bob').squirrel.owned, false);
  assert.throws(() => store.execute('alice', { ...command('alice', 'claimSquirrel'), requestId: 'second_claim' }), /ACTION_UNAVAILABLE/);
  store.close();
  clock += 8 * 86_400_000;
  store = openGameStore(path, { now: () => clock });
  assert.equal(store.load('alice').squirrel.owned, true);
  db.close(); store.close();
});

test('one squirrel trip locks reward at dispatch; only server time and one claim release resources', t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-squirrel-'));
  const path = join(folder, 'game.sqlite');
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  let clock = Date.UTC(2026, 8, 28, 12);
  const store = openGameStore(path, { now: () => clock });
  store.createPlayer('alice');
  const db = new DatabaseSync(path);
  db.prepare('INSERT INTO community_activity VALUES (?,?,?,?,?)').run('alice', communityDayStart(clock), 20, 0, 0);
  let serial = 0;
  const command = (type, extra = {}) => ({ requestId: `squirrel_${++serial}`, expectedRevision: store.load('alice').revision,
    command: { type, ...extra } });
  store.execute('alice', command('claimCommunityQuest', { questId: 'd_hits' }));
  store.execute('alice', command('claimSquirrel'));
  const before = store.load('alice').progress;
  const dispatch = command('dispatchSquirrel', { destination: 'mine' });
  const sent = store.execute('alice', dispatch);
  assert.equal(sent.squirrel.trip.reward, squirrelReward('mine', before.treeLevel, 1));
  assert.equal(sent.squirrel.trip.returnsAt, clock + SQUIRREL_EXPEDITION_MS);
  assert.deepEqual(store.execute('alice', dispatch), sent);
  assert.throws(() => store.execute('alice', command('dispatchSquirrel', { destination: 'saplings' })), /ACTION_UNAVAILABLE/);
  assert.throws(() => store.execute('alice', command('collectSquirrel')), /ACTION_UNAVAILABLE/);
  assert.throws(() => store.execute('alice', { ...command('dispatchSquirrel', { destination: 'mine' }), command: { type: 'dispatchSquirrel', destination: 'mine', reward: 999999 } }), /INVALID_COMMAND/);
  clock += SQUIRREL_EXPEDITION_MS;
  const claim = command('collectSquirrel');
  const collected = store.execute('alice', claim);
  assert.equal(collected.progress.coins, before.coins + sent.squirrel.trip.reward);
  assert.equal(collected.progress.wood, before.wood);
  assert.equal(collected.progress.harvested, before.harvested);
  assert.equal(collected.squirrel.trip, null);
  assert.equal(collected.squirrel.trips, 1);
  assert.deepEqual(store.execute('alice', claim), collected);
  assert.throws(() => store.execute('alice', command('collectSquirrel')), /ACTION_UNAVAILABLE/);
  const saplingTrip = store.execute('alice', command('dispatchSquirrel', { destination: 'saplings' })).squirrel.trip;
  clock += SQUIRREL_EXPEDITION_MS;
  const wood = store.execute('alice', command('collectSquirrel'));
  assert.equal(wood.progress.wood, before.wood + saplingTrip.reward);
  assert.equal(wood.progress.harvested, before.harvested + saplingTrip.reward);
  assert.equal(wood.squirrel.trips, 2);
  db.close(); store.close();
});

test('squirrel reward formula grows modestly with tree and facility levels', () => {
  assert.equal(squirrelReward('mine', 15, 1), 600);
  assert.equal(squirrelReward('saplings', 15, 1), 120);
  assert.equal(squirrelReward('mine', 15, 5), 840);
  assert.equal(squirrelReward('saplings', 15, 5), 168);
});
