// Read-only synthetic simulation. No player saves, real time, wallets or purchases.
import { initialProgress, hit, collect, upgrade, regrow, characterLevel } from './progression.ts';
function run(seed, pickup = 1, options = []) {
  let rng = seed;
  const random = () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  let state = { ...initialProgress('en'), inventory: options, slots: [options[0] ?? null, options[1] ?? null] };
  let sessions = 1, repeats = 0;
  const milestones = {};
  while (state.totalHits < 500000) {
    while (true) { const next = upgrade(state, 'axe'); if (next === state) break; state = next; }
    if (state.treeHp === 0) {
      if (state.treeLevel === 1000) break;
      const next = upgrade(state, 'tree');
      if (next === state) { state = regrow(state); repeats++; } else state = next;
    }
    if ([10, 100, 500, 1000].includes(state.treeLevel) && !milestones[state.treeLevel]) {
      milestones[state.treeLevel] = { character: characterLevel(state.xp), axe: state.axeLevel, hits: state.totalHits };
    }
    if (state.fatigue >= 100) { sessions++; state = { ...state, fatigue: 0, recoveryAt: null }; }
    const result = hit(state, 0, random);
    state = random() < pickup ? collect(result.state, result.manualWood) : result.state;
  }
  if (state.treeLevel !== 1000 || state.treeHp !== 0) throw Error('Did not finish');
  return { seed, pickup, options, milestones, hits: state.totalHits, sessions, repeats, character: characterLevel(state.xp) };
}
console.log(JSON.stringify({ assumptions: 'Instant rest after exhaustion; no natural recovery or real calendar time. Axe upgrades ASAP, tree upgrade on depletion; 5 seeds without equipment, plus missed-pickup and strong-equipment sensitivity runs. Strong options granted from start only as a stress test.',
  runs: [1, 42, 2026, 100, 999].map(seed => run(seed)).concat([
    run(42, 0.8), run(42, 1, ['legendary:critChance', 'legendary:critDamage']),
  ]) }, null, 2));
