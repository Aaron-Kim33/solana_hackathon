import test from 'node:test';
import assert from 'node:assert/strict';
import { questView } from './quest-view.ts';

test('quest display advances at every chapter boundary and hides completed cards', () => {
  for (const [active, chapter, indices] of [
    [0, 'questFirstSteps', [0, 1, 2, 3, 4, 5]],
    [5, 'questFirstSteps', [5]], [6, 'questFirstRecord', [6, 7, 8]],
    [8, 'questFirstRecord', [8]], [9, 'questGrowth', [9, 10]],
    [10, 'questGrowth', [10]], [11, 'questGemPower', [11, 12]],
    [12, 'questGemPower', [12]],
  ]) {
    const statuses = Array.from({ length: 13 }, (_, i) => i < active ? 'complete' : i === active ? 'active' : 'locked');
    const view = questView(statuses);
    assert.equal(view.chapter, chapter);
    assert.deepEqual(view.entries.map(entry => entry.index), indices);
    assert.equal(view.active, active);
  }
});

test('finishing the gem quest shows completion instead of restarting first steps', () => {
  const view = questView(Array(13).fill('complete'));
  assert.equal(view.chapter, 'questsFinished');
  assert.equal(view.active, -1);
  assert.deepEqual(view.entries, []);
});
