import type { GameCommand } from '../shared/server-contract';
import { INPUT_QUEUE_LIMIT } from './live-input-queue.ts';

export type ServerInputState = { busy: boolean; queued: number; pending: GameCommand['type'] | null; dragging: boolean };
export function canLeaveServer(state: ServerInputState): boolean {
  return !state.busy && state.queued === 0 && state.pending === null && !state.dragging;
}
export function canQueueServerHit(state: ServerInputState): boolean {
  if (state.dragging || state.queued >= INPUT_QUEUE_LIMIT) return false;
  return state.busy ? state.pending !== null : state.pending === null;
}
