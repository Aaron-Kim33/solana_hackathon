import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, claimWardenReward, masteryBonus, parseProgress, combatStats } from './progression.ts';

const fixture = level => ({ ...initialProgress('ko'), treeLevel: 101, treeHp: 10300, axeSkin: 'warden', axeLevel: level });
test('warden rewards require levels, pay once in order and persist', () => {
  const locked = fixture(149);
  assert.equal(claimWardenReward(locked), locked);
  let state = claimWardenReward(fixture(150));
  assert.equal(state.gems.high, 1);
  assert.equal(claimWardenReward(state), state);
  state = claimWardenReward({ ...state, axeLevel: 175 });
  assert.equal(state.gems.high, 3);
  assert.equal(masteryBonus(state, 'warden'), 10);
  state = claimWardenReward({ ...state, axeLevel: 200 });
  assert.equal(state.gems.supreme, 1);
  assert.equal(masteryBonus(state, 'warden'), 30);
  assert.equal(claimWardenReward(state), state);
  assert.equal(parseProgress(JSON.stringify(state)).wardenRewardsClaimed, 3);
  const switched = { ...state, axeSkin: 'default', axeLevel: 1, unequippedAxeLevels: { warden: 200 } };
  assert.equal(masteryBonus(switched, 'warden'), 30);
  assert.equal(combatStats(switched).critDamage, 135);
});
test('existing max-level players claim all steps; invalid claims are rejected on load', () => {
  let state = fixture(200);
  assert.equal(parseProgress(JSON.stringify(state)).wardenRewardsClaimed, undefined);
  for (let i = 0; i < 3; i++) state = claimWardenReward(state);
  assert.equal(state.wardenRewardsClaimed, 3);
  for (const value of [-1, 4, 1.5, null]) assert.throws(() => parseProgress(JSON.stringify({ ...fixture(200), wardenRewardsClaimed: value })));
  assert.throws(() => parseProgress(JSON.stringify({ ...fixture(175), wardenRewardsClaimed: 3 })));
});
