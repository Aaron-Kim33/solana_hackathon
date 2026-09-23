export const QUEST_KEYS = ['qHarvest', 'qWallet', 'qAxe', 'qCharacter', 'qTree', 'qRecord',
  'qReward', 'qSkin', 'qHarvestMore', 'qGrowth', 'qGemReward', 'qOpenGem', 'qEquipGem',
  'qSecondPower', 'qMyAxe', 'qForestPioneer', 'qSkilledCutter', 'qPioneerTraining', 'qDeepForest'] as const;

// Presentation follows sequential completion; it never changes saved quest progress.
export function questView(statuses: readonly string[]) {
  const active = statuses.findIndex(status => status === 'active');
  const chapter = active < 0 ? 'questsFinished' : active < 6 ? 'questFirstSteps'
    : active < 9 ? 'questFirstRecord' : active < 11 ? 'questGrowth' : active < 13 ? 'questGemPower' : 'questFrontier';
  const end = active < 6 ? 6 : active < 9 ? 9 : active < 11 ? 11 : active < 13 ? 13 : active + 1;
  return { active, chapter, entries: QUEST_KEYS.map((key, index) => ({ key, index }))
    .filter(({ index }) => active >= 0 && index >= active && index < end) } as const;
}
