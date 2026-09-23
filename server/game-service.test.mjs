import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress } from '../src/game/progression.ts';
import { createMemoryGameService, assertRankingEligible } from './game-service.ts';
const setup = () => createMemoryGameService({ revision: 0, provenance: 'local-test', progress: { ...initialProgress('ko'), gems: { low: 6, medium: 0, high: 0, supreme: 0, legendary: 0 } } }, () => 0);
const request = { requestId: 'request_001', expectedRevision: 0, command: { type: 'fuse', tier: 'low' } };
test('retry executes once, conflicts and ID reuse cannot spend again', () => {
  const service = setup(), first = service.execute(request);
  assert.equal(first.progress.gems.low, 3);
  assert.equal(first.progress.gems.medium, 1);
  assert.deepEqual(service.execute(request), first);
  assert.throws(() => service.execute({ ...request, requestId: 'request_002' }), /REVISION_CONFLICT/);
  assert.throws(() => service.execute({ ...request, command: { type: 'drawGem' } }), /REQUEST_ID_REUSED/);
  first.progress.gems.low = 999;
  assert.equal(service.load().progress.gems.low, 3);
});
test('reject client balances, RNG, unknown commands and invalid revisions', () => {
  for (const bad of [null, {}, { ...request, wood: 999 }, { ...request, expectedRevision: -1 },
    { ...request, command: { type: 'fuse', tier: 'low', random: 0 } },
    { ...request, command: { type: 'fuse', tier: 'bogus' } }, { ...request, command: { type: 'grantTestGems' } }]) {
    const service = setup(); assert.throws(() => service.execute(bad), /INVALID_COMMAND/);
    assert.equal(service.load().revision, 0);
  }
});
test('test provenance cannot become ranking eligible; unavailable actions do not mutate', () => {
  const service = setup();
  assert.throws(() => assertRankingEligible(service.execute(request)), /TEST_PROGRESS_EXCLUDED/);
  assert.throws(() => service.execute({ requestId: 'request_003', expectedRevision: 1, command: { type: 'claimWardenReward' } }), /ACTION_UNAVAILABLE/);
  assert.equal(service.load().revision, 1);
});
