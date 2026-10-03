import type { FarmState } from './farm';
import type { SquirrelSnapshot } from '../shared/pets';
import type { WorldBossSnapshot } from '../shared/world-boss';

export type ForestNewsKind = 'pet' | 'farm' | 'boss';

// Read-only hints; receiving rewards still goes through the normal confirmed command.
export function forestNews({ now, pet, farm, boss, petUnlocked, farmUnlocked, mapUnlocked }: {
  now: number; pet?: SquirrelSnapshot; farm?: FarmState; boss?: WorldBossSnapshot;
  petUnlocked: boolean; farmUnlocked: boolean; mapUnlocked: boolean;
}): ForestNewsKind | null {
  if (petUnlocked && pet?.owned && pet.trip && now >= pet.trip.returnsAt) return 'pet';
  if (mapUnlocked && farmUnlocked && farm?.plots.some(plot => plot && plot.readyAt > 0 && now >= plot.readyAt)) return 'farm';
  if (mapUnlocked && (boss?.rewards?.some(reward => reward.ready && !reward.claimed)
    || boss?.sharedRewards?.some(reward => reward.ready && !reward.claimed))) return 'boss';
  return null;
}
