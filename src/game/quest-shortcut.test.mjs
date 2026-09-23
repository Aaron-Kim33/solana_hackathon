import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, questSteps } from './progression.ts';
import { questShortcut } from './quest-shortcut.ts';

test('forest shortcut follows first harvest, wallet and subsequent server quests', () => {
  const start = initialProgress('ko');
  assert.deepEqual(questShortcut(start, questSteps(start)), { key: 'firstHarvestProgress', value: 0 });
  const wallet = { ...start, wood: 20, harvested: 20 };
  assert.deepEqual(questShortcut(wallet, questSteps(wallet)), { key: 'firstHarvestReady' });
  const next = { ...wallet, walletCompleted: true };
  assert.deepEqual(questShortcut(next, questSteps(next)), { key: 'nextQuest', quest: 'qAxe' });
  assert.deepEqual(questShortcut(next, ['complete', 'complete', 'complete', 'complete', 'complete', 'active']),
    { key: 'nextQuest', quest: 'qRecord' });
  const firstEquip = { ...next, harvested: 131, skinQuestHarvestStart: 131 };
  const woodQuest = [...Array(8).fill('complete'), 'active'];
  assert.deepEqual(questShortcut(firstEquip, woodQuest), { key: 'firstRecordHarvestProgress', value: 0 });
  assert.deepEqual(questShortcut({ ...firstEquip, harvested: 166 }, woodQuest), { key: 'firstRecordHarvestProgress', value: 35 });
  assert.deepEqual(questShortcut({ ...firstEquip, harvested: 231 }, woodQuest), { key: 'firstRecordHarvestProgress', value: 100 });
  assert.equal(questShortcut(next, ['complete', 'complete']), null);
});
