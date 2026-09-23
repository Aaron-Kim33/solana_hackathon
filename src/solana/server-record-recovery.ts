import type { PlayerSnapshot } from '../shared/server-contract';

export type RecordIntent = { wallet: string; memo: string; signature: string | null; status: 'prepared' | 'pending' | 'confirmed' };
export type RecordResult = { status: 'none' | 'prepared' | 'pending' | 'confirmed' | 'failed'; snapshot?: PlayerSnapshot };
type Api = (path: string, payload?: unknown) => Promise<any>;

// No wallet/broadcast dependency: safe to run after login or on explicit status refresh.
export async function recoverServerRecord(api: Api, readLocal: (memo: string) => string | null): Promise<RecordResult> {
  const intent: RecordIntent | null = await api('/record');
  if (!intent) return { status: 'none' };
  if (intent.signature) return api('/record/check', {});
  const savedSignature = readLocal(intent.memo);
  if (!savedSignature) return { status: 'prepared' };
  await api('/record/submit', { signature: savedSignature });
  return api('/record/check', {});
}

export function recordRecoveryNotice(status: RecordResult['status'], ko: boolean): string {
  if (status === 'none' || status === 'prepared') return '';
  if (status === 'confirmed') return ko ? '서버가 첫 기록을 확인했어요. 퀘스트에서 보상과 다음 단계를 확인해 주세요.' : 'First Record verified. Check Quests for your reward and next step.';
  if (status === 'failed') return ko ? '기록 거래가 실패했어요. 보상은 지급되지 않았으며 다시 시도할 수 있어요.' : 'The record transaction failed. No reward was granted; you can try again.';
  return ko ? '이미 제출한 기록의 최종 확정 대기 중이에요. 기록 상태 확인은 거래를 다시 보내지 않아요.' : 'Your submitted record is awaiting finalization. Checking its status will not send another transaction.';
}
