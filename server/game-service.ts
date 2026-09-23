import { claimWardenReward, drawWoodGem, fuseGems, GEM_TIERS } from '../src/game/progression.ts';
import type { CommandRequest, PlayerSnapshot } from '../src/shared/server-contract.ts';
export function parseRequest(value: unknown): CommandRequest {
  if (!value || typeof value !== 'object') throw new Error('INVALID_COMMAND');
  const r = value as CommandRequest;
  if (typeof r.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(r.requestId) ||
    !Number.isSafeInteger(r.expectedRevision) || r.expectedRevision < 0 || !r.command || typeof r.command !== 'object') throw new Error('INVALID_COMMAND');
  const c = r.command;
  if (!['acknowledgeWallet', 'claimFirstRecord', 'fuse', 'drawGem', 'claimWardenReward', 'hit', 'hitBatch', 'collectDrop', 'recover', 'regrow', 'upgradeTree', 'upgradeAxe', 'equipAxe'].includes(c.type) || (c.type === 'equipAxe' && !['default', 'firstRecord', 'pioneer', 'warden', 'recovery'].includes(c.skin)) || (c.type === 'hitBatch' && (!Number.isInteger(c.count) || c.count < 1 || c.count > 4)) || (c.type === 'fuse' && !GEM_TIERS.includes(c.tier)) ||
    (c.type === 'collectDrop' && (typeof c.dropId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(c.dropId)))) throw new Error('INVALID_COMMAND');
  if (Object.keys(r).some(key => !['requestId', 'expectedRevision', 'command'].includes(key)) ||
    Object.keys(c).some(key => !(c.type === 'equipAxe' ? ['type', 'skin'] : c.type === 'fuse' ? ['type', 'tier'] : c.type === 'hitBatch' ? ['type', 'count'] : c.type === 'collectDrop' ? ['type', 'dropId'] : ['type']).includes(key))) throw new Error('INVALID_COMMAND');
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
      const fingerprint = JSON.stringify([r.expectedRevision, r.command.type, r.command.type === 'fuse' ? r.command.tier : null]);
      const receipt = receipts.get(r.requestId);
      if (receipt) {
        if (receipt.fingerprint !== fingerprint) throw new Error('REQUEST_ID_REUSED');
        return structuredClone(receipt.snapshot);
      }
      if (r.expectedRevision !== snapshot.revision) throw new Error('REVISION_CONFLICT');
      if (!Number.isSafeInteger(snapshot.revision + 1)) throw new Error('REVISION_OVERFLOW');
      const current = snapshot.progress, c = r.command;
      if (!['fuse', 'drawGem', 'claimWardenReward'].includes(c.type)) throw new Error('ACTION_UNAVAILABLE');
      const next = c.type === 'fuse' ? fuseGems(current, c.tier, serverRandom)?.state
        : c.type === 'drawGem' ? drawWoodGem(current, serverRandom)?.state : claimWardenReward(current);
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
