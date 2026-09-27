// Diagnostic only: no saves, network calls or player accounts.
// Assumes every dropped log is collected and coins are spent on the equipped axe.
import { initialProgress, hit, collect, upgrade, regrow, characterLevel, treeHealth, treeCost } from './progression.ts';

function run(seed, collectionRate) {
  let rng = seed;
  const random = () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296);
  let pickupRng = seed + 99;
  const pickupRandom = () => ((pickupRng = (Math.imul(pickupRng, 1664525) + 1013904223) >>> 0) / 4294967296);
  let state = initialProgress('en'), hitCount = 0, replays = 0, fatigueStops = 0;
  const milestones = {};
  while (state.treeLevel < 25 && hitCount < 5000) {
    if (state.treeHp === 0) {
      const raised = upgrade(state, 'tree');
      if (raised === state) { state = regrow(state); replays++; }
      else {
        state = raised;
        if ([2, 5, 10, 15, 25].includes(state.treeLevel)) milestones[state.treeLevel] = {
          hits: hitCount, attackSeconds: hitCount * 2, axeLevel: state.axeLevel,
          characterLevel: characterLevel(state.xp), xp: state.xp, wood: state.wood, replays, fatigueStops,
        };
      }
      continue;
    }
    while (true) {
      const raised = upgrade(state, 'axe');
      if (raised === state) break;
      state = raised;
    }
    if (state.fatigue === 100) {
      fatigueStops++;
      state = { ...state, fatigue: 0, recoveryAt: null }; // Count stops; exclude actual recovery time.
    }
    const result = hit(state, 1000 + hitCount * 2000, random);
    if (!result) throw new Error('UNEXPECTED_BLOCK');
    state = pickupRandom() < collectionRate ? collect(result.state, result.value) : result.state;
    hitCount++;
  }
  return { seed, collectionRate, milestones, finalLevel: state.treeLevel, firstTenHealth: [1, 2, 5, 10].map(treeHealth),
    firstTenCosts: [1, 2, 5, 10].map(treeCost) };
}
console.log(JSON.stringify([1, 42, 2026].flatMap(seed => [1, 0.8].map(rate => run(seed, rate))), null, 2));
