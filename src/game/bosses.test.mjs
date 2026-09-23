import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, activeBoss, encounterHealth, hit, upgrade, regrow, parseProgress } from './progression.ts';
import { autoPickupUnlocked } from './auto-pickup.ts';
const at = level => ({ ...initialProgress('ko'), treeLevel: level, treeHp: 0, wood: 100000, harvested: 100000, axeLevel: 50, xp: 4000 });

test('first arrivals spawn bosses and damage persists without a deadline', () => {
  for (const [previous, id, hp] of [[49, 'first', 15000], [99, 'gate', 60000]]) {
    const state = upgrade(at(previous), 'tree');
    assert.equal(activeBoss(state), id);
    assert.equal(state.treeHp, hp);
    assert.equal(encounterHealth(state), hp);
    assert.equal(upgrade(state, 'tree'), state);
    const struck = hit(state, 0, () => 0.99).state;
    const restored = parseProgress(JSON.stringify(struck));
    assert.equal(restored.treeHp, struck.treeHp);
    assert.equal(activeBoss(restored), id);
    assert.equal(regrow(restored), restored);
  }
});

test('boss rewards and unlocks happen once atomically, repeat trees are normal', () => {
  for (const level of [50, 100]) {
    const state = { ...at(level), treeHp: 1 };
    if (level === 50) assert.equal(autoPickupUnlocked(state), false);
    const result = hit(state, 0, () => 0.99);
    const next = parseProgress(JSON.stringify(result.state));
    assert.equal(result.bossDefeated, level === 50 ? 'first' : 'gate');
    assert.equal(activeBoss(next), null);
    assert.equal(next.gems.high, level === 100 ? 1 : 0);
    if (level === 50) assert.equal(autoPickupUnlocked(next), true);
    assert.equal(hit(next, 0), null);
    const repeat = regrow(next);
    assert.equal(repeat.treeHp, 200 + level * 100);
    const repeatKill = hit({ ...repeat, treeHp: 1 }, 1, () => 0.99);
    assert.equal(repeatKill.bossDefeated, null);
    assert.equal(repeatKill.state.gems.high, next.gems.high);
    assert.equal(upgrade(next, 'tree').treeLevel, level + 1);
  }
});

test('legacy saves retain reached milestones without retroactive rewards or lost HP', () => {
  for (const level of [49, 50, 75, 100, 120]) {
    const old = { ...at(level), treeHp: 100 };
    delete old.bosses;
    const state = parseProgress(JSON.stringify(old));
    assert.deepEqual(state.bosses, { first: level >= 50, gate: level >= 100 });
    assert.equal(state.treeHp, 100);
    assert.equal(state.gems.high, 0);
    assert.deepEqual(parseProgress(JSON.stringify(state)), state);
  }
  for (const bosses of [null, [], {}, { first: 1, gate: false }]) {
    assert.throws(() => parseProgress(JSON.stringify({ ...at(1), bosses })));
  }
});
