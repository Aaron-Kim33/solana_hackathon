import type { Progress } from './progression';

export const FARM_UNLOCK_LEVEL = 15;
export const FARM_PLANT_COST = 100;
export const FARM_DAILY_LIMIT = 3;
export const FARM_GROW_MS = 30 * 60_000;
export const FARM_FIRST_GROW_MS = 30_000;
export const FARM_QUICK_MS = 15_000;

export type FarmPlot = { plantedAt: number; readyAt: number; quick: boolean };
export type FarmState = { karma: number; grown: number; dayStart: number; plantedToday: number;
  plots: [FarmPlot | null, FarmPlot | null]; puzzle: { seed: number; startedAt: number; plot: 0 | 1 } | null };
export const emptyFarm = (): FarmState => ({ karma: 0, grown: 0, dayStart: 0, plantedToday: 0, plots: [null, null], puzzle: null });
export const farmDayStart = (now: number) => Math.floor(now / 86_400_000) * 86_400_000;
export const farmToday = (farm: FarmState, now: number) => farm.dayStart === farmDayStart(now) ? farm.plantedToday : 0;
export const farmOf = (state: Progress): FarmState => state.farm ?? emptyFarm();

// Every layout is a simple, solvable trail from the seed (0) to water (8).
export const FARM_PATHS = [
  [0, 1, 2, 5, 8], [0, 3, 6, 7, 8], [0, 1, 4, 5, 8],
  [0, 3, 4, 7, 8], [0, 1, 4, 7, 8], [0, 3, 4, 5, 8],
] as const;
export type FarmDirection = 0 | 1 | 2 | 3; // up, right, down, left
const direction = (from: number, to: number): FarmDirection => to === from - 3 ? 0 : to === from + 1 ? 1 : to === from + 3 ? 2 : 3;
export function farmBoard(seed: number) {
  const path = FARM_PATHS[seed % FARM_PATHS.length];
  let bits = seed >>> 0;
  const rotations = Array(9).fill(0) as number[];
  for (const cell of path.slice(1, -1)) {
    bits = (Math.imul(bits, 1664525) + 1013904223) >>> 0;
    rotations[cell] = 1 + bits % 3;
  }
  return { path, rotations };
}
export function farmSolved(seed: number, rotations: readonly number[]) {
  if (rotations.length !== 9 || rotations.some(value => !Number.isInteger(value) || value < 0 || value > 3)) return false;
  const path: readonly number[] = farmBoard(seed).path;
  return path.slice(1, -1).every((cell, index) => {
    const prior = direction(cell, path[index]);
    const next = direction(cell, path[index + 2]);
    const rotated = [(prior + rotations[cell]) % 4, (next + rotations[cell]) % 4];
    return rotated.includes(prior) && rotated.includes(next);
  });
}
export function farmConnections(seed: number, cell: number, rotation: number): number[] {
  const path: readonly number[] = farmBoard(seed).path;
  const index = path.indexOf(cell);
  if (index < 0) return [];
  const dirs = [index > 0 ? direction(cell, path[index - 1]) : direction(cell, path[1]),
    index < path.length - 1 ? direction(cell, path[index + 1]) : direction(cell, path[index - 1])];
  return [...new Set(dirs.map(dir => (dir + rotation) % 4))];
}
export function startFarmPuzzle(state: Progress, now: number, seed: number, plot: 0 | 1): Progress {
  const farm = farmOf(state);
  if (state.treeLevel < FARM_UNLOCK_LEVEL || state.wood < FARM_PLANT_COST || farmToday(farm, now) >= FARM_DAILY_LIMIT ||
    farm.puzzle || farm.plots[plot] || (plot !== 0 && plot !== 1) || !Number.isSafeInteger(seed) || seed < 0 || seed > 2_147_483_647) return state;
  return { ...state, farm: { ...farm, puzzle: { seed, startedAt: now, plot } } };
}
export function finishFarmPuzzle(state: Progress, now: number, rotations: readonly number[]): Progress {
  const farm = farmOf(state), puzzle = farm.puzzle;
  if (!puzzle || now < puzzle.startedAt || state.wood < FARM_PLANT_COST || farm.plots[puzzle.plot] ||
    farmToday(farm, now) >= FARM_DAILY_LIMIT || rotations.length !== 9 || rotations.some(value => !Number.isInteger(value) || value < 0 || value > 3)) return state;
  const quick = farmSolved(puzzle.seed, rotations) && now - puzzle.startedAt <= FARM_QUICK_MS;
  const growMs = farm.grown === 0 ? FARM_FIRST_GROW_MS : FARM_GROW_MS;
  const plots: FarmState['plots'] = [...farm.plots];
  plots[puzzle.plot] = { plantedAt: now, readyAt: now + Math.floor(growMs * (quick ? 0.9 : 1)), quick };
  return { ...state, wood: state.wood - FARM_PLANT_COST, farm: { ...farm, dayStart: farmDayStart(now),
    plantedToday: farmToday(farm, now) + 1, plots, puzzle: null } };
}
export function claimFarmTree(state: Progress, now: number, plot: 0 | 1): Progress {
  const farm = farmOf(state), planted = farm.plots[plot];
  if (!planted || now < planted.readyAt || !Number.isSafeInteger(farm.karma + 1) || !Number.isSafeInteger(farm.grown + 1)) return state;
  const plots: FarmState['plots'] = [...farm.plots]; plots[plot] = null;
  return { ...state, farm: { ...farm, karma: farm.karma + 1, grown: farm.grown + 1, plots } };
}
