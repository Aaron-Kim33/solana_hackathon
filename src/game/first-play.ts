import type { Progress } from './progression';

// UI guidance only. Never changes quest state or awards progress.
export function firstHarvestPrompt(state: Pick<Progress, 'harvested' | 'walletCompleted'>) {
  if (state.walletCompleted) return null;
  if (state.harvested < 20) return { key: 'firstHarvestProgress' as const, value: state.harvested };
  return { key: 'firstHarvestReady' as const };
}
