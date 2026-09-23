import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canLeaveServer, canQueueServerHit } from './server-input-policy.ts';
const idle = { busy: false, queued: 0, pending: null, dragging: false };
test('navigation never abandons an in-flight or uncertain server action', () => {
  assert.equal(canLeaveServer(idle), true);
  for (const change of [{ busy: true }, { queued: 1 }, { pending: 'hitBatch' }, { pending: 'collectDrop' }, { dragging: true }]) {
    assert.equal(canLeaveServer({ ...idle, ...change }), false);
  }
});
test('in-flight commands can buffer taps after dragging ends; unknown replies block', () => {
  assert.equal(canQueueServerHit(idle), true);
  assert.equal(canQueueServerHit({ ...idle, busy: true, pending: 'hitBatch' }), true);
  assert.equal(canQueueServerHit({ ...idle, busy: true, pending: 'collectDrop' }), true);
  for (const change of [{ dragging: true }, { queued: 12 }, { busy: true }, { pending: 'hitBatch' }]) {
    assert.equal(canQueueServerHit({ ...idle, ...change }), false);
  }
});
