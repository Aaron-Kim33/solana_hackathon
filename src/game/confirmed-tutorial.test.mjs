import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialProgress, dispatchTrolley } from './progression.ts';
import { confirmedCollectionTutorial } from './confirmed-tutorial.ts';
import { tutorialBit } from './tutorial.ts';

const before = initialProgress('ko');
test('direct collection only finishes storage guidance after harvested wood increases', () => {
  const command = { type: 'collectDrop', dropId: 'drop' };
  assert.equal(confirmedCollectionTutorial(command, before, before), 0);
  assert.equal(confirmedCollectionTutorial(command, before, { ...before, harvested: 3, wood: 3 }), tutorialBit('storage'));
  assert.equal(confirmedCollectionTutorial(command, before, { ...before, wood: 10 }), 0);
});
test('both trolley loading commands require confirmed cargo growth', () => {
  for (const command of [{ type: 'loadTrolley', dropId: 'drop' }, { type: 'loadTrolleyBatch', dropIds: ['a', 'b'] }]) {
    assert.equal(confirmedCollectionTutorial(command, before, before), 0);
    assert.equal(confirmedCollectionTutorial(command, before, { ...before, trolleyWood: 3 }), tutorialBit('sweep'));
    assert.equal(confirmedCollectionTutorial(command, { ...before, trolleyWood: 4 }, { ...before, trolleyWood: 3 }), 0);
  }
});
test('delivery guidance requires real cargo and a newly confirmed departure', () => {
  const loaded = { ...before, trolleyWood: 3 };
  const sent = dispatchTrolley(loaded, 1000);
  assert.equal(confirmedCollectionTutorial({ type: 'collectTrolley' }, loaded, sent), tutorialBit('trolley'));
  assert.equal(confirmedCollectionTutorial({ type: 'collectTrolley' }, loaded, loaded), 0);
  assert.equal(confirmedCollectionTutorial({ type: 'collectTrolley' }, before, sent), 0);
  assert.equal(confirmedCollectionTutorial({ type: 'collectTrolley' }, sent, sent), 0);
});
test('unrelated gains cannot complete a collection tutorial', () => {
  assert.equal(confirmedCollectionTutorial({ type: 'collectSquirrel' }, before, { ...before, harvested: 10, trolleyWood: 3 }), 0);
  const original = structuredClone(before);
  confirmedCollectionTutorial({ type: 'collectDrop', dropId: 'x' }, before, before);
  assert.deepEqual(before, original);
});
test('confirmed steps accumulate without losing storage when rapid commands finish together', () => {
  const collected = { ...before, harvested: 2, wood: 2 };
  const loaded = { ...collected, trolleyWood: 3 };
  const mask = confirmedCollectionTutorial({ type: 'collectDrop', dropId: 'a' }, before, collected)
    | confirmedCollectionTutorial({ type: 'loadTrolleyBatch', dropIds: ['b'] }, collected, loaded);
  assert.equal(mask, tutorialBit('storage') | tutorialBit('sweep'));
});
test('server tutorial completion runs after response validation, not queue acceptance', () => {
  const source = readFileSync(new URL('./ServerLoginPanel.tsx', import.meta.url), 'utf8');
  assert.ok(source.indexOf('response = updateState(response)!;') < source.indexOf('const tutorialMask = confirmedCollectionTutorial'));
  assert.match(source, /setConfirmedTutorialMask\(current => current \| tutorialMask\)/);
  const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /if \([^\n]*command\([^\n]*\)\) completeTutorial\('(storage|sweep|trolley)'\)/);
  assert.match(app, /server\?\.resetTutorialConfirmations\(\)/);
});
test('worlds, pet dialog and nested boss rewards expose server notices and safe retry', () => {
  const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
  const boss = readFileSync(new URL('./WorldBossWorld.tsx', import.meta.url), 'utf8');
  assert.match(app, /panel !== 'menu' && <ServerActionNotice/);
  assert.match(app, /online && <ServerActionNotice/);
  assert.match(boss, /actionNotice && <ServerActionNotice/);
  const notice = readFileSync(new URL('./ServerActionNotice.tsx', import.meta.url), 'utf8');
  assert.match(notice, /disabled=\{busy\}/);
  assert.match(notice, /maxHeight: 65/);
});
