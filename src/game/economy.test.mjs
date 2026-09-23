import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, hit, collect, upgrade, regrow, xpFloor, xpRequired, characterLevel,
  parseProgress, treeHealth, treeCoins, hitXp, bonusCoins, COIN_CHANCE, questSteps } from './progression.ts';
const rolls = (...values) => () => values.shift() ?? 0.99;

test('hit XP scales with tree level, not damage, criticals or collected wood', () => {
  for (const level of [1, 10, 100, 500, 1000]) {
    const state = { ...initialProgress('ko'), treeLevel: level, treeHp: treeHealth(level) };
    for (const axeLevel of [1, 200]) for (const crit of [0, 0.99]) {
      const result = hit({ ...state, axeLevel }, 0, rolls(0, crit, 0, 0.99));
      assert.equal(result.state.xp, hitXp(level));
      assert.equal(collect(result.state, 99999).xp, hitXp(level));
    }
  }
});

test('zero-yield hits grant XP; blocked hits grant neither XP nor coins', () => {
  const zero = hit(initialProgress('en'), 0, rolls(0, 0.99, 0.99, 0.99));
  assert.equal(zero.value, 0);
  assert.equal(zero.state.xp, 1);
  for (const patch of [{ treeHp: 0 }, { fatigue: 100, recoveryAt: 0 }]) {
    assert.equal(hit({ ...initialProgress('en'), ...patch }, 1), null);
  }
});

test('coins guarantee defeat rewards, independent 5% bonuses and repeat-tree rewards', () => {
  for (const level of [1, 10, 100, 1000]) {
    const state = { ...initialProgress('ko'), treeLevel: level, treeHp: 1 };
    const normal = hit(state, 0, rolls(0, 0.99, 0.99, COIN_CHANCE));
    assert.equal(normal.coins, treeCoins(level));
    const bonus = hit(state, 0, rolls(0, 0.99, 0.99, COIN_CHANCE - 0.000001));
    assert.equal(bonus.coins, treeCoins(level) + bonusCoins(level));
    assert.equal(bonus.state.coins, bonus.coins);
    const repeated = hit({ ...regrow(normal.state), treeHp: 1 }, 0, rolls(0, 0.99, 0.99, 0.99));
    assert.equal(repeated.state.coins, treeCoins(level) * 2);
    assert.equal(hit(normal.state, 0), null);
  }
  let count = 0;
  for (let i = 0; i < 1000; i++) if (hit(initialProgress('ko'), 0, rolls(0, 0.99, 0.99, i / 1000)).coinBonus) count++;
  assert.equal(count, 50);
});

test('axes spend coins only, trees spend wood only and new tree XP cannot repeat', () => {
  const state = { ...initialProgress('ko'), coins: 20, wood: 30, harvested: 30, treeHp: 0 };
  const axe = upgrade(state, 'axe');
  assert.equal(axe.coins, 0);
  assert.equal(axe.wood, 30);
  assert.equal(axe.axeLevel, 2);
  assert.equal(upgrade(axe, 'axe'), axe);
  const tree = upgrade(state, 'tree');
  assert.equal(tree.wood, 0);
  assert.equal(tree.coins, 20);
  assert.equal(tree.xp, 20);
  assert.equal(upgrade(tree, 'tree'), tree);
  assert.equal(regrow({ ...tree, treeHp: 0 }).xp, 20);
  const richWood = { ...state, coins: 0, wood: 99999, harvested: 99999 };
  assert.equal(upgrade(richWood, 'axe'), richWood);
});

test('level-up resets fatigue on hits and tree upgrades, never on wood pickup', () => {
  const state = { ...initialProgress('en'), xp: xpFloor(2) - 1, fatigue: 99, recoveryAt: 0 };
  const result = hit(state, 0, rolls(0, 0.99, 0.99, 0.99));
  assert.equal(result.state.fatigue, 0);
  assert.equal(result.state.recoveryAt, null);
  assert.equal(characterLevel(result.state.xp), 2);
  const tree = upgrade({ ...state, wood: 30, harvested: 30, treeHp: 0 }, 'tree');
  assert.equal(tree.fatigue, 0);
  assert.equal(collect(state, 10000).fatigue, 99);
});

test('XP curve is strictly increasing and every level boundary is exact', () => {
  assert.equal(xpFloor(1), 0);
  for (let level = 1; level < 200; level++) {
    assert.ok(xpRequired(level) > 0);
    assert.equal(characterLevel(xpFloor(level + 1) - 1), level);
    assert.equal(characterLevel(xpFloor(level + 1)), level + 1);
  }
  assert.equal(characterLevel(Number.MAX_SAFE_INTEGER), 200);
});

test('v4 migration preserves all 200 character levels and fractional progress, once only', () => {
  for (let level = 1; level <= 200; level++) {
    const old = { ...initialProgress('ko'), version: 4, xp: 15 * level * (level - 1) + 15 * level,
      wood: 100, harvested: 100, fatigue: 99, recoveryAt: 1234, axeLevel: 15, treeLevel: 10 };
    delete old.coins;
    const next = parseProgress(JSON.stringify(old));
    assert.equal(next.version, 9);
    assert.equal(characterLevel(next.xp), level);
    assert.equal(next.xp, xpFloor(level) + Math.floor(xpRequired(level) / 2));
    for (const key of ['wood', 'harvested', 'fatigue', 'recoveryAt', 'axeLevel', 'treeLevel']) assert.equal(next[key], old[key]);
    assert.equal(next.coins, 0);
    assert.deepEqual(parseProgress(JSON.stringify(next)), next);
  }
});

test('completed old quests and rewards survive migration without re-claiming', () => {
  const old = { ...initialProgress('en'), version: 4, xp: 3150, wood: 100, harvested: 1000,
    axeLevel: 15, treeLevel: 10, walletCompleted: true, receipt: { address: 'test', signature: 'test', status: 'confirmed' },
    firstRecordClaimed: true, axeSkin: 'firstRecord', skinQuestHarvestStart: 900,
    growthRewardClaimed: true, rewardOption: 'low:damage', gemSlotQuestDone: true,
    inventory: ['low:damage'], slots: ['low:damage', null] };
  const next = parseProgress(JSON.stringify(old));
  assert.equal(characterLevel(next.xp), 15);
  assert.ok(questSteps(next).slice(0, 13).every(status => status === 'complete'));
  assert.equal(next.gems.low, 0);
});

test('invalid coin saves are rejected', () => {
  for (const coins of [-1, 0.5, null, '10', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => parseProgress(JSON.stringify({ ...initialProgress('ko'), coins })));
  }
});
