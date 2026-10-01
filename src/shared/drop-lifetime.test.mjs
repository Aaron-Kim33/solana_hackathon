import test from 'node:test';
import assert from 'node:assert/strict';
import { WOOD_DROP_VISIBLE_MS, WOOD_DROP_GRACE_MS, WOOD_DROP_ACCEPT_MS, visibleDropExpiry } from './drop-lifetime.ts';

test('logs disappear at five seconds while server acceptance lasts six', () => {
  const createdAt = 100_000;
  const serverExpiry = createdAt + WOOD_DROP_ACCEPT_MS;
  assert.equal(WOOD_DROP_VISIBLE_MS, 5000);
  assert.equal(WOOD_DROP_GRACE_MS, 1000);
  assert.equal(visibleDropExpiry(serverExpiry), createdAt + 5000);
  assert.equal(serverExpiry, createdAt + 6000);
});
