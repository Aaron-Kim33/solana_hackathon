import type { Progress } from './progression';
import type { SquirrelSnapshot } from '../shared/pets';
import type { CommunitySnapshot } from '../shared/community';

export type ForestShortcutUnlocks = { gems: boolean; map: boolean; pet: boolean };

// A prior community quest is a legacy access marker: never hide a map that an
// existing server player already used before shortcut progression was added.
export function forestShortcutUnlocks(progress: Progress, squirrel?: SquirrelSnapshot, community?: CommunitySnapshot): ForestShortcutUnlocks {
  const communityVisited = !!squirrel?.questReady || !!squirrel?.owned || (community?.myContribution ?? 0) > 0;
  const map = progress.rewardOption !== null || progress.gemSlotQuestDone || communityVisited;
  return {
    gems: progress.growthRewardClaimed || map,
    map,
    pet: !!squirrel?.owned,
  };
}
