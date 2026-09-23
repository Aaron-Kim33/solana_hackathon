// Diagnostic only: never reads or changes player saves.
// Run: node --experimental-strip-types src/game/simulate-balance.mjs
import { initialProgress, hit, collect, upgrade, regrow, AXE_MAX, TREE_MAX, characterLevel, xpFloor } from './progression.ts';

function simulate(seed, bonusEnabled, collectionRate = 1) {
  let rng = seed;
  const random = () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296);
  let pickupRng = seed + 99;
  const pickupRandom = () => ((pickupRng = (Math.imul(pickupRng, 1664525) + 1013904223) >>> 0) / 4294967296);
  let state = initialProgress('en'), levelUps = 0, hitsTo100 = 0, replays = 0;
  let sessions = 1, fatigueRecoveredByLevels = 0, hitsToCharacter200 = 0, bonusCollected = 0;
  // Same three combat RNG draws per strike for both variants. Baseline discards only the bonus.
  // One session lasts until exhaustion, INCLUDING level-up refills; instant recovery between sessions.
  // No real elapsed time or natural recovery. These sessions are NOT calendar days.
  while (state.totalHits < 2000000) {
    if (state.treeHp === 0) {
      if (state.treeLevel === TREE_MAX) break;
      const next = upgrade(state, 'tree');
      if (next === state) { state = regrow(state); replays++; }
      else state = next;
      if (state.treeLevel === 100 && !hitsTo100) hitsTo100 = state.totalHits;
    }
    while (state.axeLevel < AXE_MAX) {
      const next = upgrade(state, 'axe');
      if (next === state) break;
      state = next;
    }
    if (state.fatigue === 100) {
      sessions++;
      state = { ...state, fatigue: 0, recoveryAt: null };
    }
    const beforeLevel = characterLevel(state.xp);
    const strike = hit(state, 1000, random);
    const pickedUp = pickupRandom() < collectionRate;
    const value = strike.baseWood + (bonusEnabled ? strike.bonusWood : 0);
    state = pickedUp ? collect(strike.state, value) : strike.state;
    if (pickedUp && bonusEnabled) bonusCollected += strike.bonusWood;
    if (characterLevel(state.xp) > beforeLevel) fatigueRecoveredByLevels += strike.state.fatigue;
    levelUps += characterLevel(state.xp) - beforeLevel;
    if (!hitsToCharacter200 && characterLevel(state.xp) === 200) hitsToCharacter200 = state.totalHits;
  }
  if (state.treeLevel !== TREE_MAX || state.treeHp !== 0) throw new Error('Simulation did not finish');
  return { seed, bonusEnabled, collectionRate, hitsTo100, hitsToEnding: state.totalHits,
    hundredHitSessions: Math.ceil(state.totalHits / 100), exhaustionSessions: sessions,
    hitsToCharacter200, fatigueRecoveredByLevels, bonusCollected,
    replays, characterLevel: characterLevel(state.xp), levelUps };
}
const totalHp = 100 * TREE_MAX * (TREE_MAX + 1) / 2 + 200 * TREE_MAX;
const maxAverageDamage = 200.7 * (1 + 0.219 * (3.04 - 1));
const variants = [
  { bonus: false, pickup: 1 }, { bonus: true, pickup: 1 },
  { bonus: false, pickup: 0.8 }, { bonus: true, pickup: 0.8 },
];
const comparison = variants.map(({ bonus, pickup }) => {
  const runs = [1, 42, 2026, 100, 999].map(seed => simulate(seed, bonus, pickup));
  const summary = {};
  for (const key of ['hitsTo100', 'hitsToEnding', 'exhaustionSessions', 'hitsToCharacter200', 'fatigueRecoveredByLevels', 'bonusCollected']) {
    const values = runs.map(run => run[key]);
    summary[key] = { min: Math.min(...values), max: Math.max(...values), mean: Math.round(values.reduce((a, b) => a + b, 0) / values.length) };
  }
  return { bonusEnabled: bonus, collectionRate: pickup, summary };
});
console.log(JSON.stringify({ assumptions: 'No options; upgrade axe while alive, tree when felled. Independent random bundle collection. Sessions include level-up refills but exclude natural recovery and real time; not calendar days. Five seeds per variant.',
  totalHp, maxAverageDamage, theoreticalExpectedHitsIgnoringGrowthAndOverkill: totalHp / maxAverageDamage,
  guaranteedMinimumHitsAtEveryHitMaxCrit: Math.ceil(totalHp / (202 * 3.04)),
  xpForCharacter200: xpFloor(200), comparison }, null, 2));
