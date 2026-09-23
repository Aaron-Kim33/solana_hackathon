import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, RECOVERY_MS, recover, hit, collect, upgrade, regrow, testRest, characterLevel, walletUnlocked, questSteps, parseProgress,
  AXE_MAX, CHARACTER_MAX, TREE_MAX, combatStats, rollBaseDamage, woodYield, treeHealth, treeAppearance, xpFloor, equip, grantTestOptions } from './progression.ts';
import { ko, en } from '../i18n.ts';
import { claimFirstRecord, equipAxeSkin, skinQuestCollected, firstRecordBonusActive } from './progression.ts';
import { awardXp, xpRequired } from './progression.ts';
const normal = () => 0.5;
const rolls = (...values) => () => values.shift() ?? 0.99;

test('recovery is discrete and preserves elapsed intervals through restart', () => {
  const state = { ...initialProgress('ko'), fatigue: 100, recoveryAt: 1000 };
  assert.equal(recover(state, 1000 + RECOVERY_MS - 1).fatigue, 100);
  const first = recover(state, 1000 + RECOVERY_MS);
  assert.equal(first.fatigue, 80);
  const restored = parseProgress(JSON.stringify(first));
  assert.equal(recover(restored, 1000 + 2 * RECOVERY_MS).fatigue, 60);
  assert.equal(recover(state, 1000 + 5 * RECOVERY_MS).recoveryAt, null);
  assert.equal(recover(state, 500).fatigue, 100);
});
test('rest is immediate but cannot bank recovery while fully rested', () => {
  const state = { ...initialProgress('ko'), fatigue: 100, recoveryAt: 1000 };
  assert.equal(testRest(state, 1000).fatigue, 72);
  let current = state;
  for (let i = 0; i < 4; i++) current = testRest(current, 2000);
  assert.equal(current.recoveryAt, null);
  assert.equal(hit(current, 99999999, normal).state.recoveryAt, 99999999);
});
test('wallet unlock uses harvested total, never current balance', () => {
  const before = collect(initialProgress('en'), 19);
  assert.equal(walletUnlocked(before), false);
  const unlocked = collect(before, 1);
  assert.equal(walletUnlocked(unlocked), true);
  const upgraded = upgrade({ ...unlocked, coins: 20 }, 'axe');
  assert.equal(upgraded.wood, 20);
  assert.equal(upgraded.coins, 0);
  assert.equal(upgraded.axeLevel, 2);
  assert.equal(walletUnlocked(upgraded), true);
  assert.equal(upgrade(upgraded, 'axe'), upgraded);
});
test('three growth tracks alter different gameplay properties', () => {
  const state = { ...collect(initialProgress('ko'), 100), coins: 100 };
  const base = hit(state, 1000, normal);
  assert.ok(hit(upgrade(state, 'axe'), 1000, normal).damage > base.damage);
  const tree = upgrade({ ...state, treeHp: 0 }, 'tree');
  assert.equal(tree.treeHp, 400);
  assert.equal(hit(tree, 1000, normal).value, base.value);
  assert.equal(characterLevel(xpFloor(2) - 1), 1);
  assert.equal(characterLevel(xpFloor(2)), 2);
  assert.equal(characterLevel(xpFloor(3)), 3);
  assert.equal(combatStats(initialProgress('ko')).critChance, 2);
  assert.equal(combatStats(awardXp(initialProgress('ko'), xpFloor(2))).critChance, 2.1);
});
test('fatigue stops chopping but does not prevent collecting or upgrading', () => {
  const full = { ...initialProgress('ko'), fatigue: 100, recoveryAt: 0 };
  assert.equal(hit(full, 1000, normal), null);
  assert.equal(collect(full, 3).wood, 3);
  assert.ok(hit(full, RECOVERY_MS, normal));
});
test('quests advance sequentially and pending signatures never complete final quest', () => {
  let state = { ...collect(initialProgress('ko'), 100), coins: 100, xp: xpFloor(2) };
  state = upgrade({ ...upgrade(state, 'axe'), treeHp: 0 }, 'tree');
  assert.deepEqual(questSteps(state).slice(0, 9), ['complete', 'active', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
  state.walletCompleted = true;
  assert.equal(questSteps(state)[5], 'active');
  state.receipt = { address: 'test', signature: 'test', status: 'pending' };
  assert.equal(questSteps(state)[5], 'active');
  state.receipt.status = 'confirmed';
  assert.ok(questSteps(state).slice(0, 6).every(value => value === 'complete'));
  assert.deepEqual(questSteps(state).slice(6, 9), ['active', 'locked', 'locked']);
  assert.deepEqual(parseProgress(JSON.stringify(state)), state);
  assert.throws(() => parseProgress('{"version":2}'));
});

test('tree depletion persists and gates upgrades; insufficient funds never trap the player', () => {
  const state = { ...initialProgress('ko'), treeHp: 1 };
  const fallen = hit(state, 1000, normal);
  assert.equal(fallen.state.treeHp, 0);
  assert.equal(fallen.felled, true);
  assert.equal(hit(fallen.state, 1500, normal), null);
  assert.equal(parseProgress(JSON.stringify(fallen.state)).treeHp, 0);
  assert.equal(upgrade(fallen.state, 'tree'), fallen.state);
  const regrown = regrow(fallen.state);
  assert.equal(regrown.treeHp, 300);
  assert.equal(regrown.wood, fallen.state.wood);
  const funded = collect(fallen.state, 30);
  const upgraded = upgrade(funded, 'tree');
  assert.equal(upgraded.treeLevel, 2);
  assert.equal(upgraded.treeHp, 400);
  assert.equal(upgraded.wood, 0);
  const living = collect(regrown, 100);
  assert.equal(upgrade(living, 'tree'), living);
  const maxed = { ...funded, treeLevel: TREE_MAX };
  assert.equal(upgrade(maxed, 'tree'), maxed);
  assert.equal(regrow(maxed).treeHp, 100200);
});

test('weighted damage boundaries and exact 50/30/20 distribution', () => {
  for (const level of [1, 2, AXE_MAX]) {
    assert.equal(rollBaseDamage(level, 0), level);
    assert.equal(rollBaseDamage(level, 0.499999), level);
    assert.equal(rollBaseDamage(level, 0.5), level + 1);
    assert.equal(rollBaseDamage(level, 0.799999), level + 1);
    assert.equal(rollBaseDamage(level, 0.8), level + 2);
    assert.equal(rollBaseDamage(level, 0.999999), level + 2);
    const count = [0, 0, 0];
    for (let i = 0; i < 1000; i++) count[rollBaseDamage(level, i / 1000) - level]++;
    assert.deepEqual(count, [500, 300, 200]);
  }
});

test('100 successful taps fill fatigue without level-up; fast taps do not add rhythm damage', () => {
  let state = { ...initialProgress('ko'), xp: xpFloor(200) };
  for (let i = 0; i < 100; i++) {
    const result = hit(state, 1000 + i, rolls(0, 0.99));
    assert.equal(result.damage, 1);
    assert.equal(result.value, 0);
    state = result.state;
    assert.equal(state.fatigue, i + 1);
  }
  assert.equal(state.totalHits, 100);
  assert.equal(state.treeHp, 200);
  assert.equal(hit(state, 1200, normal), null);
});

test('wood is floor of final damage × 0.7, including criticals and overkill', () => {
  assert.deepEqual([1, 2, 3, 200, 201, 202, 610.08].map(woodYield), [0, 1, 2, 140, 140, 141, 427]);
  const first = hit(initialProgress('ko'), 1000, rolls(0, 0));
  assert.equal(first.critical, true);
  assert.equal(first.damage, 1.05);
  assert.equal(first.value, 0);
  assert.equal(first.state.treeHp, 298.95);
  assert.equal(hit(initialProgress('ko'), 1000, rolls(0, 0.02)).critical, false);
  const maxed = { ...initialProgress('ko'), axeLevel: 200, xp: xpFloor(200), treeHp: 1 };
  const critical = hit(maxed, 1000, rolls(0.8, 0));
  assert.equal(critical.damage, 632.5);
  assert.equal(critical.value, 442);
  assert.equal(critical.state.treeHp, 0);
  assert.deepEqual(parseProgress(JSON.stringify(first.state)), first.state);
});

test('character cap, per-level critical growth and level-up fatigue reset', () => {
  const start = initialProgress('en');
  const maxed = { ...start, xp: xpFloor(CHARACTER_MAX) };
  assert.deepEqual(combatStats(maxed), { min: 1, max: 3, critChance: 21.9, critDamage: 304 });
  assert.equal(characterLevel(Number.MAX_SAFE_INTEGER), CHARACTER_MAX);
  const tired = { ...start, xp: xpFloor(2) - 1, fatigue: 100, recoveryAt: 1000 };
  const next = awardXp(tired, 1);
  assert.equal(characterLevel(next.xp), 2);
  assert.equal(next.fatigue, 0);
  assert.equal(next.recoveryAt, null);
  assert.equal(hit(next, 2000, normal).state.recoveryAt, 2000);
  assert.equal(awardXp({ ...tired, xp: 0 }, 1).fatigue, 100);
  assert.equal(awardXp(tired, 10000).fatigue, 0);
  assert.equal(awardXp({ ...maxed, fatigue: 100, recoveryAt: 1000 }, 10000).fatigue, 100);
  for (const invalid of [0, -1, 1.2, NaN]) assert.equal(awardXp(tired, invalid), tired);
  assert.equal(collect(tired, 10000).fatigue, 100);
  assert.equal(collect(tired, 10000).xp, tired.xp);
});

test('two owned options persist through upgrades, saves and unequips', () => {
  const empty = initialProgress('ko');
  assert.equal(equip(empty, 0, 'damage'), empty);
  const owned = grantTestOptions({ ...collect(empty, 100), coins: 100, xp: xpFloor(3) });
  const first = equip(owned, 0, 'damage');
  assert.deepEqual(equip(first, 1, 'damage').slots, ['damage', 'damage']);
  const both = equip(first, 1, 'critDamage');
  assert.deepEqual(combatStats(both), { min: 3, max: 5, critChance: 2.2, critDamage: 117 });
  const upgraded = upgrade(both, 'axe');
  assert.deepEqual(upgraded.slots, both.slots);
  assert.equal(combatStats(upgraded).min, 4);
  assert.deepEqual(parseProgress(JSON.stringify(upgraded)), upgraded);
  assert.equal(equip(upgraded, 0, null), upgraded);
  assert.equal(combatStats(equip(owned, 0, 'critChance')).critChance, 4.2);
  const capped = { ...upgraded, axeLevel: AXE_MAX, wood: 100000, harvested: 100000 };
  assert.equal(upgrade(capped, 'axe'), capped);
});

test('v1 migration preserves resources, quest receipts, fatigue and relative tree HP', () => {
  const { slots, inventory, totalHits, ...old } = initialProgress('ko');
  const legacy = { ...old, version: 1, axeLevel: 2, treeLevel: 2, treeHp: 85,
    wood: 72, harvested: 92, xp: 92, fatigue: 91, recoveryAt: 1000,
    walletCompleted: true, receipt: { address: 'test', signature: 'test', status: 'confirmed' } };
  const next = parseProgress(JSON.stringify(legacy));
  assert.equal(next.version, 9);
  assert.equal(next.treeHp, 200);
  for (const key of ['wood', 'harvested', 'fatigue', 'recoveryAt', 'walletCompleted', 'receipt']) assert.deepEqual(next[key], legacy[key]);
  assert.equal(characterLevel(next.xp), 3);
  assert.equal(next.xp, xpFloor(3) + Math.floor(2 / 90 * xpRequired(3)));
  assert.deepEqual(next.slots, [null, null]);
  assert.equal(parseProgress(JSON.stringify({ ...legacy, treeHp: 0 })).treeHp, 0);
  assert.deepEqual(parseProgress(JSON.stringify(next)), next);
});

test('invalid saves reject malformed gear, levels and HP', () => {
  const state = grantTestOptions(initialProgress('en'));
  for (const patch of [ { treeLevel: 1001 }, { axeLevel: 201 }, { treeHp: -1 },
    { treeHp: 301 }, { version: 8, slots: ['damage', 'damage'], inventory: ['damage'] }, { slots: ['fake', null] },
    { version: 8, slots: ['damage', null], inventory: [] }, { inventory: ['fake'] },
    { totalHits: -1 }, { fatigue: 1, recoveryAt: null }, { version: 99 } ]) {
    assert.throws(() => parseProgress(JSON.stringify({ ...state, ...patch })));
  }
});

test('matching options require two copies and stack through saves and upgrades', () => {
  for (const id of ['damage', 'critChance', 'critDamage']) {
    const single = { ...collect(initialProgress('ko'), 100), coins: 100, inventory: [id] };
    const first = equip(single, 0, id);
    assert.equal(equip(first, 1, id), first);
    assert.deepEqual(parseProgress(JSON.stringify(first)), first);
    const owned = { ...first, inventory: [id, id] };
    const both = equip(owned, 1, id);
    assert.deepEqual(both.slots, [id, id]);
    const base = combatStats(single), stats = combatStats(both);
    assert.equal(stats.min - base.min, id === 'damage' ? 4 : 0);
    assert.equal(Math.round((stats.critChance - base.critChance) * 10), id === 'critChance' ? 40 : 0);
    assert.equal(stats.critDamage - base.critDamage, id === 'critDamage' ? 20 : 0);
    assert.deepEqual(parseProgress(JSON.stringify(both)), both);
    assert.deepEqual(upgrade(both, 'axe').slots, [id, id]);
    const freed = equip(both, 0, null);
    assert.deepEqual(equip(freed, 0, id).slots, [id, id]);
    assert.equal(freed, both);
    assert.deepEqual(freed.inventory, [id]);
  }
  const extra = { ...initialProgress('en'), inventory: ['damage', 'damage', 'damage'] };
  const granted = grantTestOptions(extra);
  assert.equal(granted.inventory.filter(id => id === 'damage').length, 3);
  assert.deepEqual(grantTestOptions(granted), granted);
});

test('1000 tree levels are grouped into twenty 50-level appearances', () => {
  assert.deepEqual([1, 2, 3, 1000].map(treeHealth), [300, 400, 500, 100200]);
  assert.deepEqual([1, 50, 51, 100, 101, 950, 951, 1000].map(treeAppearance), [0, 0, 1, 1, 2, 18, 19, 19]);
});

test('Korean and English keys and interpolation placeholders match', () => {
  assert.deepEqual(Object.keys(ko).sort(), Object.keys(en).sort());
  for (const key of Object.keys(ko)) assert.deepEqual(ko[key].match(/\{\w+\}/g), en[key].match(/\{\w+\}/g), key);
});

test('bountiful harvest has an exact 10% boundary and requires base wood', () => {
  const state = { ...initialProgress('ko'), treeLevel: 100, treeHp: treeHealth(100) };
  for (const roll of [0, 0.099999]) {
    const result = hit(state, 1000, rolls(0.5, 0.99, roll));
    assert.equal(result.baseWood, 1);
    assert.equal(result.bonusWood, 100);
    assert.equal(result.value, 101);
  }
  for (const roll of [0.1, 0.999999]) assert.equal(hit(state, 1000, rolls(0.5, 0.99, roll)).bonusWood, 0);
  for (const critRoll of [0, 0.99]) {
    const result = hit(state, 1000, rolls(0, critRoll, 0));
    assert.equal(result.baseWood, 0);
    assert.equal(result.bonusWood, 0);
    assert.equal(result.value, 0);
  }
  let procs = 0;
  for (let i = 0; i < 1000; i++) if (hit(state, 1000, rolls(0.5, 0.99, i / 1000)).bonusWood) procs++;
  assert.equal(procs, 100);
});

test('tree bonus is independent of crit, scales by tree level and includes the final hit', () => {
  for (const level of [1, 50, 100, 1000]) {
    const state = { ...initialProgress('en'), axeLevel: 200, xp: xpFloor(200), treeLevel: level, treeHp: 1 };
    const result = hit(state, 1000, rolls(0.8, 0, 0));
    assert.equal(result.critical, true);
    assert.equal(result.felled, true);
    assert.equal(result.baseWood, 442);
    assert.equal(result.bonusWood, level);
    assert.equal(result.value, 442 + level);
    assert.equal(result.state.fatigue, 1);
    assert.equal(result.state.wood, 0);
    assert.equal(result.state.xp, state.xp);
    assert.equal(hit(result.state, 1001, rolls(0, 0, 0)), null);
  }
});

test('bonus wood is awarded only on collection, while hit XP is independent', () => {
  const state = { ...initialProgress('ko'), treeLevel: 30, treeHp: treeHealth(30), fatigue: 99, recoveryAt: 1000 };
  const strike = hit(state, 1000, rolls(0.5, 0.99, 0));
  assert.equal(strike.state.fatigue, 100);
  assert.equal(strike.state.wood, 0);
  assert.equal(strike.state.xp, 30);
  // A missed bundle keeps the earned hit XP but grants no wood.
  const collected = collect(strike.state, strike.value);
  assert.equal(collected.wood, 31);
  assert.equal(collected.harvested, 31);
  assert.equal(collected.xp, 30);
  assert.equal(collected.fatigue, 100);
  assert.deepEqual(parseProgress(JSON.stringify(collected)), collected);
});

function recordedState(status = 'confirmed') {
  return { ...collect(initialProgress('ko'), 1000), coins: 1000, xp: xpFloor(2), axeLevel: 2, treeLevel: 2, treeHp: 400,
    walletCompleted: true, receipt: { address: 'test', signature: 'test', status } };
}

test('record reward requires confirmation and completed prerequisites; claim does not grant damage', () => {
  for (const state of [initialProgress('ko'), recordedState('pending'), recordedState('failed'),
    { ...recordedState(), walletCompleted: false }]) assert.equal(claimFirstRecord(state), state);
  const before = recordedState();
  const claimed = claimFirstRecord(before);
  assert.equal(claimed.firstRecordClaimed, true);
  assert.equal(claimed.axeSkin, 'default');
  assert.equal(firstRecordBonusActive(claimed), false);
  assert.deepEqual(combatStats(claimed), combatStats(before));
  assert.equal(claimFirstRecord(claimed), claimed);
  assert.equal(claimFirstRecord(parseProgress(JSON.stringify(claimed))).firstRecordClaimed, true);
  assert.deepEqual(questSteps(claimed).slice(6, 9), ['complete', 'active', 'locked']);
});

test('first equip unlocks +1 once without consuming gear and retains it on skin changes and upgrades', () => {
  const locked = recordedState();
  assert.equal(equipAxeSkin(locked, 'firstRecord'), locked);
  const claimed = claimFirstRecord(equip(grantTestOptions(locked), 0, 'damage'));
  const equipped = equipAxeSkin(claimed, 'firstRecord');
  assert.equal(firstRecordBonusActive(equipped), true);
  assert.equal(equipped.axeLevel, 1);
  assert.equal(combatStats(equipped).min, combatStats(claimed).min + 2);
  assert.deepEqual(equipped.slots, claimed.slots);
  assert.deepEqual(equipped.inventory, claimed.inventory);
  assert.equal(equipAxeSkin(equipped, 'firstRecord'), equipped);
  const unequipped = equipAxeSkin(equipped, 'default');
  assert.equal(unequipped.axeLevel, 2);
  assert.equal(combatStats(unequipped).min, combatStats(equipped).min - 1);
  assert.equal(combatStats(unequipped).min, combatStats(claimed).min + 1);
  const reequipped = equipAxeSkin(unequipped, 'firstRecord');
  assert.deepEqual(combatStats(reequipped), combatStats(equipped));
  const upgraded = upgrade(unequipped, 'axe');
  assert.equal(combatStats(upgraded).min, combatStats(unequipped).min + 1);
  assert.equal(firstRecordBonusActive(parseProgress(JSON.stringify(upgraded))), true);
});

test('new 100-wood quest starts at first equip, survives unequip/restart/spending, and caps at 100', () => {
  const claimed = collect(claimFirstRecord(recordedState()), 500);
  assert.equal(skinQuestCollected(claimed), 0);
  const equipped = equipAxeSkin(claimed, 'firstRecord');
  assert.equal(equipped.skinQuestHarvestStart, 1500);
  assert.deepEqual(questSteps(equipped).slice(6, 9), ['complete', 'complete', 'active']);
  let state = collect(equipped, 99);
  assert.equal(skinQuestCollected(state), 99);
  state = equipAxeSkin(upgrade(state, 'axe'), 'default');
  state = parseProgress(JSON.stringify(state));
  assert.equal(skinQuestCollected(state), 99);
  assert.equal(equipAxeSkin(state, 'firstRecord').skinQuestHarvestStart, 1500);
  state = collect(state, 1);
  assert.ok(questSteps(state).slice(0, 9).every(value => value === 'complete'));
  assert.equal(skinQuestCollected(collect(state, 500)), 100);
});

test('first record damage bonus is included before crit and wood yield', () => {
  const state = { ...equipAxeSkin(claimFirstRecord(recordedState()), 'firstRecord'), axeLevel: 1, xp: 0 };
  const normalHit = hit(state, 1000, rolls(0, 0.99, 0.99));
  assert.equal(normalHit.damage, 4);
  assert.equal(normalHit.baseWood, 2);
  assert.equal(hit(state, 1000, rolls(0, 0, 0.99)).damage, 4.2);
});

test('v2 saves migrate without losing progress and confirmed old records can claim rewards', () => {
  const { firstRecordClaimed, axeSkin, skinQuestHarvestStart, ...old } = recordedState();
  const upgraded = parseProgress(JSON.stringify({ ...old, version: 2 }));
  assert.equal(upgraded.version, 9);
  assert.equal(upgraded.harvested, old.harvested);
  assert.deepEqual(upgraded.receipt, old.receipt);
  assert.equal(upgraded.firstRecordClaimed, false);
  assert.equal(claimFirstRecord(upgraded).firstRecordClaimed, true);
});

test('v3 rejects inconsistent unlocks and quest counters', () => {
  const state = recordedState();
  for (const patch of [{ firstRecordClaimed: 'yes' }, { axeSkin: 'fake' },
    { axeSkin: 'firstRecord' }, { skinQuestHarvestStart: 0 },
    { firstRecordClaimed: true, receipt: null },
    { firstRecordClaimed: true, skinQuestHarvestStart: 1001 },
    { firstRecordClaimed: true, skinQuestHarvestStart: -1 },
    { firstRecordClaimed: true, axeSkin: 'firstRecord', skinQuestHarvestStart: null }]) {
    assert.throws(() => parseProgress(JSON.stringify({ ...state, ...patch })));
  }
});
