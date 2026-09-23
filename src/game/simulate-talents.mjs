// Synthetic saves only. No player data or real purchases.
import { initialProgress, hit, collect, upgrade, regrow, characterLevel, TALENT_IDS, TALENT_MAX, talentCost, treeCost, upgradeTalent } from './progression.ts';
function simulate(seed, strategy, pickup) {
  let rng = seed;
  const random = () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  let state = initialProgress('ko'), spent = 0, repeats = 0, autoWood = 0;
  const milestones = {};
  while (state.treeLevel < 100 && state.totalHits < 100000) {
    while (true) { const next = upgrade(state, 'axe'); if (next === state) break; state = next; }
    if (!state.treeHp) {
      const next = upgrade(state, 'tree');
      if (next === state) { state = regrow(state); repeats++; } else state = next;
    }
    if ([25, 50, 100].includes(state.treeLevel) && !milestones[state.treeLevel]) {
      milestones[state.treeLevel] = { hits: state.totalHits, wood: state.wood, character: characterLevel(state.xp), talents: state.talents, spent, repeats };
    }
    if (strategy !== 'none') for (const id of TALENT_IDS) {
      if (strategy === 'lumber' && id !== 'lumber') continue;
      const target = Math.min(TALENT_MAX[id], Math.ceil(state.treeLevel / (id === 'lumber' ? 5 : 10)));
      while (state.talents[id] < target && state.wood >= treeCost(state.treeLevel) + talentCost(id, state.talents[id])) {
        const next = upgradeTalent(state, id); spent += state.wood - next.wood; state = next;
      }
    }
    if (state.fatigue >= 100) state = { ...state, fatigue: 0, recoveryAt: null };
    const result = hit(state, 0, random);
    if (result.autoCollected) autoWood += result.value;
    state = random() < pickup ? collect(result.state, result.manualWood) : result.state;
  }
  return { seed, strategy, pickup, milestones, autoWood };
}
console.log(JSON.stringify({ assumptions: '5 seeds, no gear/quest rewards, immediate axe upgrades, reserve next tree cost before buying talents, lumber target ceil(tree/5), other targets ceil(tree/10). Instant rest on exhaustion, not calendar time.',
  runs: ['none', 'lumber', 'balanced'].flatMap(strategy => [1, 42, 2026, 100, 999].map(seed => simulate(seed, strategy, 1)))
    .concat([simulate(42, 'none', 0.8), simulate(42, 'balanced', 0.8)]) }, null, 2));
