import type { GameCommand } from '../shared/server-contract';

export const INPUT_QUEUE_LIMIT = 12;
type Entry = { command: GameCommand; at: number };
// Only unsent input lives here. Uncertain requests keep their original ID elsewhere.
export function createLiveInputQueue() {
  const entries: Entry[] = [];
  return {
    get size() { return entries.length; },
    hasType(type: GameCommand['type']) { return entries.some(entry => entry.command.type === type); },
    clear() { entries.length = 0; },
    push(command: GameCommand, now: number): boolean {
      if (command.type === 'collectDrop' && entries.some(e => e.command.type === 'collectDrop' && e.command.dropId === command.dropId)) return true;
      if (entries.length >= INPUT_QUEUE_LIMIT) return false;
      entries.push({ command, at: now }); return true;
    },
    take(now: number, readyAt: number): { command?: GameCommand; wait: number; expired: number } {
      let expired = 0;
      while (entries.length && (now - entries[0].at >= 2000 || now < entries[0].at)) { entries.shift(); expired++; }
      if (!entries.length) return { wait: 0, expired };
      if (now < readyAt) return { wait: readyAt - now, expired };
      const first = entries.shift()!;
      if (first.command.type !== 'hit') return { command: first.command, wait: 0, expired };
      // Never wait to fill a batch. Merge only already queued taps within the server time budget.
      const capacity = Math.min(4, 1 + Math.floor((now - readyAt) / 150));
      let count = 1;
      while (count < capacity && entries[0]?.command.type === 'hit') { entries.shift(); count++; }
      return { command: { type: 'hitBatch', count }, wait: 0, expired };
    },
  };
}
