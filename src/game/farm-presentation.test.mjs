import { test } from 'node:test';
import assert from 'node:assert/strict';
import { farmBoard, farmConnections } from './farm.ts';
import { farmWaterRoute, nextFarmAngle, farmPlotStatus, farmWateringConfirmed } from './farm-presentation.ts';

test('water follows only the solved route from water to seed across random layouts', () => {
  for (let seed = 0; seed < 120; seed++) {
    const board = farmBoard(seed);
    assert.deepEqual(farmWaterRoute(seed, board.rotations), []);
    const route = farmWaterRoute(seed, Array(9).fill(0));
    assert.deepEqual(route, [...board.path].reverse());
    assert.equal(route[0], 8);
    assert.equal(route.at(-1), 0);
    for (let i = 0; i < route.length - 1; i++) {
      const delta = route[i + 1] - route[i];
      const direction = delta === -3 ? 0 : delta === 1 ? 1 : delta === 3 ? 2 : 3;
      assert.ok(farmConnections(seed, route[i], 0).includes(direction));
    }
  }
});

test('rotation crosses the fourth turn clockwise without reversing or losing orientation', () => {
  let angle = 0;
  for (let turn = 1; turn <= 24; turn++) {
    angle = nextFarmAngle(angle, turn % 4);
    assert.equal(angle, turn * 90);
  }
  assert.equal(nextFarmAngle(270, 0), 360);
  assert.equal(nextFarmAngle(360, 2), 540);
  assert.equal(nextFarmAngle(-90, 0), 0);
  assert.equal(nextFarmAngle(540, 2), 540);
});

test('plot labels distinguish waiting for water from growth and the exact harvest boundary', () => {
  assert.equal(farmPlotStatus(null, 100), 'empty');
  assert.equal(farmPlotStatus({ plantedAt: 1, readyAt: 0, quick: false }, 100), 'water');
  const plot = { plantedAt: 1, readyAt: 200, quick: false };
  assert.equal(farmPlotStatus(plot, 199), 'growing');
  assert.equal(farmPlotStatus(plot, 200), 'ready');
  assert.equal(farmPlotStatus(plot, 201), 'ready');
});

test('watering celebration requires the same seed to change from waiting to server-confirmed growth', () => {
  const waiting = { plantedAt: 100, readyAt: 0, quick: false };
  const growing = { ...waiting, readyAt: 300, quick: true };
  assert.equal(farmWateringConfirmed(waiting, growing), true);
  assert.equal(farmWateringConfirmed(waiting, waiting), false);
  assert.equal(farmWateringConfirmed(growing, growing), false);
  assert.equal(farmWateringConfirmed(null, growing), false);
  assert.equal(farmWateringConfirmed(waiting, null), false);
  assert.equal(farmWateringConfirmed(waiting, { ...growing, plantedAt: 101 }), false);
});
