import type { Progress } from './progression.ts';

// A presentation-only override for local development. Never save or submit this object.
export function devQuestPreview(state: Progress, skipWallet: boolean): Progress {
  return skipWallet ? { ...state, walletCompleted: true } : state;
}
