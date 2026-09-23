import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, drawWoodGem, WOOD_GEM_COST, GEM_VALUES, GEM_TIERS, parseProgress, openGem } from './progression.ts';
const ready = () => ({ ...initialProgress('ko'), wood: 10000, harvested: 25000 });
test('draw spends exactly wood cost and awards a gem, not an option or equipment', () => {
  const state = ready();
  const result = drawWoodGem(state, () => 0.8);
  assert.equal(result.tier, 'medium');
  assert.deepEqual(result.state, { ...state, wood: 0, gems: { ...state.gems, medium: 1 } });
  assert.equal(state.wood, WOOD_GEM_COST);
  assert.equal(drawWoodGem(result.state), null);
  assert.deepEqual(parseProgress(JSON.stringify(result.state)), result.state);
  const opened = openGem(result.state, 'medium', () => 0);
  assert.equal(opened.item, 'medium:damage');
  assert.equal(opened.state.gems.medium, 0);
  assert.deepEqual(opened.state.slots, [null, null]);
});
test('odds and exact boundaries are 70/25/5 and never award later tiers', () => {
  const counts = { low: 0, medium: 0, high: 0 };
  for (let i = 0; i < 10000; i++) counts[drawWoodGem(ready(), () => i / 10000).tier]++;
  assert.deepEqual(counts, { low: 7000, medium: 2500, high: 500 });
  for (const [roll, tier] of [[0, 'low'], [0.69999, 'low'], [0.7, 'medium'], [0.94999, 'medium'], [0.95, 'high'], [0.99999, 'high']]) {
    assert.equal(drawWoodGem(ready(), () => roll).tier, tier);
  }
});
test('invalid rolls and insufficient funds never award or charge; tier values increase', () => {
  for (const roll of [-1, 1, NaN, Infinity]) assert.equal(drawWoodGem(ready(), () => roll), null);
  assert.equal(drawWoodGem({ ...ready(), wood: 9999 }, () => { throw Error('must not roll'); }), null);
  for (let i = 1; i < GEM_TIERS.length; i++) for (const kind of ['damage', 'critChance', 'critDamage']) {
    assert.ok(GEM_VALUES[GEM_TIERS[i]][kind] > GEM_VALUES[GEM_TIERS[i - 1]][kind]);
  }
});
