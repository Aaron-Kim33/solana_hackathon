import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, parseProgress, hit, collect, upgrade, claimAdventure } from './progression.ts';
import { BLESSING_MS, FARM_FIRST_GROW_MS, FARM_GROW_MS, FARM_PATHS, farmBoard, farmSolved,
  farmOf, plantFarmSeed, activateBlessing, blessingMultiplier, startFarmPuzzle, finishFarmPuzzle, claimFarmTree } from './farm.ts';

const ready = () => ({ ...initialProgress('ko'), treeLevel: 15, treeHp: 175, wood: 1000, harvested: 1000 });
const solvedBoard = seed => Array(9).fill(0);

test('every random board is solvable and starts with at least one rotated root', () => {
  const seen = new Set();
  for (let seed = 0; seed < 120; seed++) {
    const board = farmBoard(seed);
    seen.add(board.path.join(','));
    assert.equal(board.path[0], 0);
    assert.equal(board.path.at(-1), 8);
    assert.equal(farmSolved(seed, solvedBoard(seed)), true);
    assert.equal(farmSolved(seed, board.rotations), false);
  }
  assert.equal(seen.size, FARM_PATHS.length);
});

test('first planting is quick, spends wood once, persists, and awards karma only after growth', () => {
  let state = plantFarmSeed(ready(), 100_000, 0);
  assert.equal(state.wood, 900);
  assert.equal(state.farm.plots[0].readyAt, 0);
  assert.equal(claimFarmTree(state, 1_000_000, 0), state);
  assert.equal(plantFarmSeed(state, 100_001, 0), state);
  state = startFarmPuzzle(state, 100_000, 7, 0);
  assert.equal(state.farm.puzzle.seed, 7);
  assert.equal(startFarmPuzzle(state, 100_001, 8, 1), state);
  state = finishFarmPuzzle(state, 110_000, solvedBoard(7));
  assert.equal(state.wood, 900);
  assert.equal(state.farm.plots[0].readyAt, 110_000 + FARM_FIRST_GROW_MS * 0.9);
  assert.equal(farmOf(state).karma, 0);
  assert.equal(claimFarmTree(state, state.farm.plots[0].readyAt - 1, 0), state);
  state = claimFarmTree(state, state.farm.plots[0].readyAt, 0);
  assert.equal(state.farm.karma, 1);
  assert.equal(state.farm.grown, 1);
  assert.equal(claimFarmTree(state, 200_000, 0), state);
  assert.deepEqual(parseProgress(JSON.stringify(state)), state);
  state = startFarmPuzzle(plantFarmSeed(state, 200_000, 1), 200_000, 9, 1);
  assert.equal(finishFarmPuzzle(state, 220_000, farmBoard(9).rotations), state);
  state = finishFarmPuzzle(state, 220_000, solvedBoard(9));
  assert.equal(state.farm.plots[1].readyAt, 220_000 + FARM_GROW_MS);
});

test('unlimited repeats still enforce seed cost, unlock and solved watering', () => {
  assert.equal(plantFarmSeed({ ...ready(), treeLevel: 14 }, 100_000, 0).farm, undefined);
  assert.equal(plantFarmSeed({ ...ready(), wood: 99 }, 100_000, 0).farm, undefined);
  assert.equal(startFarmPuzzle(ready(), 100_000, 1, 0).farm, undefined);
  let state = ready(), time = 100_000;
  for (let i = 0; i < 5; i++) {
    state = startFarmPuzzle(plantFarmSeed(state, time, 0), time, i + 1, 0);
    assert.equal(finishFarmPuzzle(state, time + 1, [0]), state);
    assert.equal(finishFarmPuzzle(state, time + 1, farmBoard(i + 1).rotations), state);
    state = finishFarmPuzzle(state, time + 1, solvedBoard(i + 1));
    time = state.farm.plots[0].readyAt;
    state = claimFarmTree(state, state.farm.plots[0].readyAt, 0);
  }
  assert.equal(state.farm.plantedToday, 5);
  assert.notEqual(plantFarmSeed(state, time + 1, 0), state);
  assert.deepEqual(parseProgress(JSON.stringify(state)), state);
  assert.throws(() => parseProgress(JSON.stringify({ ...state, farm: { ...state.farm, karma: 999 } })), /INVALID_SAVE/);
});

test('two plots can grow at once without granting early karma', () => {
  let state = startFarmPuzzle(plantFarmSeed(ready(), 100_000, 0), 100_000, 12, 0);
  state = finishFarmPuzzle(state, 101_000, solvedBoard(12));
  state = startFarmPuzzle(plantFarmSeed(state, 102_000, 1), 102_000, 13, 1);
  state = finishFarmPuzzle(state, 103_000, solvedBoard(13));
  assert.ok(state.farm.plots[0]);
  assert.ok(state.farm.plots[1]);
  assert.equal(state.farm.karma, 0);
  state = claimFarmTree(state, 130_000, 0);
  assert.equal(state.farm.karma, 1);
  assert.ok(state.farm.plots[1]);
});

test('legacy growing plots and unfinished puzzles are preserved without duplicate costs', () => {
  const legacy = { ...ready(), farm: { karma: 2, grown: 2, dayStart: 0, plantedToday: 3,
    plots: [{ plantedAt: 1, readyAt: 2, quick: false }, null], puzzle: { seed: 5, startedAt: 3, plot: 1 } } };
  assert.deepEqual(parseProgress(JSON.stringify(legacy)), legacy);
  const next = finishFarmPuzzle(legacy, 20_000, solvedBoard(5));
  assert.equal(next.wood, legacy.wood - 100);
  assert.deepEqual(next.farm.plots[0], legacy.farm.plots[0]);
  assert.equal(next.farm.karma, 2);
  assert.equal(finishFarmPuzzle(next, 20_001, solvedBoard(5)), next);
});

test('four karma buys a real-time 20-minute blessing; no stacking, no save reset', () => {
  const state = { ...ready(), farm: { karma: 8, grown: 8, dayStart: 0, plantedToday: 0, plots: [null, null], puzzle: null } };
  const next = activateBlessing(state, 1000);
  assert.equal(next.farm.karma, 4);
  assert.equal(next.farm.grown, 8);
  assert.equal(next.farm.blessingUntil, 1000 + BLESSING_MS);
  assert.equal(activateBlessing(next, 2000), next);
  assert.equal(blessingMultiplier(next, next.farm.blessingUntil - 1), 2);
  assert.equal(blessingMultiplier(next, next.farm.blessingUntil), 1);
  assert.equal(activateBlessing(next, next.farm.blessingUntil).farm.karma, 0);
  assert.deepEqual(parseProgress(JSON.stringify(next)), next);
  assert.equal(activateBlessing({ ...state, farm: { ...state.farm, karma: 3 } }, 1000).farm.karma, 3);
  assert.equal(activateBlessing(state, Number.MAX_SAFE_INTEGER), state);
});

test('blessing doubles hit wood and coins only once, not damage, XP or unrelated rewards', () => {
  const plain = { ...ready(), treeHp: 1, axeLevel: 10 };
  const boosted = { ...plain, farm: { karma: 0, grown: 4, dayStart: 0, plantedToday: 0, plots: [null, null], puzzle: null, blessingUntil: 5000 } };
  const a = hit(plain, 1000, () => 0), b = hit(boosted, 1000, () => 0);
  assert.equal(b.value, a.value * 2);
  assert.equal(b.coins, a.coins * 2);
  assert.equal(b.damage, a.damage);
  assert.equal(b.xpGained, a.xpGained);
  assert.equal(b.state.fatigue, a.state.fatigue);
  assert.equal(collect(b.state, b.manualWood).wood - b.state.wood, b.manualWood);
  assert.equal(hit(boosted, 5000, () => 0).value, a.value);
  const end = { ...plain, treeHp: 0 }, endBoost = { ...boosted, treeHp: 0 };
  assert.equal(upgrade(endBoost, 'tree').coins - endBoost.coins, upgrade(end, 'tree').coins - end.coins);
  assert.equal(claimAdventure(boosted).coins - boosted.coins, claimAdventure(plain).coins - plain.coins);
});
