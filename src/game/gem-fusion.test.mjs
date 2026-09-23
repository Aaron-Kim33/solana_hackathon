import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, fuseLowGems, fuseGems, GEM_TIERS, GEM_FUSION_COST, parseProgress } from './progression.ts';
const ready = () => { const s = initialProgress('en'); return { ...s, wood: 999, harvested: 999, gems: { ...s.gems, low: 3, medium: 2 } }; };
test('every non-final tier consumes only its own three gems and promotes exactly one tier', () => {
  for (let index = 0; index < 4; index++) {
    const source = GEM_TIERS[index], target = GEM_TIERS[index + 1];
    const state = { ...ready(), gems: { low: 9, medium: 9, high: 9, supreme: 9, legendary: 9 } };
    let successes = 0;
    for (let i = 0; i < 1000; i++) {
      const result = fuseGems(state, source, () => i / 1000);
      successes += Number(result.success);
      assert.equal(result.source, source);
      assert.equal(result.target, target);
      assert.deepEqual(result.state.gems, { ...state.gems, [source]: 6, [target]: 9 + Number(result.success) });
      assert.deepEqual(parseProgress(JSON.stringify(result.state)), result.state);
    }
    assert.equal(successes, 200);
    assert.equal(fuseGems({ ...state, gems: { ...state.gems, [source]: 2 } }, source), null);
  }
  assert.equal(fuseGems(ready(), 'legendary', () => { throw Error('must not roll'); }), null);
  assert.equal(fuseGems(ready(), 'invalid'), null);
});
test('fusion consumes only three unopened lows on success and failure and persists', () => {
  for (const [roll, success] of [[0, true], [0.19999, true], [0.2, false], [0.999, false]]) {
    const state = ready(), result = fuseLowGems(state, () => roll);
    assert.equal(result.success, success);
    assert.deepEqual(result.state, { ...state, gems: { ...state.gems, low: 0, medium: 2 + Number(success) } });
    assert.deepEqual(parseProgress(JSON.stringify(result.state)), result.state);
    assert.equal(fuseLowGems(result.state), null);
    assert.equal(state.gems.low, GEM_FUSION_COST);
  }
});
test('20 percent succeeds and no other tier is changed', () => {
  let successes = 0;
  for (let i = 0; i < 1000; i++) successes += Number(fuseLowGems(ready(), () => i / 1000).success);
  assert.equal(successes, 200);
});
test('insufficient materials, invalid random and overflow do not mutate state', () => {
  const state = ready();
  for (const roll of [-1, 1, NaN, Infinity]) assert.equal(fuseLowGems(state, () => roll), null);
  assert.equal(fuseLowGems({ ...state, gems: { ...state.gems, low: 2 } }, () => { throw Error('must not roll'); }), null);
  assert.equal(fuseLowGems({ ...state, gems: { ...state.gems, medium: Number.MAX_SAFE_INTEGER } }), null);
});
