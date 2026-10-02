import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, FOREST_TRAIL, nextForestTrail, claimForestTrail, parseProgress, xpFloor, treeHealth } from './progression.ts';

export function trailState() {
  return { ...initialProgress('ko'), treeLevel: 25, treeHp: treeHealth(25), axeLevel: 25, xp: xpFloor(5),
    harvested: 1000, walletCompleted: true, firstRecordClaimed: true, skinQuestHarvestStart: 900,
    growthRewardClaimed: true, rewardOption: 'low:damage', gemSlotQuestDone: true,
    slots: ['low:damage', 'low:damage'], adventureClaimed: 3 };
}
test('trail follows ten small milestones with one reward each, preserving main quest progress', () => {
  let state = trailState();
  assert.deepEqual(FOREST_TRAIL.map(q => q.tree), [25, 30, 35, 40, 45, 55, 60, 70, 80, 90]);
  for (let index = 0; index < 10; index++) {
    if (index === 5) {
      assert.equal(nextForestTrail(state), null); // Earn and train the pioneer axe first.
      state = { ...state, adventureClaimed: 5, xp: xpFloor(10), axeSkin: 'pioneer', axeLevel: 10,
        unequippedAxeLevels: { default: 25 } };
    }
    const quest = FOREST_TRAIL[index];
    state = { ...state, treeLevel: quest.tree - 1, treeHp: treeHealth(quest.tree - 1) };
    assert.equal(nextForestTrail(state).ready, false);
    assert.equal(claimForestTrail(state, index), state);
    state = { ...state, treeLevel: quest.tree, treeHp: treeHealth(quest.tree) };
    assert.equal(claimForestTrail(state, index + 1), state);
    const before = state;
    state = claimForestTrail(state, index);
    assert.equal(state.coins, before.coins + quest.coins);
    assert.equal(state.adventureClaimed, before.adventureClaimed);
    assert.equal(state.xp, before.xp);
    if (quest.gem) assert.equal(state.gems[quest.gem], before.gems[quest.gem] + 1);
    assert.equal(claimForestTrail(state, index), state);
    assert.deepEqual(parseProgress(JSON.stringify(state)), state);
  }
  assert.equal(nextForestTrail(state), null);
});
test('legacy chapters skip past new goals without replaying rewards or resetting balances', () => {
  const state = { ...trailState(), treeLevel: 100, treeHp: treeHealth(100), xp: xpFloor(20) };
  assert.equal(nextForestTrail(state).index, 0);
  assert.equal(nextForestTrail({ ...state, adventureClaimed: 4 }), null);
  const trained = { ...state, adventureClaimed: 5, axeSkin: 'pioneer', axeLevel: 10, unequippedAxeLevels: { default: 25 } };
  assert.equal(nextForestTrail(trained).index, 5);
  assert.equal(claimForestTrail(trained, 0), trained);
  assert.equal(nextForestTrail({ ...trained, adventureClaimed: 6 }), null);
  assert.deepEqual(parseProgress(JSON.stringify(state)), state);
});
test('trail validates saved counts and prerequisites', () => {
  for (const count of [-1, 11, 0.5, '1', null]) {
    assert.throws(() => parseProgress(JSON.stringify({ ...trailState(), forestTrailClaimed: count })), /INVALID_SAVE/);
  }
  assert.equal(nextForestTrail({ ...trailState(), adventureClaimed: 2 }), null);
  assert.equal(nextForestTrail({ ...trailState(), walletCompleted: false }), null);
  assert.throws(() => parseProgress(JSON.stringify({ ...trailState(), forestTrailClaimed: 2 })), /INVALID_SAVE/);
});
