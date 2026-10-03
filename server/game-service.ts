import { claimGrowthReward, claimWardenReward, drawWoodGem, equip, fuseGems, GEM_TIERS, openGem, OPTION_ITEMS } from '../src/game/progression.ts';
import type { CommandRequest, PlayerSnapshot } from '../src/shared/server-contract.ts';
import { COMMUNITY_QUESTS, COMMUNITY_FACILITIES } from '../src/shared/community.ts';
export function parseRequest(value: unknown): CommandRequest {
  if (!value || typeof value !== 'object') throw new Error('INVALID_COMMAND');
  const r = value as CommandRequest;
  if (typeof r.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(r.requestId) ||
    !Number.isSafeInteger(r.expectedRevision) || r.expectedRevision < 0 || !r.command || typeof r.command !== 'object') throw new Error('INVALID_COMMAND');
  const c = r.command;
  if (c.type === 'claimWorldBossReward' || c.type === 'claimWorldBossSharedReward') {
    if (!Number.isInteger(c.stage) || c.stage < 0 || c.stage > 2 || !Number.isSafeInteger(c.weekStart) ||
      Object.keys(r).some(key => !['requestId', 'expectedRevision', 'command'].includes(key)) ||
      Object.keys(c).some(key => !['type', 'stage', 'weekStart'].includes(key))) throw new Error('INVALID_COMMAND');
    return r;
  }
  if (c.type === 'claimForestTrail') {
    if (!Number.isInteger(c.stage) || c.stage < 0 || c.stage > 9 ||
      Object.keys(r).some(key => !['requestId', 'expectedRevision', 'command'].includes(key)) ||
      Object.keys(c).some(key => !['type', 'stage'].includes(key))) throw new Error('INVALID_COMMAND');
    return r;
  }
  if (c.type === 'activateBlessing' || c.type === 'useFatiguePotion') {
    if (Object.keys(r).some(key => !['requestId', 'expectedRevision', 'command'].includes(key)) ||
      Object.keys(c).some(key => key !== 'type')) throw new Error('INVALID_COMMAND');
    return r;
  }
  if (c.type === 'claimAdventure') {
    if (!Number.isInteger(c.stage) || c.stage < 0 || c.stage > 5 ||
      Object.keys(r).some(key => !['requestId', 'expectedRevision', 'command'].includes(key)) ||
      Object.keys(c).some(key => !['type', 'stage'].includes(key))) throw new Error('INVALID_COMMAND');
    return r;
  }
  if (c.type === 'claimCommunityQuest') {
    if (!COMMUNITY_QUESTS.some(quest => quest.id === c.questId) ||
      Object.keys(r).some(key => !['requestId', 'expectedRevision', 'command'].includes(key)) ||
      Object.keys(c).some(key => !['type', 'questId'].includes(key))) throw new Error('INVALID_COMMAND');
    return r;
  }
  if (c.type === 'contributeCommunity') {
    if (!COMMUNITY_FACILITIES.includes(c.facility) || !Number.isSafeInteger(c.amount) || c.amount < 1 || c.amount > 150 ||
      Object.keys(r).some(key => !['requestId', 'expectedRevision', 'command'].includes(key)) ||
      Object.keys(c).some(key => !['type', 'facility', 'amount'].includes(key))) throw new Error('INVALID_COMMAND');
    return r;
  }
  if (c.type === 'dispatchSquirrel') {
    if (!COMMUNITY_FACILITIES.includes(c.destination) ||
      Object.keys(r).some(key => !['requestId', 'expectedRevision', 'command'].includes(key)) ||
      Object.keys(c).some(key => !['type', 'destination'].includes(key))) throw new Error('INVALID_COMMAND');
    return r;
  }
  if (c.type === 'plantFarmSeed' || c.type === 'startFarmPuzzle' || c.type === 'claimFarmTree' || c.type === 'finishFarmPuzzle') {
    if ((c.type === 'finishFarmPuzzle'
      ? !Array.isArray(c.rotations) || c.rotations.length !== 9 || c.rotations.some(value => !Number.isInteger(value) || value < 0 || value > 3)
      : c.plot !== 0 && c.plot !== 1) ||
      Object.keys(r).some(key => !['requestId', 'expectedRevision', 'command'].includes(key)) ||
      Object.keys(c).some(key => !(c.type === 'finishFarmPuzzle' ? ['type', 'rotations'] : ['type', 'plot']).includes(key))) throw new Error('INVALID_COMMAND');
    return r;
  }
  if (!['acknowledgeWallet', 'claimFirstRecord', 'claimGrowthReward', 'openGem', 'equipOption', 'fuse', 'drawGem', 'claimWardenReward', 'hit', 'hitBatch', 'hitWorldBoss', 'claimSquirrel', 'collectSquirrel', 'collectDrop', 'loadTrolley', 'loadTrolleyBatch', 'collectTrolley', 'recover', 'regrow', 'upgradeTree', 'upgradeAxe', 'equipAxe'].includes(c.type) || (c.type === 'equipAxe' && !['default', 'firstRecord', 'pioneer', 'warden', 'recovery'].includes(c.skin)) || (c.type === 'hitBatch' && (!Number.isInteger(c.count) || c.count < 1 || c.count > 4)) || ((c.type === 'fuse' || c.type === 'openGem') && !GEM_TIERS.includes(c.tier)) ||
    (c.type === 'equipOption' && ((c.slot !== 0 && c.slot !== 1) || typeof c.item !== 'string' ||
      !(Object.hasOwn(OPTION_ITEMS, c.item) || GEM_TIERS.some(tier => Object.keys(OPTION_ITEMS).some(kind => c.item === `${tier}:${kind}`))))) ||
    ((c.type === 'collectDrop' || c.type === 'loadTrolley') && (typeof c.dropId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(c.dropId))) ||
    (c.type === 'loadTrolleyBatch' && (!Array.isArray(c.dropIds) || c.dropIds.length < 1 || c.dropIds.length > 8 ||
      c.dropIds.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(id)) || new Set(c.dropIds).size !== c.dropIds.length))) throw new Error('INVALID_COMMAND');
  if (Object.keys(r).some(key => !['requestId', 'expectedRevision', 'command'].includes(key)) ||
    Object.keys(c).some(key => !(c.type === 'equipAxe' ? ['type', 'skin'] : c.type === 'equipOption' ? ['type', 'slot', 'item'] : c.type === 'fuse' || c.type === 'openGem' ? ['type', 'tier'] : c.type === 'hitBatch' ? ['type', 'count'] : c.type === 'collectDrop' || c.type === 'loadTrolley' ? ['type', 'dropId'] : c.type === 'loadTrolleyBatch' ? ['type', 'dropIds'] : ['type']).includes(key))) throw new Error('INVALID_COMMAND');
  return r;
}
// Test-only in-memory service, one account per instance. NOT a deployable backend.
// Production requires authenticated identity and a DB transaction for state + receipt + audit.
export function createMemoryGameService(initial: PlayerSnapshot, serverRandom: () => number) {
  let snapshot = structuredClone(initial);
  const receipts = new Map<string, { fingerprint: string; snapshot: PlayerSnapshot }>();
  return {
    load: () => structuredClone(snapshot),
    execute(input: unknown): PlayerSnapshot {
      const r = parseRequest(input);
      const fingerprint = JSON.stringify([r.expectedRevision, r.command.type,
        r.command.type === 'fuse' || r.command.type === 'openGem' ? r.command.tier :
          r.command.type === 'equipOption' ? [r.command.slot, r.command.item] : null]);
      const receipt = receipts.get(r.requestId);
      if (receipt) {
        if (receipt.fingerprint !== fingerprint) throw new Error('REQUEST_ID_REUSED');
        return structuredClone(receipt.snapshot);
      }
      if (r.expectedRevision !== snapshot.revision) throw new Error('REVISION_CONFLICT');
      if (!Number.isSafeInteger(snapshot.revision + 1)) throw new Error('REVISION_OVERFLOW');
      const current = snapshot.progress, c = r.command;
      if (!['fuse', 'drawGem', 'claimWardenReward', 'claimGrowthReward', 'openGem', 'equipOption'].includes(c.type)) throw new Error('ACTION_UNAVAILABLE');
      const next = c.type === 'fuse' ? fuseGems(current, c.tier, serverRandom)?.state
        : c.type === 'drawGem' ? drawWoodGem(current, serverRandom)?.state
          : c.type === 'claimGrowthReward' ? claimGrowthReward(current)
            : c.type === 'openGem' ? openGem(current, c.tier, serverRandom)?.state
              : c.type === 'equipOption' ? equip(current, c.slot, c.item) : claimWardenReward(current);
      if (!next || next === current) throw new Error('ACTION_UNAVAILABLE');
      snapshot = { ...snapshot, revision: snapshot.revision + 1, progress: next };
      receipts.set(r.requestId, { fingerprint, snapshot: structuredClone(snapshot) });
      return structuredClone(snapshot);
    },
  };
}
export function assertRankingEligible(snapshot: PlayerSnapshot) {
  // Only for records read from trusted server storage, never a client-submitted snapshot.
  if (snapshot.provenance !== 'server') throw new Error('TEST_PROGRESS_EXCLUDED');
}
