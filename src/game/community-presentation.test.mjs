import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facilityRewardPreview, facilityNeeds, facilityStage, communityLevelUps, lifeTreeStage, lifeTreePlacement, confirmedContributions, communityNextAction } from './community-presentation.ts';

const mine = { id: 'mine', total: 20, mine: 20, contributors: 1, level: 2, nextTarget: 45, nextContributors: 2 };
const snapshot = (facilities, weekStart = 0) => ({ dayStart: 0, weekStart, materials: 5, targetUnit: 1, quests: [], facilities, myContribution: 20 });

test('community guidance follows materials, contribution, companion and first trip in order', () => {
  const initial = { ...snapshot([mine]), materials: 0, myContribution: 0 };
  const companion = { owned: false, questReady: false, trips: 0, trip: null };
  assert.equal(communityNextAction(initial, companion, 0), 'get-materials');
  const materials = { ...initial, materials: 5 };
  assert.equal(communityNextAction(materials, { ...companion, questReady: true }, 0), 'first-contribution');
  const contributed = { ...materials, materials: 0, myContribution: 5 };
  assert.equal(communityNextAction(contributed, { ...companion, questReady: true }, 0), 'claim-pet');
  assert.equal(communityNextAction(contributed, { ...companion, owned: true }, 0), 'first-trip');
  assert.equal(communityNextAction(contributed, { ...companion, owned: true, trips: 1 }, 0), null);
});

test('returning pet has priority over quests, spare materials and new-week onboarding', () => {
  const pet = { owned: true, questReady: false, trips: 1, trip: { destination: 'mine', departedAt: 0, returnsAt: 100, reward: 40 } };
  const state = { ...snapshot([mine]), myContribution: 0, quests: [{ id: 'd_hits', progress: 20, target: 20, claimed: false }] };
  assert.equal(communityNextAction(state, pet, 99), 'claim-materials');
  assert.equal(communityNextAction(state, pet, 100), 'collect-pet');
  assert.equal(communityNextAction({ ...state, quests: [] }, pet, 99), 'contribute');
});

test('claimed quests, past trips and quiet sessions do not repeat beginner prompts', () => {
  const state = { ...snapshot([mine]), materials: 0, quests: [{ progress: 20, target: 20, claimed: true }] };
  assert.equal(communityNextAction(state, undefined, 0), null);
  const experienced = { owned: true, questReady: false, trips: 2, trip: null };
  assert.equal(communityNextAction({ ...state, myContribution: 0 }, experienced, 0), null);
  assert.equal(communityNextAction({ ...state, quests: [{ progress: 19, target: 20, claimed: false }] }, experienced, 0), null);
});

test('tree stays centered and squirrel fits on its left without sprite overlap', () => {
  assert.deepEqual(lifeTreePlacement(), { centerX: 0.5, groundY: 0.83 });
  for (const width of [287, 360, 430]) {
    const treeCenter = width * lifeTreePlacement().centerX;
    const petCenter = width * 0.5 - 143 + 40;
    assert.ok(treeCenter + 60 <= width);
    assert.ok(petCenter - 38 >= 0);
    assert.ok(petCenter + 38 < treeCenter - 60);
  }
});

test('life tree follows combined real facility growth without extra rewards', () => {
  const forest = (a, b) => snapshot([{ ...mine, level: a }, { ...mine, id: 'saplings', level: b }]);
  assert.equal(lifeTreeStage(forest(1, 1)), 0);
  assert.equal(lifeTreeStage(forest(2, 1)), 0);
  assert.equal(lifeTreeStage(forest(2, 2)), 1);
  assert.equal(lifeTreeStage(forest(3, 3)), 1);
  assert.equal(lifeTreeStage(forest(4, 3)), 2);
  assert.equal(lifeTreeStage(forest(5, 5)), 2);
  assert.equal(lifeTreeStage(snapshot([])), 0);
  assert.equal(lifeTreeStage(forest(NaN, 1)), 0);
});

test('contribution lights require personal confirmed increases in the same week', () => {
  const before = snapshot([mine]);
  const after = { ...snapshot([{ ...mine, mine: 25, total: 25 }]), myContribution: 25 };
  assert.deepEqual(confirmedContributions(before, after), ['mine']);
  assert.deepEqual(confirmedContributions(after, after), []);
  assert.deepEqual(confirmedContributions(before, { ...after, weekStart: 604800000 }), []);
  assert.deepEqual(confirmedContributions(before, snapshot([{ ...mine, total: 25 }])), []);
  assert.deepEqual(confirmedContributions(snapshot([]), after), []);
});

test('facility preview uses actual expedition formula for both routes and tree levels', () => {
  assert.deepEqual(facilityRewardPreview(mine, 20), { current: 880, next: 960, increase: 80 });
  assert.deepEqual(facilityRewardPreview({ ...mine, id: 'saplings' }, 20), { current: 176, next: 192, increase: 16 });
  assert.deepEqual(facilityRewardPreview({ ...mine, id: 'saplings' }, 3), { current: 26, next: 28, increase: 2 });
});

test('maximum level has no nonexistent next reward', () => {
  assert.deepEqual(facilityRewardPreview({ ...mine, level: 5, nextTarget: null, nextContributors: null }, 20),
    { current: 1120, next: null, increase: 0 });
});

test('full materials do not hide missing distinct contributors', () => {
  assert.deepEqual(facilityNeeds(mine), { materials: 25, people: 1 });
  assert.deepEqual(facilityNeeds({ ...mine, total: 60 }), { materials: 0, people: 1 });
  assert.deepEqual(facilityNeeds({ ...mine, total: 60, contributors: 3 }), { materials: 0, people: 0 });
  assert.deepEqual(facilityNeeds({ ...mine, nextTarget: null, nextContributors: null }), { materials: 0, people: 0 });
});

test('celebrate only same-week confirmed level increases, not entry, repeats or downgrades', () => {
  const before = snapshot([mine]);
  assert.deepEqual(communityLevelUps(before, before), []);
  assert.deepEqual(communityLevelUps(snapshot([]), before), []);
  assert.deepEqual(communityLevelUps(before, snapshot([{ ...mine, level: 1 }])), []);
  assert.deepEqual(communityLevelUps(before, snapshot([{ ...mine, level: 4 }], 604800000)), []);
  const after = snapshot([{ ...mine, level: 3 }]);
  assert.deepEqual(communityLevelUps(before, after), after.facilities);
  assert.deepEqual(communityLevelUps(after, after), []);
});

test('both facilities can celebrate together without fabricating levels', () => {
  const saplings = { ...mine, id: 'saplings' };
  const before = snapshot([mine, saplings]);
  const after = snapshot([{ ...mine, level: 3 }, { ...saplings, level: 4 }]);
  assert.deepEqual(communityLevelUps(before, after), after.facilities);
});

test('growth stages are localized, bounded and distinct across real facility levels', () => {
  for (const id of ['mine', 'saplings']) {
    for (const language of ['ko', 'en']) {
      const names = [1, 2, 3, 4, 5].map(level => facilityStage({ ...mine, id, level }, language));
      assert.equal(new Set(names).size, 5);
      assert.ok(names.every(name => typeof name === 'string' && name.length > 0));
      assert.equal(facilityStage({ ...mine, id, level: 0 }, language), names[0]);
      assert.equal(facilityStage({ ...mine, id, level: 9 }, language), names[4]);
    }
  }
});
