import type { CommunityFacilityId } from './community';

export const SQUIRREL_EXPEDITION_MS = 4 * 60 * 60 * 1000;
export type SquirrelTrip = { destination: CommunityFacilityId; departedAt: number; returnsAt: number; reward: number };
export type SquirrelSnapshot = { owned: boolean; questReady: boolean; trips: number; trip: SquirrelTrip | null };

export function squirrelAtHome(pet: SquirrelSnapshot | undefined, now: number): boolean {
  return !!pet?.owned && (!pet.trip || now >= pet.trip.returnsAt);
}

export function squirrelNeedsAttention(pet: SquirrelSnapshot | undefined, now: number): boolean {
  return !!pet && (pet.owned ? !pet.trip || now >= pet.trip.returnsAt : pet.questReady);
}

export function squirrelTimeLeft(returnsAt: number, now: number): string {
  const minutes = Math.ceil(Math.max(0, returnsAt - now) / 60_000);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

// Conservative test economy: one pet, one route at a time. Quote is fixed at dispatch.
export function squirrelReward(destination: CommunityFacilityId, treeLevel: number, facilityLevel: number): number {
  const base = destination === 'mine' ? treeLevel * 40 : treeLevel * 8;
  return Math.floor(base * (100 + (facilityLevel - 1) * 10) / 100);
}
