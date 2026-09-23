import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLiveInputQueue, INPUT_QUEUE_LIMIT } from './live-input-queue.ts';
test('first tap sends immediately without a fixed batching delay', () => {
  const q = createLiveInputQueue(); q.push({ type: 'hit' }, 1000);
  assert.deepEqual(q.take(1000, 0).command, { type: 'hitBatch', count: 1 });
});
test('collection survives in-flight taps and preserves order without merging across it', () => {
  const q = createLiveInputQueue();
  q.push({ type: 'hit' }, 1000); q.push({ type: 'collectDrop', dropId: 'drop_1234' }, 1001); q.push({ type: 'hit' }, 1002);
  assert.equal(q.take(1050, 1150).wait, 100);
  assert.deepEqual(q.take(1150, 1150).command, { type: 'hitBatch', count: 1 });
  assert.deepEqual(q.take(1300, 1300).command, { type: 'collectDrop', dropId: 'drop_1234' });
  assert.deepEqual(q.take(1550, 1550).command, { type: 'hitBatch', count: 1 });
});
test('backlog is bounded, deduplicates pickups and can be discarded on suspension', () => {
  const q = createLiveInputQueue();
  q.push({ type: 'collectDrop', dropId: 'drop_1234' }, 1000); q.push({ type: 'collectDrop', dropId: 'drop_1234' }, 1001);
  assert.equal(q.size, 1);
  for (let i = 1; i < INPUT_QUEUE_LIMIT; i++) assert.equal(q.push({ type: 'hit' }, 1000), true);
  assert.equal(q.push({ type: 'hit' }, 1000), false);
  q.clear(); assert.equal(q.size, 0);
  q.push({ type: 'hit' }, 1000); assert.equal(q.take(3000, 0).command, undefined);
});
test('one-shot actions can be detected before another copy enters the queue', () => {
  const q = createLiveInputQueue();
  assert.equal(q.hasType('claimFirstRecord'), false);
  q.push({ type: 'claimFirstRecord' }, 1000);
  assert.equal(q.hasType('claimFirstRecord'), true);
  assert.equal(q.hasType('acknowledgeWallet'), false);
  q.take(1000, 0);
  assert.equal(q.hasType('claimFirstRecord'), false);
});
test('available server time limits the batch, even with rapid taps', () => {
  const q = createLiveInputQueue(); for (let i = 0; i < 6; i++) q.push({ type: 'hit' }, 1000);
  assert.deepEqual(q.take(1150, 1150).command, { type: 'hitBatch', count: 1 });
  assert.deepEqual(q.take(1750, 1300).command, { type: 'hitBatch', count: 4 });
  assert.equal(q.size, 1);
});
