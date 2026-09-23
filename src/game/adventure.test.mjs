import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, claimAdventure, adventureReady, pioneerOwned, equipAxeSkin, axeLevelFor, hit, upgrade,
  parseProgress, xpFloor, questSteps, displayedHitXp, combatStats } from './progression.ts';
import { questView } from './quest-view.ts';
const normal = () => 0.99;
function ready() {
  return { ...initialProgress('ko'), treeLevel: 100, treeHp: 10200, axeLevel: 20, xp: xpFloor(20),
    wood: 1000, harvested: 1000, walletCompleted: true,
    receipt: { address: 'test', signature: 'test', status: 'confirmed' }, firstRecordClaimed: true,
    skinQuestHarvestStart: 900, growthRewardClaimed: true, rewardOption: 'low:damage', gemSlotQuestDone: true,
    inventory: ['low:damage', 'low:damage'], slots: ['low:damage', 'low:damage'] };
}
function pioneer() {
  let state = ready();
  for (let i = 0; i < 4; i++) state = claimAdventure(state);
  return equipAxeSkin(state, 'pioneer');
}
test('adventure rewards are sequential, exact and persistent', () => {
  let state = ready();
  assert.equal(questView(questSteps(state)).entries[0].index, 13);
  assert.equal(pioneerOwned(state), false);
  assert.equal(equipAxeSkin(state, 'pioneer'), state);
  state = claimAdventure(state); assert.equal(state.gems.low, 1);
  state = claimAdventure(state); assert.equal(state.coins, 300);
  state = claimAdventure(state); assert.equal(state.gems.medium, 1);
  state = claimAdventure(state); assert.equal(state.coins, 1200);
  assert.equal(pioneerOwned(state), true);
  assert.equal(axeLevelFor(state, 'pioneer'), 1);
  assert.equal(claimAdventure(state), state);
  state = equipAxeSkin(state, 'pioneer');
  for (let i = 0; i < 9; i++) state = upgrade(state, 'axe');
  assert.equal(state.axeLevel, 10);
  assert.equal(state.coins, 300); // Exactly 900 to go from 1 to 10.
  assert.equal(axeLevelFor(state, 'default'), 20);
  state = claimAdventure(state); assert.equal(state.coins, 1300);
  state = claimAdventure(state); assert.equal(state.gems.high, 1);
  assert.ok(questSteps(state).every(status => status === 'complete'));
  assert.equal(claimAdventure(state), state);
  const restored = parseProgress(JSON.stringify(equipAxeSkin(state, 'default')));
  assert.equal(restored.adventureClaimed, 6);
  assert.equal(claimAdventure(restored), restored);
  assert.equal(questView(questSteps(restored)).chapter, 'questsFinished');
});
test('all new objective boundaries and prerequisites are enforced', () => {
  for (const [index, patch] of [[0, { treeLevel: 14 }], [1, { slots: ['low:damage', null] }],
    [2, { treeLevel: 24 }], [2, { axeLevel: 19 }], [3, { treeLevel: 49 }], [3, { xp: xpFloor(10) - 1 }],
    [4, { axeSkin: 'default', unequippedAxeLevels: { pioneer: 10 } }],
    [4, { axeSkin: 'pioneer', axeLevel: 9 }], [5, { treeLevel: 99 }], [5, { xp: xpFloor(20) - 1 }]]) {
    const state = { ...ready(), adventureClaimed: index, ...patch };
    assert.equal(adventureReady(state), false);
    assert.equal(claimAdventure(state), state);
  }
  const blocked = { ...ready(), gemSlotQuestDone: false };
  assert.equal(claimAdventure(blocked), blocked);
});
test('pioneer gives exactly 10% hit XP including fractional carry through switches and restart', () => {
  let state = { ...pioneer(), treeLevel: 51, treeHp: 5300 };
  const start = state.xp;
  assert.equal(displayedHitXp(state), 56.1);
  for (let i = 0; i < 10; i++) {
    state = hit(state, 0, normal).state;
    state = parseProgress(JSON.stringify(state));
    if (i === 0) {
      assert.equal(state.xpBonusRemainder, 10);
      const defaultState = equipAxeSkin(state, 'default');
      assert.equal(hit(defaultState, 0, normal).xpGained, 51);
      state = equipAxeSkin(defaultState, 'pioneer');
    }
  }
  assert.equal(state.xp - start, 561);
  assert.equal(state.xpBonusRemainder, 0);
});
test('pioneer attack adds 98, XP bonus excludes entry XP, and level-up restores fatigue', () => {
  let state = pioneer();
  const defaultState = equipAxeSkin(state, 'default');
  assert.equal(combatStats({ ...defaultState, axeLevel: 1 }).min + 98, combatStats(state).min);
  const nextTree = upgrade({ ...state, treeHp: 0, wood: 10000, harvested: 10000 }, 'tree');
  assert.equal(nextTree.xp - state.xp, 1010);
  state = { ...state, xp: xpFloor(21) - 110, fatigue: 99, recoveryAt: 0 };
  const strike = hit(state, 0, normal);
  assert.equal(strike.xpGained, 110);
  assert.equal(strike.state.fatigue, 0);
  assert.equal(strike.state.recoveryAt, null);
});

test('pioneer level-one base attack is 99–101 and grows independently', () => {
  const state = { ...pioneer(), slots: [null, null] };
  // The previously earned permanent +1 is applied on top of base attack.
  assert.equal(combatStats(state).min, 100);
  assert.equal(combatStats(state).max, 102);
  const upgraded = upgrade({ ...state, coins: 1000 }, 'axe');
  assert.equal(combatStats(upgraded).min, 101);
  assert.equal(axeLevelFor(upgraded, 'default'), axeLevelFor(state, 'default'));
  const strike = hit(state, 0, () => 0.99);
  assert.equal(strike.damage, 102);
});
test('v6 saves retain separate axe levels and get no automatic new rewards', () => {
  const old = { ...ready(), version: 6, unequippedAxeLevels: { firstRecord: 12 }, coins: 765 };
  delete old.adventureClaimed; delete old.xpBonusRemainder;
  const next = parseProgress(JSON.stringify(old));
  assert.equal(next.version, 9);
  assert.equal(next.adventureClaimed, 0);
  assert.equal(next.coins, 765);
  assert.deepEqual(next.unequippedAxeLevels, old.unequippedAxeLevels);
  assert.equal(questView(questSteps(next)).chapter, 'questFrontier');
});
test('invalid adventure ownership, counters and bonus carry are rejected', () => {
  for (const patch of [{ adventureClaimed: 7 }, { adventureClaimed: -1 }, { xpBonusRemainder: 100 },
    { xpBonusRemainder: 0.5 }, { axeSkin: 'pioneer' }, { unequippedAxeLevels: { pioneer: 2 } },
    { adventureClaimed: 4, treeLevel: 49, treeHp: 0 }, { adventureClaimed: 5 }]) {
    assert.throws(() => parseProgress(JSON.stringify({ ...ready(), ...patch })));
  }
});
