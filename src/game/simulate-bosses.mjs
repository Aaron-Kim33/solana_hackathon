import { initialProgress, hit, xpFloor, encounterHealth } from './progression.ts';
// Synthetic sensitivity cases, not measurements of real players or calendar time.
const cases = [
  [50, 'low', 40, 8, 0], [50, 'baseline', 70, 10, 6], [50, 'high', 100, 12, 12],
  [100, 'low', 25, 12, 5], [100, 'baseline', 60, 15, 10], [100, 'high', 140, 20, 20],
];
for (const [treeLevel, spec, axeLevel, characterLevel, lumber] of cases) {
  const samples = [];
  for (const seed of [1, 42, 100, 999, 2026]) {
    let rng = seed;
    const random = () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296);
    let state = { ...initialProgress('en'), treeLevel, axeLevel, xp: xpFloor(characterLevel),
      axeSkin: treeLevel === 50 ? 'firstRecord' : 'pioneer', firstRecordClaimed: true, skinQuestHarvestStart: 0,
      adventureClaimed: treeLevel === 100 ? 4 : 0,
      talents: { lumber, learning: 0, autoCollect: 0 } };
    state.treeHp = encounterHealth(state);
    let hits = 0, wood = 0;
    while (state.treeHp > 0) {
      const result = hit({ ...state, fatigue: 0, recoveryAt: null }, 0, random);
      state = result.state; wood += result.value; hits++;
    }
    samples.push({ hits, wood });
  }
  console.log(JSON.stringify({ treeLevel, spec, axeLevel, characterLevel, lumber,
    hits: [Math.min(...samples.map(s => s.hits)), Math.max(...samples.map(s => s.hits))],
    generatedWood: [Math.min(...samples.map(s => s.wood)), Math.max(...samples.map(s => s.wood))] }));
}
