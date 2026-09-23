const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

// RPC is fixed to Devnet; clients cannot choose a network or provide transaction contents.
export async function fetchRecordTransaction(signature) {
  const response = await fetch('https://api.devnet.solana.com', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(7000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction',
      params: [signature, { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 }] }),
  });
  if (!response.ok) throw new Error('RECORD_RPC_UNAVAILABLE');
  const body = await response.json();
  if (body.error || !Object.hasOwn(body, 'result')) throw new Error('RECORD_RPC_UNAVAILABLE');
  return body.result;
}

export function verifyRecordTransaction(transaction, intent) {
  if (transaction === null) return 'pending';
  const message = transaction?.transaction?.message;
  if (!transaction?.meta || transaction.transaction?.signatures?.[0] !== intent.signature ||
      message?.accountKeys?.[0]?.pubkey !== intent.wallet || message.accountKeys[0].signer !== true ||
      !message.instructions?.some(ix => ix.programId === MEMO_PROGRAM && ix.parsed === intent.memo)) {
    throw new Error('RECORD_MISMATCH');
  }
  return transaction.meta.err === null ? 'confirmed' : 'failed';
}
