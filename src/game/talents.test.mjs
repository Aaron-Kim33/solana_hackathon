import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, TALENT_IDS, TALENT_MAX, talentCost, talentValue, upgradeTalent,
  hit, collect, combatStats, upgrade, parseProgress, xpFloor, equipAxeSkin, displayedHitXp } from './progression.ts';
const rolls = (...values) => () => values.shift() ?? 0.99;
const rich = () => ({ ...initialProgress('ko'), wood: 1000000, harvested: 1000000 });

test('talent unlocks and upgrades spend only wood, respect caps and persist', () => {
  for (const id of TALENT_IDS) {
    const empty = initialProgress('en');
    assert.equal(upgradeTalent(empty, id), empty);
    let state = rich(), spent = 0;
    for (let rank = 0; rank < TALENT_MAX[id]; rank++) {
      const cost = talentCost(id, rank);
      const short = { ...state, wood: cost - 1 };
      assert.equal(upgradeTalent(short, id), short);
      const exact = upgradeTalent({ ...state, wood: cost }, id);
      assert.equal(exact.wood, 0);
      state = upgradeTalent(state, id); spent += cost;
      assert.equal(state.talents[id], rank + 1);
      assert.deepEqual(parseProgress(JSON.stringify(state)), state);
    }
    assert.equal(state.wood, 1000000 - spent);
    assert.equal(state.harvested, 1000000);
    assert.equal(state.coins, 0);
    assert.equal(state.xp, 0);
    assert.equal(upgradeTalent(state, id), state);
  }
});

test('lumber mastery scales normal and critical final damage but not hit XP', () => {
  for (const rank of [1, 5, 20]) {
    const base = { ...initialProgress('ko'), axeLevel: 20 };
    const buffed = { ...base, talents: { ...base.talents, lumber: rank } };
    const multiplier = 1 + rank * 0.05;
    assert.equal(combatStats(buffed).min, Math.round(20 * multiplier * 100) / 100);
    for (const crit of [0, 0.99]) {
      const strike = hit(buffed, 0, rolls(0.9, crit, 0.99, 0.99, 0.99));
      assert.equal(strike.damage, Math.round(22 * (crit === 0 ? 1.05 : 1) * multiplier * 100) / 100);
      assert.equal(strike.xpGained, 1);
    }
    assert.equal(equipAxeSkin(buffed, 'default').talents.lumber, rank);
  }
});

test('auto collection is 0, 10 through 20 percent and rolls once per entire bundle', () => {
  for (const rank of [0, 1, 2, 11]) {
    const state = { ...initialProgress('ko'), axeLevel: 2, treeLevel: 30, treeHp: 3200,
      talents: { lumber: 0, learning: 0, autoCollect: rank } };
    const percent = talentValue('autoCollect', rank);
    assert.equal(percent, rank === 0 ? 0 : rank + 9);
    let picked = 0;
    for (let i = 0; i < 1000; i++) {
      const result = hit(state, 0, rolls(0, 0.99, 0, 0.99, i / 1000));
      if (result.autoCollected) {
        picked++;
        assert.equal(result.value, 31);
        assert.equal(result.manualWood, 0);
        assert.equal(result.state.wood, 31);
        assert.equal(result.state.harvested, 31);
        assert.equal(collect(result.state, result.manualWood), result.state);
      } else {
        assert.equal(result.manualWood, 31);
        assert.equal(result.state.wood, 0);
        assert.equal(collect(result.state, result.manualWood).wood, 31);
      }
      assert.equal(result.state.xp, 30);
    }
    assert.equal(picked, percent * 10);
    assert.equal(hit(state, 0, rolls(0, 0.99, 0, 0.99, percent / 100)).autoCollected, false);
  }
});

test('future trusted auto-pickup entitlement overrides odds without duplicate wood', () => {
  for (const autoCollect of [0, 1, 11]) {
    const state = { ...initialProgress('en'), axeLevel: 2, talents: { lumber: 0, learning: 0, autoCollect } };
    const result = hit(state, 0, rolls(0, 0.99, 0.99, 0.99, 0.99), true);
    assert.equal(result.state.wood, 1);
    assert.equal(result.autoCollected, true);
    assert.equal(result.manualWood, 0);
  }
  const zero = hit(initialProgress('en'), 0, rolls(0, 0.99, 0, 0.99, 0), true);
  assert.equal(zero.value, 0);
  assert.equal(zero.autoCollected, false);
  assert.equal(zero.state.wood, 0);
});

function pioneerState() {
  return { ...initialProgress('en'), axeSkin: 'pioneer', treeLevel: 51, treeHp: 5300, xp: xpFloor(10),
    axeLevel: 20, firstRecordClaimed: true, walletCompleted: true,
    receipt: { address: 'test', signature: 'test', status: 'confirmed' },
    skinQuestHarvestStart: 900, harvested: 1000, growthRewardClaimed: true,
    rewardOption: 'low:damage', inventory: ['low:damage'], gemSlotQuestDone: true, adventureClaimed: 4 };
}
test('learning adds to pioneer XP and fractional hundredths persist across reload', () => {
  for (const learning of [1, 10]) {
    let state = { ...pioneerState(), talents: { lumber: 0, autoCollect: 0, learning } };
    const start = state.xp, expected = 51 * (100 + 10 + learning * 2);
    assert.equal(displayedHitXp(state), expected / 100);
    for (let i = 0; i < 100; i++) {
      state = { ...state, fatigue: 0, recoveryAt: null, treeHp: 5300 };
      state = parseProgress(JSON.stringify(hit(state, 0, rolls(0, 0.99, 0.99, 0.99, 0.99)).state));
    }
    assert.equal(state.xp - start, expected);
    assert.equal(state.xpBonusRemainder, 0);
    const entry = upgrade({ ...state, wood: 10000, harvested: 10000, treeHp: 0 }, 'tree');
    assert.equal(entry.xp - state.xp, 520);
  }
});

test('v7 migration preserves progression and converts tenths to hundredths exactly once', () => {
  const old = { ...pioneerState(), version: 7, xpBonusRemainder: 7 };
  delete old.talents;
  const state = parseProgress(JSON.stringify(old));
  assert.equal(state.version, 9);
  assert.deepEqual(state.talents, { lumber: 0, autoCollect: 0, learning: 0 });
  assert.equal(state.xpBonusRemainder, 70);
  for (const key of ['xp', 'wood', 'coins', 'axeLevel', 'treeLevel', 'adventureClaimed']) assert.equal(state[key], old[key]);
  assert.deepEqual(parseProgress(JSON.stringify(state)), state);
});

test('invalid talent ranks and fractional carries are rejected', () => {
  for (const talents of [null, [], {}, { lumber: -1, autoCollect: 0, learning: 0 },
    { lumber: 21, autoCollect: 0, learning: 0 }, { lumber: 0, autoCollect: 12, learning: 0 },
    { lumber: 0, autoCollect: 0, learning: 11 }, { lumber: 0.5, autoCollect: 0, learning: 0 }]) {
    assert.throws(() => parseProgress(JSON.stringify({ ...initialProgress('en'), talents })));
  }
  for (const xpBonusRemainder of [-1, 100, 0.5]) assert.throws(() => parseProgress(JSON.stringify({ ...initialProgress('en'), xpBonusRemainder })));
});
