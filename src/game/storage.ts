import { File, Paths } from 'expo-file-system';
import { initialProgress, parseProgress, type Progress } from './progression';

let sequence = 0;
const slot = (index: number) => new File(Paths.document, `lumber-rush-save-${index}.json`);
export function loadProgress(language: 'ko' | 'en'): Progress {
  const candidates: { sequence: number; state: Progress }[] = [];
  let existed = false;
  for (let index = 0; index < 2; index++) {
    const file = slot(index);
    if (!file.exists) continue;
    existed = true;
    try {
      const data = JSON.parse(file.textSync());
      if (!Number.isSafeInteger(data.sequence) || data.sequence < 0) continue;
      candidates.push({ sequence: data.sequence, state: parseProgress(JSON.stringify(data.state)) });
    } catch { /* The other slot remains a recoverable previous save. */ }
  }
  candidates.sort((a, b) => b.sequence - a.sequence);
  if (candidates[0]) {
    sequence = candidates[0].sequence;
    return candidates[0].state;
  }
  if (existed) throw new Error('INVALID_SAVE');
  return initialProgress(language);
}
export function saveProgress(state: Progress) {
  const next = sequence + 1;
  slot(next % 2).write(JSON.stringify({ sequence: next, state }));
  sequence = next;
}
