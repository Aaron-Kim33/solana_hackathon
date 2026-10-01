import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress, parseProgress } from './progression.ts';
import { FARM_DAILY_LIMIT, FARM_FIRST_GROW_MS, FARM_GROW_MS, FARM_PATHS, farmBoard, farmSolved,
  farmOf, startFarmPuzzle, finishFarmPuzzle, claimFarmTree } from './farm.ts';

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
  let state = startFarmPuzzle(ready(), 100_000, 7, 0);
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
  state = startFarmPuzzle(state, 200_000, 9, 1);
  state = finishFarmPuzzle(state, 220_000, farmBoard(9).rotations);
  assert.equal(state.farm.plots[1].readyAt, 220_000 + FARM_GROW_MS);
});

test('daily limit, cost and unlock cannot be bypassed by cancelling or forged puzzle input', () => {
  assert.equal(startFarmPuzzle({ ...ready(), treeLevel: 14 }, 100_000, 1, 0).farm, undefined);
  assert.equal(startFarmPuzzle({ ...ready(), wood: 99 }, 100_000, 1, 0).farm, undefined);
  let state = ready(), time = 100_000;
  for (let i = 0; i < FARM_DAILY_LIMIT; i++) {
    state = startFarmPuzzle(state, time, i + 1, 0);
    assert.equal(finishFarmPuzzle(state, time + 1, [0]), state);
    state = finishFarmPuzzle(state, time + 1, farmBoard(i + 1).rotations);
    state = claimFarmTree(state, state.farm.plots[0].readyAt, 0);
    time = state.farm.plots[0]?.readyAt ?? time + FARM_GROW_MS + 1;
  }
  assert.equal(startFarmPuzzle(state, time + 1, 99, 0), state);
  assert.notEqual(startFarmPuzzle(state, 86_400_000, 99, 0), state);
  assert.throws(() => parseProgress(JSON.stringify({ ...state, farm: { ...state.farm, karma: 999 } })), /INVALID_SAVE/);
});

test('two plots can grow at once without granting early karma', () => {
  let state = startFarmPuzzle(ready(), 100_000, 12, 0);
  state = finishFarmPuzzle(state, 101_000, solvedBoard(12));
  state = startFarmPuzzle(state, 102_000, 13, 1);
  state = finishFarmPuzzle(state, 103_000, solvedBoard(13));
  assert.ok(state.farm.plots[0]);
  assert.ok(state.farm.plots[1]);
  assert.equal(state.farm.karma, 0);
  state = claimFarmTree(state, 130_000, 0);
  assert.equal(state.farm.karma, 1);
  assert.ok(state.farm.plots[1]);
});
