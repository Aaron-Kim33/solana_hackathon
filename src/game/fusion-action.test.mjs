import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress } from './progression.ts';
import { createFusionAction } from './fusion-action.ts';
const ready = () => { const s = initialProgress('en'); return { ...s, gems: { ...s.gems, low: 6 } }; };
test('confirmation captures selected recipe and promotes Supreme to Legendary once', () => {
  let state = ready(); state.gems.supreme = 3;
  const execute = createFusionAction(() => state, next => { state = next; return true; }, () => 0, 'supreme');
  assert.equal(execute().status, 'saved');
  assert.equal(state.gems.legendary, 1);
  assert.equal(state.gems.supreme, 0);
  assert.equal(state.gems.low, 6);
  assert.equal(execute().status, 'duplicate');
});
test('confirmation uses latest state, commits once and ignores duplicate confirmation', () => {
  let state = ready(), writes = 0;
  const execute = createFusionAction(() => state, next => { state = next; writes++; return true; }, () => 0);
  state = { ...state, wood: 10, harvested: 10 };
  assert.equal(execute().status, 'saved');
  assert.equal(execute().status, 'duplicate');
  assert.equal(writes, 1);
  assert.equal(state.wood, 10);
  assert.equal(state.gems.low, 3);
  assert.equal(state.gems.medium, 1);
});
test('failed save does not report success or mutate live inventory', () => {
  const state = ready();
  const execute = createFusionAction(() => state, () => false, () => 0);
  assert.equal(execute().status, 'saveError');
  assert.equal(state.gems.low, 6);
  assert.equal(state.gems.medium, 0);
  assert.equal(execute().status, 'duplicate');
});
test('materials lost before confirmation are rechecked without rolling or saving', () => {
  let state = ready();
  const execute = createFusionAction(() => state, () => { throw Error('must not save'); }, () => { throw Error('must not roll'); });
  state = { ...state, gems: { ...state.gems, low: 0 } };
  assert.equal(execute().status, 'unavailable');
});
