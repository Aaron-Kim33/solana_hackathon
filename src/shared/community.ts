export const COMMUNITY_DAY_MS = 86_400_000;
export const COMMUNITY_WEEK_MS = 7 * COMMUNITY_DAY_MS;
export const communityDayStart = (time: number) => Math.floor(time / COMMUNITY_DAY_MS) * COMMUNITY_DAY_MS;
// Monday 00:00 UTC. Epoch day zero was a Thursday.
export const communityWeekStart = (time: number) =>
  Math.floor((time + 3 * COMMUNITY_DAY_MS) / COMMUNITY_WEEK_MS) * COMMUNITY_WEEK_MS - 3 * COMMUNITY_DAY_MS;

export const COMMUNITY_QUESTS = [
  { id: 'd_hits', period: 'daily', metric: 'hits', target: 10, materials: 5 },
  { id: 'd_bundles', period: 'daily', metric: 'bundles', target: 3, materials: 5 },
  { id: 'd_trolley', period: 'daily', metric: 'trolleys', target: 1, materials: 5 },
  { id: 'w_hits', period: 'weekly', metric: 'hits', target: 50, materials: 15 },
  { id: 'w_bundles', period: 'weekly', metric: 'bundles', target: 15, materials: 15 },
  { id: 'w_trolley', period: 'weekly', metric: 'trolleys', target: 5, materials: 15 },
] as const;
export type CommunityQuestId = typeof COMMUNITY_QUESTS[number]['id'];
export type CommunityQuestView = { id: CommunityQuestId; progress: number; target: number; materials: number; claimed: boolean };
export const COMMUNITY_FACILITIES = ['mine', 'saplings'] as const;
export type CommunityFacilityId = typeof COMMUNITY_FACILITIES[number];
// Both materials and distinct contributors matter. Each counted account must contribute at least 10 to that facility.
export const COMMUNITY_MIN_CONTRIBUTION = 10;
export const COMMUNITY_LEVEL_STEPS = [20, 45, 80, 120] as const;
export const COMMUNITY_CONTRIBUTOR_STEPS = [1, 2, 3, 5] as const;
export const communityFacilityLevel = (total: number, unit: number, contributors: number) =>
  1 + COMMUNITY_LEVEL_STEPS.filter((step, index) => total >= step * unit && contributors >= COMMUNITY_CONTRIBUTOR_STEPS[index]).length;
export type CommunityFacilityView = { id: CommunityFacilityId; total: number; mine: number; contributors: number;
  level: number; nextTarget: number | null; nextContributors: number | null };
export type CommunitySnapshot = { dayStart: number; weekStart: number; materials: number; targetUnit: number;
  quests: CommunityQuestView[]; facilities: CommunityFacilityView[]; myContribution: number };
