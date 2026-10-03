import { farmBoard, farmSolved } from './farm.ts';
import type { FarmPlot } from './farm.ts';

// Water travels from the water source (8) back to the seed (0), never through rocks.
export function farmWaterRoute(seed: number, rotations: readonly number[]): number[] {
  return farmSolved(seed, rotations) ? [...farmBoard(seed).path].reverse() : [];
}
export function nextFarmAngle(previousAngle: number, rotation: number) {
  const current = ((Math.round(previousAngle / 90) % 4) + 4) % 4;
  return previousAngle + ((rotation - current + 4) % 4) * 90;
}
export function farmPlotStatus(plot: FarmPlot | null, now: number) {
  return !plot ? 'empty' : plot.readyAt === 0 ? 'water' : now >= plot.readyAt ? 'ready' : 'growing';
}
export function farmWateringConfirmed(before: FarmPlot | null, after: FarmPlot | null) {
  return !!before && before.readyAt === 0 && !!after && after.plantedAt === before.plantedAt && after.readyAt > 0;
}
