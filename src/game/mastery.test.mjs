import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, masteryBonus, recoveryOwned, equipAxeSkin, combatStats, hit, parseProgress, xpFloor, hitXpBonusPercent, defeatCoins, upgrade } from './progression.ts';
function ready() {
  return { ...initialProgress('en'), treeLevel: 101, treeHp: 10300, xp: xpFloor(20),
    firstRecordClaimed: true, receipt: { status: 'confirmed', address: 'test', signature: 'test' },
    skinQuestHarvestStart: 0, harvested: 1000, walletCompleted: true,
    growthRewardClaimed: true, rewardOption: 'low:damage', gemSlotQuestDone: true,
    adventureClaimed: 4, axeLevel: 150, unequippedAxeLevels: { firstRecord: 150, pioneer: 150, warden: 150 } };
}
test('all mastery thresholds are totals, survive switching and cap at 150', () => {
  for (const axe of ['default', 'firstRecord', 'pioneer', 'warden']) {
    const values = axe === 'pioneer' ? [0, 2, 5, 8] : axe === 'warden' ? [0, 3, 6, 10] : [0, 1, 2, 3];
    for (const level of [1, 49, 50, 99, 100, 149, 150, 200]) {
      let state = ready();
      if (axe === 'default') state.axeLevel = level;
      else state.unequippedAxeLevels[axe] = level;
      assert.equal(masteryBonus(state, axe), values[Math.min(3, Math.floor(level / 50))]);
      const switched = equipAxeSkin(state, 'firstRecord');
      assert.equal(masteryBonus(switched, axe), masteryBonus(state, axe));
      assert.equal(masteryBonus(parseProgress(JSON.stringify(switched)), axe), masteryBonus(state, axe));
    }
  }
});
test('damage and XP add to talents; crit is percentage points; only defeat coins increase', () => {
  const state = { ...equipAxeSkin(ready(), 'warden'), talents: { lumber: 10, learning: 10, autoCollect: 0 } };
  const stats = combatStats(state);
  assert.equal(stats.min, Math.round((150 + 249 + 1) * 1.53 * 100) / 100);
  assert.equal(stats.critDamage, 134);
  assert.equal(hitXpBonusPercent(state), 23);
  assert.equal(defeatCoins(state), 4363);
  let index = 0;
  const strike = hit({ ...state, treeHp: 1 }, 0, () => [0, 0.99, 0.99, 0, 0.99][index++]);
  assert.equal(strike.coins, 4363 + 11);
  assert.equal(strike.xpGained, 124);
  assert.equal(strike.state.xpBonusRemainder, 23);
});
test('recovery unlocks at Pioneer 150 and retains its independent upgrade level', () => {
  const locked = ready(); locked.unequippedAxeLevels.pioneer = 149;
  assert.equal(recoveryOwned(locked), false);
  assert.equal(equipAxeSkin(locked, 'recovery'), locked);
  const state = equipAxeSkin(ready(), 'recovery');
  assert.equal(state.axeLevel, 1);
  assert.equal(combatStats(state).min, 207.03); // 200 + permanent 1, with global 3% mastery.
  assert.equal(combatStats(state).max, 207.03);
  const next = upgrade({ ...state, coins: 100 }, 'axe');
  assert.equal(next.axeLevel, 2);
  assert.equal(next.unequippedAxeLevels.pioneer, 150);
  assert.deepEqual(parseProgress(JSON.stringify(next)), next);
});
test('recovery prevents exactly 30% of fatigue increments, never heals or bypasses full fatigue', () => {
  const state = equipAxeSkin(ready(), 'recovery');
  let prevented = 0;
  for (let i = 0; i < 1000; i++) {
    let call = 0;
    const result = hit(state, 0, () => ++call === 6 ? i / 1000 : 0.99);
    prevented += Number(result.fatigueSaved);
    assert.equal(result.state.fatigue, result.fatigueSaved ? 0 : 1);
    assert.equal(result.state.recoveryAt, result.fatigueSaved ? null : 0);
    assert.deepEqual(parseProgress(JSON.stringify(result.state)), result.state);
  }
  assert.equal(prevented, 300);
  assert.equal(hit({ ...state, fatigue: 100, recoveryAt: 0 }, 0, () => 0), null);
  const tired = hit({ ...state, fatigue: 99, recoveryAt: 0 }, 0, () => 0);
  assert.equal(tired.state.fatigue, 99);
});
