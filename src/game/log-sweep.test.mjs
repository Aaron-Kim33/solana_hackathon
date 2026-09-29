import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitTrolleyLogs, sweptLogIds } from './log-sweep.ts';

test('one fast sweep crosses multiple ground logs, including between touch samples', () => {
  const forest = { x: 20, y: 100, width: 400, height: 300 };
  const logs = [
    { id: 1, left: 20, bottom: 10, expiresAt: 6000 },
    { id: 2, left: 45, bottom: 10, expiresAt: 6000 },
    { id: 3, left: 70, bottom: 10, expiresAt: 6000 },
  ];
  assert.deepEqual(sweptLogIds(logs, forest, { x: 80, y: 355 }, { x: 390, y: 355 }, 1000), [1, 2, 3]);
  assert.deepEqual(sweptLogIds(logs, forest, { x: 80, y: 220 }, { x: 390, y: 220 }, 1000), []);
  assert.deepEqual(sweptLogIds(logs, forest, { x: 80, y: 355 }, { x: 390, y: 355 }, 6000), []);
});

test('sweep fills only the available cart space and leaves oversized logs on the ground', () => {
  const logs = [{ id: 1, value: 5 }, { id: 2, value: 12 }, { id: 3, value: 3 }];
  assert.deepEqual(fitTrolleyLogs(logs, 10).map(log => log.id), [1, 3]);
  assert.deepEqual(fitTrolleyLogs(logs, 0), []);
  assert.deepEqual(fitTrolleyLogs(logs, 20).map(log => log.id), [1, 2, 3]);
});
