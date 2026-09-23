import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimit } from './rate-limit.mjs';

test('rate limits isolate identities and expire without retaining unlimited keys', () => {
  let time = 0;
  const take = createRateLimit({ limit: 2, windowMs: 100, maxKeys: 2, now: () => time });
  take('a'); take('a');
  assert.throws(() => take('a'), /RATE_LIMITED/);
  take('b'); take('b');
  assert.throws(() => take('c'), /RATE_LIMITED/);
  time = 100;
  take('c'); take('a');
});
