import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, equipAxeSkin, wardenOwned, combatStats, hit, upgrade, parseProgress, axeLevelFor, equip, GEM_VALUES } from './progression.ts';
const ready = () => ({ ...initialProgress('en'), treeLevel: 101, treeHp: 10300, coins: 10000 });
test('second forest grants one level-one axe, including existing saves, without auto-equipping', () => {
  const before = { ...ready(), treeLevel: 100, treeHp: 0, wood: 10000, harvested: 10000 };
  assert.equal(wardenOwned(before), false);
  assert.equal(equipAxeSkin(before, 'warden'), before);
  const entered = upgrade(before, 'tree');
  assert.equal(wardenOwned(entered), true);
  assert.equal(entered.axeSkin, 'default');
  assert.equal(axeLevelFor(entered, 'warden'), 1);
  const equipped = equipAxeSkin(parseProgress(JSON.stringify(ready())), 'warden');
  assert.deepEqual(combatStats(equipped), { min: 250, max: 300, critChance: 2, critDamage: 105 });
  const raised = upgrade(equipped, 'axe');
  assert.equal(combatStats(raised).min, 251);
  assert.equal(combatStats(raised).max, 301);
  const switched = equipAxeSkin(raised, 'default');
  assert.equal(switched.axeLevel, 1);
  assert.equal(axeLevelFor(switched, 'warden'), 2);
  assert.deepEqual(parseProgress(JSON.stringify(switched)), switched);
  assert.equal(equipAxeSkin(switched, 'warden').axeLevel, 2);
});
test('Deepwood uses 250/275/300 with 50/30/20 weights before criticals and talents', () => {
  const state = equipAxeSkin(ready(), 'warden');
  const counts = { 250: 0, 275: 0, 300: 0 };
  for (let i = 0; i < 1000; i++) {
    let call = 0;
    const result = hit(state, 0, () => call++ === 0 ? i / 1000 : 0.99);
    counts[result.damage]++;
  }
  assert.deepEqual(counts, { 250: 500, 275: 300, 300: 200 });
  const talented = { ...state, talents: { ...state.talents, lumber: 10 } };
  assert.equal(combatStats(talented).max, 450);
  assert.equal(hit(talented, 0, () => 0.99).damage, 450);
});
test('medium options are upgraded for existing equipped copies without changing other tiers', () => {
  const state = equip({ ...ready(), inventory: ['medium:damage'] }, 0, 'medium:damage');
  assert.equal(combatStats(state).min, 16);
  assert.deepEqual(GEM_VALUES.medium, { damage: 15, critChance: 5, critDamage: 65 });
  assert.deepEqual(GEM_VALUES.high, { damage: 30, critChance: 10, critDamage: 130 });
  assert.deepEqual(parseProgress(JSON.stringify(state)), state);
  assert.throws(() => parseProgress(JSON.stringify({ ...ready(), treeLevel: 100, treeHp: 0, axeSkin: 'warden' })));
});
