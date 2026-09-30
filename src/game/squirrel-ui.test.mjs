import { test } from 'node:test';
import assert from 'node:assert/strict';
import { squirrelAtHome, squirrelNeedsAttention, squirrelTimeLeft } from '../shared/pets.ts';

const now = 1_000_000;
const pet = { owned: true, questReady: true, trips: 0, trip: null };

test('squirrel waits in forest and shows attention only when available', () => {
  assert.equal(squirrelAtHome(undefined, now), false);
  assert.equal(squirrelNeedsAttention({ ...pet, owned: false, questReady: false }, now), false);
  assert.equal(squirrelNeedsAttention({ ...pet, owned: false }, now), true);
  assert.equal(squirrelAtHome(pet, now), true);
  assert.equal(squirrelNeedsAttention(pet, now), true);
  const away = { ...pet, trip: { destination: 'mine', departedAt: now, returnsAt: now + 4 * 60 * 60_000, reward: 600 } };
  assert.equal(squirrelAtHome(away, now), false);
  assert.equal(squirrelNeedsAttention(away, now), false);
  assert.equal(squirrelAtHome(away, away.trip.returnsAt), true);
  assert.equal(squirrelNeedsAttention(away, away.trip.returnsAt), true);
});

test('compact timer rounds up until the actual return', () => {
  assert.equal(squirrelTimeLeft(now + 4 * 60 * 60_000, now), '4:00');
  assert.equal(squirrelTimeLeft(now + 59_000, now), '0:01');
  assert.equal(squirrelTimeLeft(now, now), '0:00');
});
