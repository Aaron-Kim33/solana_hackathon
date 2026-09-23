import { Buffer } from 'buffer';
import { clusterApiUrl, Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { APP_IDENTITY } from './wallet';
import { requireRecordFee } from './record-errors';

export async function checkHarvest(signature: string): Promise<'pending' | 'confirmed' | 'failed'> {
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const result = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
  const status = result.value[0];
  if (status?.err) return 'failed';
  return status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized' ? 'confirmed' : 'pending';
}

// A commemorative demo memo, not a server-verified score or token reward.
export async function recordHarvest(expectedAddress: string, onSubmitted: (signature: string) => void | Promise<void>, memo = 'Lumber Rush | First harvest | 20 wood | demo v1') {
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const payer = new PublicKey(expectedAddress);
  // Read-only check before opening the wallet: unfunded test wallets cannot pay even the base fee.
  const initialBalance = await connection.getBalance(payer, 'confirmed');
  requireRecordFee(initialBalance, 0);
  const submitted = await transact(async (wallet) => {
    const authorization = await wallet.authorize({ chain: 'solana:devnet', identity: APP_IDENTITY });
    const account = authorization.accounts.find((candidate) =>
      new PublicKey(Buffer.from(candidate.address, 'base64')).toBase58() === expectedAddress);
    if (!account) throw new Error('WALLET_ACCOUNT_CHANGED');
    const latest = await connection.getLatestBlockhash('confirmed');
    const transaction = new Transaction({ feePayer: payer, ...latest }).add(new TransactionInstruction({
      programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
      keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
      data: Buffer.from(memo, 'utf8'),
    }));
    const [fee, balance] = await Promise.all([
      connection.getFeeForMessage(transaction.compileMessage(), 'confirmed'),
      connection.getBalance(payer, 'confirmed'),
    ]);
    requireRecordFee(balance, fee.value);
    const signatures = await wallet.signAndSendTransactions({ transactions: [transaction] });
    if (!signatures[0]) throw new Error('SIGNATURE_MISSING');
    await onSubmitted(signatures[0]);
    return { signature: signatures[0], ...latest };
  });
  // Keep the signature even when RPC confirmation is unavailable; do not silently resend.
  try {
    const confirmation = await connection.confirmTransaction(submitted, 'confirmed');
    if (confirmation.value.err) throw new Error('TRANSACTION_FAILED');
    return { signature: submitted.signature, confirmed: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'TRANSACTION_FAILED') throw error;
    return { signature: submitted.signature, confirmed: false };
  }
}
