import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress } from './progression.ts';
import { forestShortcutUnlocks } from './shortcut-unlocks.ts';

test('forest shortcuts unlock in axe, gem, map, squirrel order', () => {
  const start = initialProgress('ko');
  assert.deepEqual(forestShortcutUnlocks(start), { gems: false, map: false, pet: false });
  const gemReward = { ...start, growthRewardClaimed: true };
  assert.deepEqual(forestShortcutUnlocks(gemReward), { gems: true, map: false, pet: false });
  const openedGem = { ...gemReward, rewardOption: 'low:damage' };
  assert.deepEqual(forestShortcutUnlocks(openedGem), { gems: true, map: true, pet: false });
  assert.deepEqual(forestShortcutUnlocks(openedGem, { owned: true, questReady: true, trips: 0, trip: null }),
    { gems: true, map: true, pet: true });
});

test('past community claims preserve map access for existing server accounts', () => {
  const progress = initialProgress('en');
  const claimedQuest = { owned: false, questReady: true, trips: 0, trip: null };
  assert.deepEqual(forestShortcutUnlocks(progress, claimedQuest), { gems: true, map: true, pet: false });
  assert.deepEqual(forestShortcutUnlocks(progress, { ...claimedQuest, owned: true }),
    { gems: true, map: true, pet: true });
});
