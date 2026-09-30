import type { CommunityFacilityId } from './community';

export const SQUIRREL_EXPEDITION_MS = 4 * 60 * 60 * 1000;
export type SquirrelTrip = { destination: CommunityFacilityId; departedAt: number; returnsAt: number; reward: number };
export type SquirrelSnapshot = { owned: boolean; questReady: boolean; trips: number; trip: SquirrelTrip | null };

// Conservative test economy: one pet, one route at a time. Quote is fixed at dispatch.
export function squirrelReward(destination: CommunityFacilityId, treeLevel: number, facilityLevel: number): number {
  const base = destination === 'mine' ? treeLevel * 40 : treeLevel * 8;
  return Math.floor(base * (100 + (facilityLevel - 1) * 10) / 100);
}
