import type { Progress } from './progression';

export const AUTO_PICKUP_LEVEL = 50;
export const AUTO_PICKUP_MS = 30 * 60 * 1000;
export const autoPickupUnlocked = (state: Progress) => state.treeLevel >= AUTO_PICKUP_LEVEL && (state.bosses?.first ?? true);
const DAY_MS = 24 * 60 * 60 * 1000;
export function autoPickupRemaining(state: Progress, now: number) {
  const start = state.autoPickupTrial?.startedAt;
  return start === undefined || now < start ? 0 : Math.max(0, start + AUTO_PICKUP_MS - now);
}
export function autoPickupAvailable(state: Progress, now: number) {
  const start = state.autoPickupTrial?.startedAt;
  return Number.isSafeInteger(now) && now >= 0 && autoPickupUnlocked(state) &&
    autoPickupRemaining(state, now) === 0 &&
    (start === undefined || Math.floor(now / DAY_MS) > Math.floor(start / DAY_MS));
}
export function startAutoPickup(state: Progress, now: number): Progress {
  if (!autoPickupAvailable(state, now) || state.fatigue >= 100) return state;
  return { ...state, autoPickupTrial: { startedAt: now } };
}
