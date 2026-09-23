import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, parseProgress, hit } from './progression.ts';
import { AUTO_PICKUP_MS, autoPickupAvailable, autoPickupRemaining, startAutoPickup } from './auto-pickup.ts';
const now = Date.UTC(2026, 8, 13, 12);
const ready = () => ({ ...initialProgress('ko'), bosses: { first: true, gate: false }, treeLevel: 50, treeHp: 5200, axeLevel: 10, xp: 4000 });

test('trial requires tree 50, fatigue below 100, and explicit start without resource charges', () => {
  const locked = { ...ready(), treeLevel: 49 };
  assert.equal(startAutoPickup(locked, now), locked);
  const tired = { ...ready(), fatigue: 100, recoveryAt: now };
  assert.equal(startAutoPickup(tired, now), tired);
  const state = ready(), started = startAutoPickup(state, now);
  assert.deepEqual(started, { ...state, autoPickupTrial: { startedAt: now } });
  assert.equal(autoPickupRemaining(state, now), 0);
  assert.equal(autoPickupRemaining(started, now), AUTO_PICKUP_MS);
  assert.equal(startAutoPickup(started, now + 1), started);
});

test('trial expires exactly at 30 minutes, survives reload, resets at UTC midnight and rejects rollback', () => {
  const state = parseProgress(JSON.stringify(startAutoPickup(ready(), now)));
  assert.equal(autoPickupRemaining(state, now + AUTO_PICKUP_MS - 1), 1);
  assert.equal(autoPickupRemaining(state, now + AUTO_PICKUP_MS), 0);
  assert.equal(autoPickupAvailable(state, now + AUTO_PICKUP_MS), false);
  assert.equal(autoPickupAvailable(state, Date.UTC(2026, 8, 14)), true);
  assert.equal(autoPickupAvailable(state, now - 1), false);
  assert.equal(autoPickupRemaining(state, now - 1), 0);
  const late = startAutoPickup(ready(), Date.UTC(2026, 8, 13, 23, 50));
  assert.equal(autoPickupAvailable(late, Date.UTC(2026, 8, 14)), false);
  assert.equal(autoPickupAvailable(late, Date.UTC(2026, 8, 14, 0, 20)), true);
});

test('active trial collects entire new bundle once; expiry restores manual collection', () => {
  const state = startAutoPickup(ready(), now);
  const strike = time => hit(state, time, () => 0.99, autoPickupRemaining(state, time) > 0);
  const active = strike(now);
  assert.equal(active.manualWood, 0);
  assert.equal(active.state.wood, active.value);
  assert.equal(active.state.harvested, active.value);
  assert.equal(active.state.fatigue, 1);
  const expired = strike(now + AUTO_PICKUP_MS);
  assert.equal(expired.autoCollected, false);
  assert.equal(expired.manualWood, expired.value);
  assert.equal(expired.state.wood, 0);
});

test('old saves do not start a trial and malformed trial records are rejected', () => {
  assert.equal(parseProgress(JSON.stringify(ready())).autoPickupTrial, undefined);
  for (const value of [null, [], {}, { startedAt: -1 }, { startedAt: 0.5 }, { startedAt: 'today' }]) {
    assert.throws(() => parseProgress(JSON.stringify({ ...ready(), autoPickupTrial: value })));
  }
});
