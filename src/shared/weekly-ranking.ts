export type WeeklyRankingCategory = 'community' | 'world-boss';
export type WeeklyRankingEntry = {
  tag: string; rank: number; score: number; isMe: boolean;
  mine?: number; saplings?: number; hits?: number;
};
export type WeeklyRanking = {
  category: WeeklyRankingCategory; weekStart: number; resetsAt: number; asOf: number;
  participants: number; eligible: boolean; entries: WeeklyRankingEntry[]; mine: WeeklyRankingEntry | null;
};
export type LoadWeeklyRanking = (category: WeeklyRankingCategory) => Promise<WeeklyRanking>;
