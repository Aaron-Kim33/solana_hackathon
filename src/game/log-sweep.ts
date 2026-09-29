export type SweepPoint = { x: number; y: number };
export type SweepBox = { x: number; y: number; width: number; height: number };
export type GroundLog = { id: number; left: number; bottom: number; expiresAt: number };

export function fitTrolleyLogs<T extends { value: number }>(logs: T[], space: number): T[] {
  const selected: T[] = [];
  let remaining = Math.max(0, space);
  for (const log of logs) {
    if (log.value <= 0 || log.value > remaining) continue;
    selected.push(log);
    remaining -= log.value;
  }
  return selected;
}

// A finger can move farther than a log's width between touch events. Test the
// entire path segment against an expanded ground-log hitbox, not only endpoints.
export function sweptLogIds(logs: GroundLog[], forest: SweepBox, from: SweepPoint, to: SweepPoint, now: number): number[] {
  const hits: number[] = [];
  for (const log of logs) {
    if (log.expiresAt <= now) continue;
    const x = forest.x + forest.width * log.left / 100;
    const y = forest.y + forest.height - log.bottom - 58;
    const minX = x - 13, maxX = x + 62 + 13;
    const minY = y - 13, maxY = y + 58 + 13;
    const dx = to.x - from.x, dy = to.y - from.y;
    let entry = 0, exit = 1;
    for (const [p, q] of [[-dx, from.x - minX], [dx, maxX - from.x], [-dy, from.y - minY], [dy, maxY - from.y]]) {
      if (p === 0) { if (q < 0) { entry = 2; break; } }
      else {
        const boundary = q / p;
        if (p < 0) entry = Math.max(entry, boundary);
        else exit = Math.min(exit, boundary);
      }
    }
    if (entry <= exit) hits.push(log.id);
  }
  return hits;
}
