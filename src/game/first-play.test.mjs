import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstHarvestPrompt } from './first-play.ts';
import { initialProgress, questSteps } from './progression.ts';

test('first-play prompt follows confirmed harvested total, not current wood balance', () => {
  assert.deepEqual(firstHarvestPrompt({ harvested: 0, walletCompleted: false }), { key: 'firstHarvestProgress', value: 0 });
  assert.deepEqual(firstHarvestPrompt({ harvested: 1, walletCompleted: false }), { key: 'firstHarvestProgress', value: 1 });
  assert.deepEqual(firstHarvestPrompt({ harvested: 19, walletCompleted: false }), { key: 'firstHarvestProgress', value: 19 });
  assert.deepEqual(firstHarvestPrompt({ harvested: 20, walletCompleted: false }), { key: 'firstHarvestReady' });
  assert.equal(firstHarvestPrompt({ harvested: 20, walletCompleted: true }), null);
});

test('20 confirmed collected wood advances the first quest to wallet connection', () => {
  const initial = initialProgress('ko');
  for (const count of [0, 1, 19]) {
    const state = { ...initial, wood: count, harvested: count };
    assert.equal(questSteps(state)[0], 'active');
    assert.deepEqual(firstHarvestPrompt(state), { key: 'firstHarvestProgress', value: count });
  }
  const ready = { ...initial, wood: 20, harvested: 20 };
  assert.deepEqual(questSteps(ready).slice(0, 2), ['complete', 'active']);
  assert.deepEqual(firstHarvestPrompt(ready), { key: 'firstHarvestReady' });
});
