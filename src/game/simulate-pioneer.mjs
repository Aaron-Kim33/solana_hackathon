// Isolate XP bonus: identical axe levels, tree levels and hit counts. Not a calendar-time model.
import { initialProgress, hit, regrow, characterLevel, xpFloor, treeHealth } from './progression.ts';
const results = [];
for (const treeLevel of [50, 100, 500]) {
  const startingLevel = treeLevel === 500 ? 90 : 10;
  const pair = [];
  for (const axeSkin of ['default', 'pioneer']) {
    let rng = 42, resets = 0;
    const random = () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    let state = { ...initialProgress('en'), axeSkin, axeLevel: 100, treeLevel, treeHp: treeHealth(treeLevel),
      xp: xpFloor(startingLevel), adventureClaimed: 4, firstRecordClaimed: true,
      walletCompleted: true, receipt: { address: 'simulation', signature: 'simulation', status: 'confirmed' },
      harvested: 1000, skinQuestHarvestStart: 900, growthRewardClaimed: true, gemSlotQuestDone: true,
      rewardOption: 'low:damage', inventory: ['low:damage'] };
    const start = state.xp;
    for (let i = 0; i < 10000; i++) {
      if (!state.treeHp) state = regrow(state);
      if (state.fatigue >= 100) { resets++; state = { ...state, fatigue: 0, recoveryAt: null }; }
      state = hit(state, 0, random).state;
    }
    pair.push({ axeSkin, gainedXp: state.xp - start, character: characterLevel(state.xp), manualRestCount: resets });
  }
  if (pair[1].gainedXp * 10 !== pair[0].gainedXp * 11) throw Error('XP bonus mismatch');
  results.push({ treeLevel, startingLevel, hits: 10000, pair });
}
console.log(JSON.stringify(results, null, 2));
