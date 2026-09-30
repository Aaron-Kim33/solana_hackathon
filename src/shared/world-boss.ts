import { communityWeekStart } from './community.ts';

export const WORLD_BOSS_WEEKLY_HITS = 100;
export const worldBossWeekStart = communityWeekStart;

export type WorldBossSnapshot = {
  weekStart: number;
  hits: number;
  damage: number;
  totalHits: number;
  totalDamage: number;
  participants: number;
};
