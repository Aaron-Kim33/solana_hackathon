// A log is visible for five seconds. The server accepts an already-started
// collection request for one additional second of network transit time.
export const WOOD_DROP_VISIBLE_MS = 5000;
export const WOOD_DROP_GRACE_MS = 1000;
export const WOOD_DROP_ACCEPT_MS = WOOD_DROP_VISIBLE_MS + WOOD_DROP_GRACE_MS;

export const visibleDropExpiry = (serverExpiry: number) => serverExpiry - WOOD_DROP_GRACE_MS;
