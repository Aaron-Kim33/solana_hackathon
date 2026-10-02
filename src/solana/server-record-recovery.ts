import type { PlayerSnapshot } from '../shared/server-contract';

export type RecordIntent = { wallet: string; memo: string; signature: string | null; status: 'prepared' | 'pending' | 'confirmed' };
export type RecordResult = { status: 'none' | 'prepared' | 'pending' | 'confirmed' | 'failed'; snapshot?: PlayerSnapshot };
type Api = (path: string, payload?: unknown) => Promise<any>;

// No wallet/broadcast dependency: safe to run after login or on explicit status refresh.
export async function recoverServerRecord(api: Api, readLocal: (memo: string) => string | null, route = '/record'): Promise<RecordResult> {
  const intent: RecordIntent | null = await api(route);
  if (!intent) return { status: 'none' };
  if (intent.signature) return api(`${route}/check`, {});
  const savedSignature = readLocal(intent.memo);
  if (!savedSignature) return { status: 'prepared' };
  await api(`${route}/submit`, { signature: savedSignature });
  return api(`${route}/check`, {});
}

export function recordRecoveryNotice(status: RecordResult['status'], ko: boolean): string {
  if (status === 'none' || status === 'prepared') return '';
  if (status === 'confirmed') return ko ? '기념 기록을 확인했어요. 기록 여부와 관계없이 성장 보상은 무료예요.' : 'Commemorative record verified. Growth rewards are free with or without a record.';
  if (status === 'failed') return ko ? '기록 거래가 실패했어요. 성장 보상과 게임 진행에는 영향이 없어요.' : 'The record transaction failed. Your growth rewards and progression are unaffected.';
  return ko ? '이미 제출한 기록의 최종 확정 대기 중이에요. 기록 상태 확인은 거래를 다시 보내지 않아요.' : 'Your submitted record is awaiting finalization. Checking its status will not send another transaction.';
}
