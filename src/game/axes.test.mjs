import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, collect, claimFirstRecord, equipAxeSkin, upgrade, axeLevelFor, highestAxeLevel,
  combatStats, parseProgress, questSteps, claimGrowthReward } from './progression.ts';
function owned() {
  return claimFirstRecord({ ...collect(initialProgress('ko'), 1000), coins: 100000, xp: 4000,
    axeLevel: 15, treeLevel: 10, treeHp: 1200, walletCompleted: true,
    receipt: { address: 'test', signature: 'test', status: 'confirmed' } });
}
test('new axes start at level one; upgrading each axe changes only that axe', () => {
  let state = owned();
  assert.equal(axeLevelFor(state, 'firstRecord'), 1);
  state = equipAxeSkin(state, 'firstRecord');
  assert.equal(state.axeLevel, 1);
  assert.equal(axeLevelFor(state, 'default'), 15);
  const before = state.coins;
  state = upgrade(state, 'axe');
  assert.equal(state.coins, before - 20);
  assert.equal(state.axeLevel, 2);
  assert.equal(axeLevelFor(state, 'default'), 15);
  state = equipAxeSkin(state, 'default');
  assert.equal(state.axeLevel, 15);
  state = upgrade(state, 'axe');
  assert.equal(state.axeLevel, 16);
  assert.equal(axeLevelFor(state, 'firstRecord'), 2);
  assert.equal(highestAxeLevel(state), 16);
  state = parseProgress(JSON.stringify(state));
  assert.equal(equipAxeSkin(state, 'firstRecord').axeLevel, 2);
  assert.equal(combatStats(state).min, 17);
  assert.equal(combatStats(equipAxeSkin(state, 'firstRecord')).min, 5);
});
test('changing to a lower level axe does not regress quests or invalidate claimed rewards', () => {
  let state = collect(equipAxeSkin(owned(), 'firstRecord'), 100);
  assert.equal(state.axeLevel, 1);
  assert.equal(questSteps(state)[9], 'complete');
  state = claimGrowthReward(state);
  assert.equal(state.growthRewardClaimed, true);
  assert.deepEqual(parseProgress(JSON.stringify(state)), state);
  assert.equal(questSteps(equipAxeSkin(state, 'default'))[10], 'complete');
});
test('old shared levels migrate once to owned axes without changing currency or XP', () => {
  for (const skin of ['default', 'firstRecord']) {
    const old = { ...owned(), version: 5, axeSkin: skin, skinQuestHarvestStart: 900, axeLevel: 27 };
    delete old.unequippedAxeLevels;
    const state = parseProgress(JSON.stringify(old));
    assert.equal(state.version, 9);
    assert.equal(axeLevelFor(state, 'default'), 27);
    assert.equal(axeLevelFor(state, 'firstRecord'), 27);
    assert.equal(state.coins, old.coins);
    assert.equal(state.xp, old.xp);
    const upgraded = upgrade(state, 'axe');
    assert.equal(axeLevelFor(upgraded, skin), 28);
    assert.equal(axeLevelFor(upgraded, skin === 'default' ? 'firstRecord' : 'default'), 27);
    assert.deepEqual(parseProgress(JSON.stringify(upgraded)), upgraded);
  }
  const unowned = parseProgress(JSON.stringify({ ...initialProgress('ko'), version: 5, axeLevel: 30 }));
  assert.equal(axeLevelFor(unowned, 'firstRecord'), 1);
});
test('cap is per axe and invalid stored levels are rejected', () => {
  const state = { ...owned(), axeLevel: 200 };
  assert.equal(upgrade(state, 'axe'), state);
  assert.equal(upgrade(equipAxeSkin(state, 'firstRecord'), 'axe').axeLevel, 2);
  for (const map of [{ default: 2 }, { firstRecord: 0 }, { firstRecord: 201 }, { fake: 5 }, [], null]) {
    assert.throws(() => parseProgress(JSON.stringify({ ...state, unequippedAxeLevels: map })));
  }
});
