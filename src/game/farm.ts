import type { Progress } from './progression';

export const FARM_UNLOCK_LEVEL = 15;
export const FARM_PLANT_COST = 100;
export const BLESSING_COST = 4;
export const BLESSING_MS = 20 * 60_000;
export const FARM_GROW_MS = 30 * 60_000;
export const FARM_FIRST_GROW_MS = 30_000;
export const FARM_QUICK_MS = 15_000;

export type FarmPlot = { plantedAt: number; readyAt: number; quick: boolean };
export type FarmState = { karma: number; grown: number; dayStart: number; plantedToday: number; blessingUntil?: number;
  plots: [FarmPlot | null, FarmPlot | null]; puzzle: { seed: number; startedAt: number; plot: 0 | 1 } | null };
export const emptyFarm = (): FarmState => ({ karma: 0, grown: 0, dayStart: 0, plantedToday: 0, plots: [null, null], puzzle: null });
export const farmDayStart = (now: number) => Math.floor(now / 86_400_000) * 86_400_000;
export const farmToday = (farm: FarmState, now: number) => farm.dayStart === farmDayStart(now) ? farm.plantedToday : 0;
export const farmOf = (state: Progress): FarmState => state.farm ?? emptyFarm();
export const blessingMultiplier = (state: Progress, now: number): 1 | 2 => now < (state.farm?.blessingUntil ?? 0) ? 2 : 1;
export function activateBlessing(state: Progress, now: number): Progress {
  const farm = farmOf(state);
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(now + BLESSING_MS) ||
    farm.karma < BLESSING_COST || blessingMultiplier(state, now) === 2) return state;
  return { ...state, farm: { ...farm, karma: farm.karma - BLESSING_COST, blessingUntil: now + BLESSING_MS } };
}
// readyAt=0 is a planted seed waiting for water, never a claimable tree.
export function plantFarmSeed(state: Progress, now: number, plot: 0 | 1): Progress {
  const farm = farmOf(state);
  if ((plot !== 0 && plot !== 1) || !Number.isSafeInteger(now) || now < 0 ||
    state.treeLevel < FARM_UNLOCK_LEVEL || state.wood < FARM_PLANT_COST || farm.plots[plot] || farm.puzzle ||
    !Number.isSafeInteger(farmToday(farm, now) + 1)) return state;
  const plots: FarmState['plots'] = [...farm.plots];
  plots[plot] = { plantedAt: now, readyAt: 0, quick: false };
  return { ...state, wood: state.wood - FARM_PLANT_COST, farm: { ...farm, plots,
    dayStart: farmDayStart(now), plantedToday: farmToday(farm, now) + 1 } };
}

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
  if ((plot !== 0 && plot !== 1) || state.treeLevel < FARM_UNLOCK_LEVEL ||
    farm.puzzle || !farm.plots[plot] || farm.plots[plot]!.readyAt !== 0 ||
    !Number.isSafeInteger(now) || now < farm.plots[plot]!.plantedAt || !Number.isSafeInteger(seed) || seed < 0 || seed > 2_147_483_647) return state;
  return { ...state, farm: { ...farm, puzzle: { seed, startedAt: now, plot } } };
}
export function finishFarmPuzzle(state: Progress, now: number, rotations: readonly number[]): Progress {
  const farm = farmOf(state), puzzle = farm.puzzle;
  if (!puzzle || !Number.isSafeInteger(now) || now < puzzle.startedAt ||
    (farm.plots[puzzle.plot] && farm.plots[puzzle.plot]!.readyAt !== 0) || !farmSolved(puzzle.seed, rotations)) return state;
  // Pre-update in-flight puzzles are preserved and charged once at completion.
  const legacy = farm.plots[puzzle.plot] === null;
  if (legacy && (state.wood < FARM_PLANT_COST || !Number.isSafeInteger(farmToday(farm, now) + 1))) return state;
  const quick = farmSolved(puzzle.seed, rotations) && now - puzzle.startedAt <= FARM_QUICK_MS;
  const growMs = farm.grown === 0 ? FARM_FIRST_GROW_MS : FARM_GROW_MS;
  if (!Number.isSafeInteger(now + growMs)) return state;
  const plots: FarmState['plots'] = [...farm.plots];
  plots[puzzle.plot] = { plantedAt: farm.plots[puzzle.plot]?.plantedAt ?? now, readyAt: now + Math.floor(growMs * (quick ? 0.9 : 1)), quick };
  return { ...state, wood: state.wood - (legacy ? FARM_PLANT_COST : 0), farm: { ...farm,
    ...(legacy ? { dayStart: farmDayStart(now), plantedToday: farmToday(farm, now) + 1 } : {}), plots, puzzle: null } };
}
export function claimFarmTree(state: Progress, now: number, plot: 0 | 1): Progress {
  const farm = farmOf(state), planted = farm.plots[plot];
  if ((plot !== 0 && plot !== 1) || !planted || planted.readyAt === 0 || !Number.isSafeInteger(now) || now < planted.readyAt || !Number.isSafeInteger(farm.karma + 1) || !Number.isSafeInteger(farm.grown + 1)) return state;
  const plots: FarmState['plots'] = [...farm.plots]; plots[plot] = null;
  return { ...state, farm: { ...farm, karma: farm.karma + 1, grown: farm.grown + 1, plots } };
}
