import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = file => readFileSync(new URL(file, import.meta.url), 'utf8');

test('submission panels hide unavailable purchases and server talents but retain local talents', () => {
  const panel = source('./CharacterPanel.tsx');
  assert.ok(!panel.includes('GemPackages'));
  assert.ok(panel.includes("!serverCommand && button(t('talents')"));
  assert.ok(panel.includes("page === 'talents' && !serverCommand"));
});

test('short guide retains save separation, irreversible spending and optional real fees', () => {
  const guide = source('./PlayGuide.tsx');
  for (const text of ['무료 메시지 서명', '실제 SOL 네트워크 수수료', '불이익이 없어요', 'NFT', '업로드되지 않아요', '덮어쓴 옵션은 돌아오지 않아요']) {
    assert.ok(guide.includes(text), text);
  }
  assert.ok(!guide.includes('Current demo status'));
});

test('life tree effects are native-driven and finite, with no repeating timers', () => {
  const tree = source('./CommunityLifeTree.tsx');
  assert.ok(tree.includes('pointerEvents="none"'));
  assert.ok(tree.includes('useNativeDriver: true'));
  assert.ok(tree.includes('animation.stop()'));
  assert.ok(!/Animated\.loop|setInterval|setTimeout/.test(tree));
  assert.ok(tree.includes('life-tree-v2.png'));
  const world = source('./CommunityWorld.tsx');
  assert.ok(world.includes('now >= pet.trip.returnsAt'));
  assert.ok(!tree.includes('petVisible'));
  assert.ok(world.includes('pet && petVisible'));
  assert.ok(world.includes("left: '50%', marginLeft: -143"));
});

test('tree opens an informational sheet without a new reward or payment command', () => {
  const tree = source('./CommunityLifeTree.tsx');
  const world = source('./CommunityWorld.tsx');
  assert.ok(tree.includes('pointerEvents="box-none"'));
  assert.ok(tree.includes('onPress={onPress}'));
  assert.ok(tree.includes('생명나무 설명 보기'));
  assert.ok(world.includes("onPress={() => setSelected('life-tree')}"));
  const sheet = world.split("{selected === 'life-tree'")[1].split("{selected === 'pet'")[0];
  assert.ok(sheet.includes('별도 재화나 버프를 주지 않아요'));
  assert.ok(sheet.includes('new squirrel expeditions'));
  assert.ok(sheet.includes("setSelected('quests')"));
  assert.ok(sheet.includes('setSelected(null)'));
  assert.ok(!sheet.includes('command('));
});
