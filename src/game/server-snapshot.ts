import { parseProgress } from './progression.ts';
import type { PlayerSnapshot } from '../shared/server-contract';

// Older deployed APIs predate the trolley fields. Normalize only their missing
// empty trolley state; never invent rewards, drops, or a completed command.
export function parseServerSnapshot(value: unknown): PlayerSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_SERVER_SNAPSHOT');
  const snapshot = value as PlayerSnapshot;
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 ||
    !['server', 'local-test'].includes(snapshot.provenance) || !snapshot.progress) throw new Error('INVALID_SERVER_SNAPSHOT');
  try { return { ...snapshot, progress: parseProgress(JSON.stringify(snapshot.progress)) }; }
  catch { throw new Error('INVALID_SERVER_SNAPSHOT'); }
}
