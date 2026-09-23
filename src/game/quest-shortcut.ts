import { skinQuestCollected, type Progress } from './progression.ts';
import { firstHarvestPrompt } from './first-play.ts';
import { QUEST_KEYS } from './quest-view.ts';

// Keep the next quest reachable from the forest without changing progression.
export function questShortcut(state: Pick<Progress, 'harvested' | 'walletCompleted' | 'skinQuestHarvestStart'>, statuses: readonly string[]) {
  const first = firstHarvestPrompt(state);
  if (first) return first;
  const active = statuses.findIndex(status => status === 'active');
  if (active === 8) return { key: 'firstRecordHarvestProgress' as const, value: skinQuestCollected(state) };
  return active >= 0 && active < QUEST_KEYS.length
    ? { key: 'nextQuest' as const, quest: QUEST_KEYS[active] }
    : null;
}
