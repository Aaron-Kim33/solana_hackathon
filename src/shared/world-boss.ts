import { communityWeekStart } from './community.ts';

export const WORLD_BOSS_WEEKLY_HITS = 100;
export const worldBossWeekStart = communityWeekStart;
export const WORLD_BOSS_REWARD_HITS = [20, 50, 100] as const;
export type WorldBossRewardView = { weekStart: number; stage: number; target: number; ready: boolean; claimed: boolean;
  treeLevel: number; coins: number; lowGems: number; potions: number };
export function worldBossReward(stage: number, treeLevel: number) {
  return { coins: stage === 1 ? treeLevel * 20 : 0, lowGems: stage === 0 ? 1 : 0, potions: stage === 2 ? 1 : 0 };
}

export const WORLD_BOSS_SHARED_MIN_HITS = 20;
export const WORLD_BOSS_SHARED_MIN_BASE = 10_000;
export function nextWorldBossSharedBase(previousDamage: number, previousBase = WORLD_BOSS_SHARED_MIN_BASE) {
  const lower = Math.max(WORLD_BOSS_SHARED_MIN_BASE, Math.ceil(previousBase * .75));
  const upper = Math.floor(previousBase * 1.25);
  return Math.max(lower, Math.min(upper, Math.floor(previousDamage / 2)));
}
export function worldBossSharedReward(stage: number) {
  return { lowGems: stage === 0 ? 1 : stage === 1 ? 2 : 0, mediumGems: stage === 2 ? 1 : 0 };
}
export type WorldBossSharedRewardView = { weekStart: number; stage: number; target: number; totalDamage: number;
  myHits: number; ready: boolean; claimed: boolean; lowGems: number; mediumGems: number };

export type WorldBossSnapshot = {
  weekStart: number;
  hits: number;
  damage: number;
  totalHits: number;
  totalDamage: number;
  participants: number;
  rewardTreeLevel?: number | null;
  rewards?: WorldBossRewardView[];
  sharedRewards?: WorldBossSharedRewardView[];
};
