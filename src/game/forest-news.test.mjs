import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { forestNews } from './forest-news.ts';

const base = { now: 100, petUnlocked: true, farmUnlocked: true, mapUnlocked: true };
const pet = { owned: true, questReady: false, trips: 1,
  trip: { destination: 'mine', departedAt: 0, returnsAt: 100, reward: 40 } };
const farm = { plots: [{ plantedAt: 0, readyAt: 100, quick: false }, null] };
const boss = { rewards: [{ ready: true, claimed: false, weekStart: -100 }] };

test('forest news shows only one ready item in pet, farm, boss order', () => {
  assert.equal(forestNews({ ...base, pet, farm, boss }), 'pet');
  assert.equal(forestNews({ ...base, pet: { ...pet, trip: null }, farm, boss }), 'farm');
  assert.equal(forestNews({ ...base, farm: { plots: [null, null] }, boss }), 'boss');
  assert.equal(forestNews(base), null);
});

test('pet news requires a real returned trip, not idle ownership or quest eligibility', () => {
  assert.equal(forestNews({ ...base, pet, now: 99 }), null);
  assert.equal(forestNews({ ...base, pet: { ...pet, trip: null } }), null);
  assert.equal(forestNews({ ...base, pet: { ...pet, owned: false, questReady: true } }), null);
  assert.equal(forestNews({ ...base, pet, petUnlocked: false }), null);
});

test('farm news excludes unwatered and growing seeds and respects unlocks', () => {
  for (const readyAt of [0, 101]) {
    assert.equal(forestNews({ ...base, farm: { plots: [{ readyAt }, null] } }), null);
  }
  assert.equal(forestNews({ ...base, farm, farmUnlocked: false }), null);
  assert.equal(forestNews({ ...base, farm, mapUnlocked: false }), null);
  assert.equal(forestNews({ ...base, farm: { plots: [null, farm.plots[0]] } }), 'farm');
});

test('boss news uses server eligibility for personal/shared and older unclaimed weeks', () => {
  assert.equal(forestNews({ ...base, boss }), 'boss');
  assert.equal(forestNews({ ...base, boss: { sharedRewards: boss.rewards } }), 'boss');
  for (const reward of [{ ready: true, claimed: true }, { ready: false, claimed: false }]) {
    assert.equal(forestNews({ ...base, boss: { rewards: [reward], sharedRewards: [reward] } }), null);
  }
  assert.equal(forestNews({ ...base, boss: { totalDamage: 999999, hits: 100 } }), null);
  assert.equal(forestNews({ ...base, boss, mapUnlocked: false }), null);
});

test('news stays out of layout flow and opens boss rewards without claiming', () => {
  const component = readFileSync(new URL('./ForestNews.tsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
  const world = readFileSync(new URL('./WorldBossWorld.tsx', import.meta.url), 'utf8');
  assert.match(component, /position: 'absolute'/);
  assert.match(component, /minHeight: 44/);
  assert.doesNotMatch(component, /setInterval|Animated|command\(/);
  assert.match(app, /!tutorialStep && !gameplayNotice && !isHolding && mode !== 'collect'/);
  assert.match(app, /initialRewardsOpen=\{bossRewardsOnEntry\}/);
  assert.match(world, /useState\(initialRewardsOpen\)/);
});
