import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, collect, claimFirstRecord, equipAxeSkin, questSteps, claimGrowthReward,
  GEM_TIERS, GEM_VALUES, optionInfo, grantTestGems, openGem, equip, combatStats, parseProgress, upgrade } from './progression.ts';

function ready() {
  const recorded = { ...collect(initialProgress('ko'), 5000), xp: 4000, coins: 1000, axeLevel: 15, treeLevel: 10, treeHp: 1200,
    walletCompleted: true, receipt: { address: 'test', signature: 'test', status: 'confirmed' } };
  return collect(equipAxeSkin(claimFirstRecord(recorded), 'firstRecord'), 100);
}

test('growth reward accepts existing levels, requires all milestones and is claimed once', () => {
  const state = ready();
  assert.deepEqual(questSteps(state).slice(9, 13), ['complete', 'active', 'locked', 'locked']);
  for (const patch of [{ axeLevel: 14, unequippedAxeLevels: { default: 14 } }, { treeLevel: 9 }, { xp: 0 }, { skinQuestHarvestStart: state.harvested }]) {
    const blocked = { ...state, ...patch };
    assert.equal(claimGrowthReward(blocked), blocked);
  }
  const claimed = claimGrowthReward(state);
  assert.equal(claimed.gems.low, 1);
  assert.equal(claimGrowthReward(claimed), claimed);
  assert.deepEqual(parseProgress(JSON.stringify(claimed)), claimed);
  assert.equal(claimGrowthReward(parseProgress(JSON.stringify(claimed))).gems.low, 1);
});

test('gem use consumes one gem and adds one option, with equal thirds and exact tier values', () => {
  const state = grantTestGems(initialProgress('en'));
  const expected = [[3, 1, 13], [15, 5, 65], [30, 10, 130], [60, 20, 260], [120, 40, 520]];
  GEM_TIERS.forEach((tier, tierIndex) => {
    assert.deepEqual(Object.values(GEM_VALUES[tier]), expected[tierIndex]);
    const counts = { damage: 0, critChance: 0, critDamage: 0 };
    for (let i = 0; i < 300; i++) {
      const result = openGem(state, tier, () => i / 300);
      const info = optionInfo(result.item);
      counts[info.kind]++;
      assert.equal(info.value, GEM_VALUES[tier][info.kind]);
      assert.equal(result.state.gems[tier], 1);
      assert.deepEqual(result.state.inventory, [result.item]);
      assert.deepEqual(result.state.slots, [null, null]);
    }
    assert.deepEqual(Object.values(counts), [100, 100, 100]);
    assert.equal(optionInfo(openGem(state, tier, () => 1 / 3).item).kind, 'critChance');
    assert.equal(optionInfo(openGem(state, tier, () => 2 / 3).item).kind, 'critDamage');
  });
  assert.deepEqual(grantTestGems(state), state);
});

test('missing gems and invalid randomness cannot consume or award anything', () => {
  assert.equal(openGem(initialProgress('en'), 'low'), null);
  const state = grantTestGems(initialProgress('ko'));
  for (const roll of [-1, 1, NaN, Infinity]) assert.equal(openGem(state, 'low', () => roll), null);
  const one = { ...state, gems: { ...state.gems, low: 1 } };
  const result = openGem(one, 'low', () => 0);
  assert.equal(openGem(result.state, 'low', () => 0), null);
  assert.deepEqual(one.inventory, []);
});

test('reward gem and slot 1 quests advance and remain complete after replacement and restart', () => {
  let state = claimGrowthReward(ready());
  state = openGem(state, 'low', () => 0.5).state;
  assert.equal(state.rewardOption, 'low:critChance');
  assert.deepEqual(questSteps(state).slice(10, 13), ['complete', 'complete', 'active']);
  assert.equal(equip(state, 1, state.rewardOption).gemSlotQuestDone, false);
  state = equip(state, 0, state.rewardOption);
  assert.ok(questSteps(state).slice(0, 13).every(value => value === 'complete'));
  state = upgrade(equip(state, 0, null), 'axe');
  state = equip({ ...state, inventory: ['low:damage'] }, 0, 'low:damage');
  assert.deepEqual(state.inventory, []);
  assert.ok(questSteps(parseProgress(JSON.stringify(state))).slice(0, 13).every(value => value === 'complete'));
  const next = openGem(grantTestGems(state), 'low', () => 0).state;
  assert.equal(next.rewardOption, 'low:critChance');
});

test('equipping consumes exactly one copy, overwrites permanently and cannot be removed', () => {
  const start = { ...initialProgress('ko'), inventory: ['low:damage', 'low:damage', 'low:critDamage'] };
  const first = equip(start, 0, 'low:damage');
  assert.deepEqual(first.inventory, ['low:damage', 'low:critDamage']);
  assert.equal(equip(first, 0, 'low:damage'), first);
  assert.equal(equip(first, 0, null), first);
  const both = equip(first, 1, 'low:damage');
  const replaced = equip(both, 0, 'low:critDamage');
  assert.deepEqual(replaced.slots, ['low:critDamage', 'low:damage']);
  assert.deepEqual(replaced.inventory, []);
  assert.equal(equip(replaced, 0, 'low:damage'), replaced);
  assert.deepEqual(parseProgress(JSON.stringify(replaced)), replaced);
  assert.deepEqual(start.inventory, ['low:damage', 'low:damage', 'low:critDamage']);
});

test('v8 migration subtracts equipped copies once and retains unused copies and slots', () => {
  const old = { ...initialProgress('ko'), version: 8, inventory: ['low:damage', 'low:damage', 'low:damage'], slots: ['low:damage', 'low:damage'] };
  const state = parseProgress(JSON.stringify(old));
  assert.equal(state.version, 9);
  assert.deepEqual(state.slots, old.slots);
  assert.deepEqual(state.inventory, ['low:damage']);
  assert.deepEqual(parseProgress(JSON.stringify(state)), state);
});

test('every tier supports matching options and stacks only when both copies are owned', () => {
  for (const tier of GEM_TIERS) for (const roll of [0, 0.5, 0.9]) {
    const base = grantTestGems(initialProgress('ko'));
    const first = openGem(base, tier, () => roll);
    const equipped = equip(first.state, 0, first.item);
    assert.equal(equip(equipped, 1, first.item), equipped);
    const second = openGem(equipped, tier, () => roll);
    const both = equip(second.state, 1, first.item);
    const info = optionInfo(first.item), stats = combatStats(both);
    assert.equal(stats.min, 1 + info.damage * 2);
    assert.equal(stats.critChance, 2 + info.critChance * 2);
    assert.equal(stats.critDamage, 105 + info.critDamage * 2);
    assert.deepEqual(parseProgress(JSON.stringify(both)), both);
  }
});

test('v3 migration preserves legacy equipment and progress without inventing gem rewards', () => {
  const old = { ...ready(), version: 3, axeLevel: 15, inventory: ['damage', 'damage'], slots: ['damage', 'damage'] };
  for (const key of ['gems', 'growthRewardClaimed', 'rewardOption', 'gemSlotQuestDone']) delete old[key];
  const restored = parseProgress(JSON.stringify(old));
  assert.equal(restored.version, 9);
  assert.deepEqual(restored.inventory, []);
  assert.deepEqual(restored.slots, old.slots);
  assert.equal(restored.harvested, old.harvested);
  assert.equal(restored.growthRewardClaimed, false);
  assert.equal(combatStats(restored).min, 22);
  assert.equal(claimGrowthReward(restored).gems.low, 1);
});

test('malformed gem inventories, reward flags and over-equipped saves are rejected', () => {
  const state = ready();
  for (const patch of [{ gems: {} }, { gems: { ...state.gems, low: -1 } },
    { gems: { ...state.gems, high: 0.5 } }, { growthRewardClaimed: 'yes' },
    { rewardOption: 'low:damage' }, { gemSlotQuestDone: true },
    { inventory: ['low:fake'] }, { version: 8, inventory: ['low:damage'], slots: ['low:damage', 'low:damage'] }]) {
    assert.throws(() => parseProgress(JSON.stringify({ ...state, ...patch })));
  }
});
