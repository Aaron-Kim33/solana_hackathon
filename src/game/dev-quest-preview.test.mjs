import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, questSteps } from './progression.ts';
import { devQuestPreview } from './dev-quest-preview.ts';

test('local dev preview skips only wallet presentation without changing real progress', () => {
  const real = { ...initialProgress('ko'), harvested: 20 };
  const preview = devQuestPreview(real, true);
  assert.equal(real.walletCompleted, false);
  assert.equal(preview.walletCompleted, true);
  assert.equal(questSteps(real)[1], 'active');
  assert.equal(questSteps(preview)[2], 'active');
  assert.equal(questSteps(preview)[5], 'locked');
  assert.equal(real.receipt, null);
});
