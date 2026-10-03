import type { GameCommand } from '../shared/server-contract';
import type { Progress } from './progression';
import { tutorialBit } from './tutorial.ts';

// Call only after a validated /commands response, never from queue acceptance or /me.
export function confirmedCollectionTutorial(command: GameCommand,
  before: Progress, after: Progress): number {
  if (command.type === 'collectDrop' && after.harvested > before.harvested) return tutorialBit('storage');
  if ((command.type === 'loadTrolley' || command.type === 'loadTrolleyBatch') && after.trolleyWood > before.trolleyWood)
    return tutorialBit('sweep');
  if (command.type === 'collectTrolley' && before.trolleyWood > 0 && !before.trolleyTrip && after.trolleyTrip)
    return tutorialBit('trolley');
  return 0;
}
