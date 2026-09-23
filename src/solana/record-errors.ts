export function requireRecordFee(balance: number, fee: number | null) {
  if (!Number.isFinite(balance) || balance < 0 || fee === null || !Number.isFinite(fee) || fee < 0) {
    throw new Error('RECORD_FEE_UNAVAILABLE');
  }
  if (balance < fee || balance === 0) throw new Error('RECORD_INSUFFICIENT_SOL');
}

// Only map known errors; never display arbitrary wallet payloads/auth tokens.
export function recordErrorKey(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'RECORD_INSUFFICIENT_SOL') return 'recordNoSol';
  if (message === 'RECORD_FEE_UNAVAILABLE') return 'recordFeeUnavailable';
  if (message === 'RECORD_SAVE_FAILED') return 'saveError';
  if (message === 'WALLET_ACCOUNT_CHANGED') return 'recordAccountChanged';
  return 'recordError';
}
