import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress } from './progression.ts';
import { nextTutorial, tutorialBit, TUTORIAL_ALL_SEEN, TUTORIAL_LEGACY_ALL_SEEN } from './tutorial.ts';

test('tutorial introduces one action at a time without covering the forest on menu screens', () => {
  const start = initialProgress('ko');
  assert.equal(nextTutorial(start, 0, 0, false, false), 'chop');
  let seen = tutorialBit('chop');
  assert.equal(nextTutorial(start, seen, 0, false, false), null);
  assert.equal(nextTutorial(start, seen, 1, false, false), 'storage');
  assert.equal(nextTutorial(start, seen, 1, true, false), null);
  assert.equal(nextTutorial(start, seen, 1, false, true), null);
  seen |= tutorialBit('storage');
  assert.equal(nextTutorial(start, seen, 2, false, false), 'sweep');
  seen |= tutorialBit('sweep');
  assert.equal(nextTutorial({ ...start, trolleyWood: 3 }, seen, 1, false, false), 'trolley');
});

test('tree, axe, face and fatigue tips unlock at their real gameplay moments', () => {
  const start = initialProgress('en');
  let seen = tutorialBit('chop') | tutorialBit('storage') | tutorialBit('sweep') | tutorialBit('trolley');
  assert.equal(nextTutorial({ ...start, treeHp: 0 }, seen, 0, false, false), 'tree');
  seen |= tutorialBit('tree');
  assert.equal(nextTutorial({ ...start, coins: 20 }, seen, 0, false, false), 'axe');
  seen |= tutorialBit('axe');
  assert.equal(nextTutorial({ ...start, coins: 20 }, seen, 0, false, false), 'character');
  seen |= tutorialBit('character');
  assert.equal(nextTutorial({ ...start, fatigue: 80 }, seen, 0, false, false), 'fatigue');
  assert.equal(nextTutorial({ ...start, fatigue: 80 }, TUTORIAL_ALL_SEEN, 0, false, false), null);
});

test('gem, map and pet hints appear one at a time and old hint masks remain valid', () => {
  const state = initialProgress('ko');
  const shortcuts = { gems: true, map: true, pet: true };
  assert.equal(TUTORIAL_LEGACY_ALL_SEEN, 255);
  assert.equal(nextTutorial(state, TUTORIAL_LEGACY_ALL_SEEN, 0, false, false, shortcuts), 'gem');
  const gemSeen = TUTORIAL_LEGACY_ALL_SEEN | tutorialBit('gem');
  assert.equal(nextTutorial(state, gemSeen, 0, false, false, shortcuts), 'map');
  const mapSeen = gemSeen | tutorialBit('map');
  assert.equal(nextTutorial(state, mapSeen, 0, false, false, shortcuts), 'pet');
  assert.equal(nextTutorial(state, mapSeen | tutorialBit('pet'), 0, false, false, shortcuts), null);
  assert.equal(nextTutorial(state, TUTORIAL_LEGACY_ALL_SEEN, 0, true, false, shortcuts), null);
});
