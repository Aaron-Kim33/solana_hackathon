import { File, Paths } from 'expo-file-system';

// Separate from game saves. Persist before HTTP so a lost response never causes an automatic resend.
function fileFor(memo: string) {
  const id = memo.split(' | ').at(-1);
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) throw new Error('INVALID_RECORD_INTENT');
  return new File(Paths.document, `lumber-record-${id}.json`);
}
export function pendingServerRecord(memo: string): string | null {
  const file = fileFor(memo);
  if (!file.exists) return null;
  const value = JSON.parse(file.textSync());
  if (value.memo !== memo || typeof value.signature !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value.signature)) throw new Error('RECORD_SAVE_FAILED');
  return value.signature;
}
export function savePendingServerRecord(memo: string, signature: string) {
  fileFor(memo).write(JSON.stringify({ memo, signature }));
}
