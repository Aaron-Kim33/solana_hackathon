import { File, Paths } from 'expo-file-system';
import { TUTORIAL_ALL_SEEN, TUTORIAL_LEGACY_ALL_SEEN } from './tutorial';

export type TutorialScope = 'local' | 'server';
const file = () => new File(Paths.document, 'lumber-rush-tutorial-v1.json');
const valid = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= TUTORIAL_ALL_SEEN;

export function loadTutorialSeen(scope: TutorialScope, existingProgress: boolean): number {
  try {
    const target = file();
    if (!target.exists) return existingProgress ? TUTORIAL_LEGACY_ALL_SEEN : 0;
    const saved = JSON.parse(target.textSync());
    return valid(saved?.[scope]) ? saved[scope] : existingProgress ? TUTORIAL_LEGACY_ALL_SEEN : 0;
  } catch { return existingProgress ? TUTORIAL_LEGACY_ALL_SEEN : 0; }
}

export function saveTutorialSeen(scope: TutorialScope, seen: number): void {
  const target = file();
  let saved: Partial<Record<TutorialScope, number>> = {};
  try {
    if (target.exists) {
      const previous = JSON.parse(target.textSync());
      saved = { ...(valid(previous?.local) ? { local: previous.local } : {}),
        ...(valid(previous?.server) ? { server: previous.server } : {}) };
    }
  } catch { /* A damaged hint file must never affect game progress. */ }
  target.write(JSON.stringify({ ...saved, [scope]: seen }));
}
