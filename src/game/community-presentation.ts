import type { CommunityFacilityView, CommunitySnapshot } from '../shared/community.ts';
import { squirrelReward } from '../shared/pets.ts';
import type { SquirrelSnapshot } from '../shared/pets.ts';

export function facilityRewardPreview(facility: CommunityFacilityView, treeLevel: number) {
  const current = squirrelReward(facility.id, treeLevel, facility.level);
  const next = facility.nextTarget === null ? null : squirrelReward(facility.id, treeLevel, facility.level + 1);
  return { current, next, increase: next === null ? 0 : next - current };
}

// Initial entry, reconnection and weekly resets are not level-up events.
export function communityLevelUps(previous: CommunitySnapshot, current: CommunitySnapshot) {
  if (previous.weekStart !== current.weekStart) return [];
  return current.facilities.filter(facility => {
    const before = previous.facilities.find(item => item.id === facility.id);
    return before !== undefined && facility.level > before.level;
  });
}

export function facilityNeeds(facility: CommunityFacilityView) {
  return {
    materials: Math.max(0, (facility.nextTarget ?? facility.total) - facility.total),
    people: Math.max(0, (facility.nextContributors ?? facility.contributors) - facility.contributors),
  };
}

const STAGES = {
  mine: {
    ko: ['작은 입구', '불 켜진 광산', '빛나는 광맥', '활기찬 광산', '풍요로운 광산'],
    en: ['Small entrance', 'Lantern-lit mine', 'Glowing veins', 'Bustling mine', 'Abundant mine'],
  },
  saplings: {
    ko: ['새싹의 시작', '초록빛 묘목길', '무럭무럭 묘목길', '꽃피는 묘목길', '풍요로운 묘목길'],
    en: ['First sprouts', 'Green nursery', 'Growing nursery', 'Blooming nursery', 'Abundant nursery'],
  },
};

export function facilityStage(facility: CommunityFacilityView, language: 'ko' | 'en') {
  return STAGES[facility.id][language][Math.max(0, Math.min(4, facility.level - 1))];
}

// Cosmetic only: no separate level, currency or reward system.
export function lifeTreeStage(state: CommunitySnapshot): 0 | 1 | 2 {
  const growth = (['mine', 'saplings'] as const).reduce((sum, id) => {
    const level = state.facilities.find(item => item.id === id)?.level ?? 1;
    return sum + (Number.isFinite(level) ? Math.max(0, Math.min(4, level - 1)) : 0);
  }, 0);
  return growth >= 5 ? 2 : growth >= 2 ? 1 : 0;
}

export function lifeTreePlacement() {
  return { centerX: 0.5, groundY: 0.83 };
}

export type CommunityNextAction = 'collect-pet' | 'first-contribution' | 'claim-pet' | 'first-trip' | 'claim-materials' | 'contribute' | 'get-materials' | null;

// A single contextual next step, not an additional blocking tutorial or timer.
export function communityNextAction(state: CommunitySnapshot, pet: SquirrelSnapshot | undefined, now: number): CommunityNextAction {
  if (pet?.owned && pet.trip && now >= pet.trip.returnsAt) return 'collect-pet';
  if (state.materials > 0 && state.myContribution === 0 && (pet?.trips ?? 0) === 0) return 'first-contribution';
  if (pet && !pet.owned && pet.questReady) return 'claim-pet';
  if (pet?.owned && !pet.trip && pet.trips === 0) return 'first-trip';
  if (state.quests.some(quest => !quest.claimed && quest.progress >= quest.target)) return 'claim-materials';
  if (state.materials > 0) return 'contribute';
  if (state.myContribution === 0 && (pet?.trips ?? 0) === 0) return 'get-materials';
  return null;
}

export function confirmedContributions(previous: CommunitySnapshot, current: CommunitySnapshot) {
  if (previous.weekStart !== current.weekStart || current.myContribution <= previous.myContribution) return [];
  return current.facilities.filter(item => {
    const before = previous.facilities.find(facility => facility.id === item.id);
    return before !== undefined && item.mine > before.mine;
  }).map(item => item.id);
}
