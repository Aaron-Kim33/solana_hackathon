import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inputWindowDecision } from './input-window.ts';
test('inputs wait for batching and serialization, then send once free', () => {
  assert.equal(inputWindowDecision(599, false, false), 'wait');
  assert.equal(inputWindowDecision(600, false, false), 'send');
  assert.equal(inputWindowDecision(900, true, true), 'wait');
  assert.equal(inputWindowDecision(950, false, false), 'send');
});
test('long delay and unknown result do not build an offline input backlog', () => {
  assert.equal(inputWindowDecision(2000, true, true), 'discard');
  assert.equal(inputWindowDecision(700, false, true), 'discard');
  assert.equal(inputWindowDecision(-1, false, false), 'discard');
});
