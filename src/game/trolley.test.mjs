import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collect, collectTrolley, dispatchTrolley, initialProgress, loadTrolley, parseProgress, recover, trolleyCapacity } from './progression.ts';

test('loading the trolley is separate from banking wood and first-harvest progress', () => {
  const start = { ...initialProgress('ko'), treeLevel: 3, treeHp: 70 };
  const loaded = loadTrolley(loadTrolley(start, 8), 12);
  assert.equal(loaded.trolleyWood, 20);
  assert.equal(loaded.wood, 0);
  assert.equal(loaded.harvested, 0);
  const restored = parseProgress(JSON.stringify(loaded));
  assert.equal(restored.trolleyWood, 20);
  const banked = collectTrolley(restored);
  assert.equal(banked.trolleyWood, 0);
  assert.equal(banked.wood, 20);
  assert.equal(banked.harvested, 20);
  assert.equal(collectTrolley(banked), banked);
});

test('old saves migrate to an empty trolley and invalid cargo cannot enter a save', () => {
  const old = initialProgress('en');
  delete old.trolleyWood;
  assert.equal(parseProgress(JSON.stringify(old)).trolleyWood, 0);
  for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => parseProgress(JSON.stringify({ ...old, trolleyWood: value })), /INVALID_SAVE/);
  }
  const state = { ...initialProgress('en'), wood: 1, harvested: 1, trolleyWood: Number.MAX_SAFE_INTEGER };
  assert.equal(loadTrolley(state, 1), state);
  assert.equal(collectTrolley(state), state);
});

test('cart credits cargo only on storage arrival and returns before it can be loaded again', () => {
  const loaded = loadTrolley(initialProgress('en'), 7);
  const trip = dispatchTrolley(loaded, 1000);
  assert.equal(trip.wood, 0);
  assert.equal(loadTrolley(trip, 1), trip);
  assert.equal(dispatchTrolley(trip, 1001), trip);
  assert.equal(recover(trip, 3999).wood, 0);
  const arrived = recover(trip, 4000);
  assert.equal(arrived.wood, 7);
  assert.equal(arrived.trolleyWood, 0);
  assert.equal(arrived.trolleyTrip.returnsAt, 6000);
  assert.equal(recover(arrived, 4500), arrived);
  const returned = recover(arrived, 6000);
  assert.equal(returned.trolleyTrip, null);
  assert.equal(returned.wood, 7);
  assert.equal(loadTrolley(returned, 2).trolleyWood, 2);
});

test('direct storage collection remains immediate while the cart is travelling', () => {
  const trip = dispatchTrolley(loadTrolley(initialProgress('en'), 7), 1000);
  const direct = collect(trip, 3);
  assert.equal(direct.wood, 3);
  assert.equal(direct.harvested, 3);
  assert.equal(direct.trolleyWood, 7);
  const arrived = recover(direct, 4000);
  assert.equal(arrived.wood, 10);
  assert.equal(arrived.harvested, 10);
  assert.equal(arrived.trolleyWood, 0);
  assert.equal(recover(arrived, 6000).wood, 10);
});

test('capacity is one third of ordinary tree HP, without boss spikes', () => {
  assert.equal(trolleyCapacity(initialProgress('en')), 14);
  assert.equal(trolleyCapacity({ treeLevel: 4 }), 29);
  assert.equal(trolleyCapacity({ treeLevel: 50 }), 1734);
  assert.equal(trolleyCapacity({ treeLevel: 100 }), 3400);
  const boss = { ...initialProgress('en'), treeLevel: 50, treeHp: 15000, bosses: { first: false, gate: false } };
  assert.equal(trolleyCapacity(boss), 1734);
  const almostFull = { ...initialProgress('en'), trolleyWood: 13 };
  assert.equal(loadTrolley(almostFull, 2), almostFull);
  assert.equal(loadTrolley(almostFull, 1).trolleyWood, 14);
  // Cargo from before the cap existed is preserved and can still be delivered.
  const legacy = { ...initialProgress('en'), trolleyWood: 25 };
  assert.equal(parseProgress(JSON.stringify(legacy)).trolleyWood, 25);
  assert.equal(loadTrolley(legacy, 1), legacy);
  assert.equal(dispatchTrolley(legacy, 1000).trolleyWood, 25);
});
