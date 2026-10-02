import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, claimAdventure, questSteps, fatiguePotionCount, useFatiguePotion, parseProgress, xpFloor, treeHealth } from './progression.ts';
import { readFileSync } from 'node:fs';

export const ready = () => ({ ...initialProgress('ko'), treeLevel: 20, treeHp: treeHealth(20), axeLevel: 25,
  xp: xpFloor(5), harvested: 1000, walletCompleted: true, firstRecordClaimed: true, skinQuestHarvestStart: 900,
  growthRewardClaimed: true, rewardOption: 'low:damage', gemSlotQuestDone: true,
  slots: ['low:damage', 'low:damage'], adventureClaimed: 1, fatigue: 100, recoveryAt: 1000 });

test('second-slot quest grants one potion immediately before Forest Pioneer, without replaying rewards', () => {
  const before = ready();
  assert.equal(fatiguePotionCount(before), 0);
  const after = claimAdventure(before);
  assert.equal(after.adventureClaimed, 2);
  assert.equal(questSteps(after)[15], 'active');
  assert.equal(after.coins, before.coins + 300);
  assert.equal(fatiguePotionCount(after), 1);
  assert.equal(fatiguePotionCount(parseProgress(JSON.stringify(after))), 1);
  // Further reward claims must not produce another potion.
  assert.equal(fatiguePotionCount(claimAdventure(after)), 1);
});

test('one potion resets full or partial fatigue and recovery timer without changing growth', () => {
  for (const fatigue of [1, 50, 100]) {
    const before = { ...ready(), adventureClaimed: 2, fatigue };
    const after = useFatiguePotion(before);
    assert.equal(after.fatigue, 0);
    assert.equal(after.recoveryAt, null);
    assert.equal(fatiguePotionCount(after), 0);
    for (const key of ['wood', 'coins', 'xp', 'treeHp', 'treeLevel', 'axeLevel', 'adventureClaimed']) assert.deepEqual(after[key], before[key]);
    assert.equal(fatiguePotionCount(parseProgress(JSON.stringify(after))), 0);
    const tiredAgain = { ...after, fatigue: 90, recoveryAt: 2000 };
    assert.equal(useFatiguePotion(tiredAgain), tiredAgain);
  }
});

test('no potion and already fresh states never consume or grant items', () => {
  const locked = ready();
  assert.equal(useFatiguePotion(locked), locked);
  const fresh = { ...ready(), adventureClaimed: 2, fatigue: 0, recoveryAt: null };
  assert.equal(useFatiguePotion(fresh), fresh);
  assert.equal(fatiguePotionCount(fresh), 1);
});

test('legacy saves receive the one quest potion; spent potion cannot regenerate on reload', () => {
  const legacy = { ...ready(), adventureClaimed: 2 };
  const loaded = parseProgress(JSON.stringify(legacy));
  assert.equal(fatiguePotionCount(loaded), 1);
  const spent = useFatiguePotion(loaded);
  for (let i = 0; i < 3; i++) assert.equal(fatiguePotionCount(parseProgress(JSON.stringify(spent))), 0);
  for (const value of [-1, 2, 0.5, '1', null, true]) {
    assert.throws(() => parseProgress(JSON.stringify({ ...legacy, fatiguePotionsUsed: value })), /INVALID_SAVE/);
  }
  assert.throws(() => parseProgress(JSON.stringify({ ...ready(), fatiguePotionsUsed: 1 })), /INVALID_SAVE/);
});

test('potion UI includes count, disabled state and explicit confirmation before use', () => {
  const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /Alert\.alert\(t\('fatiguePotion'\), t\('fatiguePotionConfirm'\)/);
  assert.match(app, /fatiguePotionCount\(progress\) <= 0/);
  assert.match(app, /onPress=\{handleFatiguePotion\}/);
  assert.match(app, /potionButtonInactive: \{ backgroundColor:/);
  assert.match(app, /t\('fatiguePotionShort'\)/);
  const inactiveStyle = app.match(/potionButtonInactive: \{([^}]+)\}/)?.[1];
  assert.ok(inactiveStyle);
  assert.doesNotMatch(inactiveStyle, /opacity/);
});
