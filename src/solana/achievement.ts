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

// An optional commemorative Memo, not a gameplay score, token purchase or NFT mint.
export async function recordHarvest(expectedAddress: string, onSubmitted: (signature: string) => void | Promise<void>, memo = 'Lumber Rush | First harvest | 20 wood | demo v1', options?: { approveFee: (lamports: number) => Promise<boolean> }) {
  const network = options ? 'mainnet-beta' : 'devnet';
  const connection = new Connection(clusterApiUrl(network), {
    commitment: 'confirmed', disableRetryOnRateLimit: true,
    fetch: async (url, init) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try { return await fetch(url, { ...init, signal: controller.signal }); }
      finally { clearTimeout(timer); }
    },
  });
  const payer = new PublicKey(expectedAddress);
  const makeTransaction = (latest: { blockhash: string; lastValidBlockHeight: number }) => new Transaction({ feePayer: payer, ...latest }).add(new TransactionInstruction({
    programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
    keys: [{ pubkey: payer, isSigner: true, isWritable: false }], data: Buffer.from(memo, 'utf8'),
  }));
  let approvedFee: number | undefined;
  if (options) {
    const quote = makeTransaction(await connection.getLatestBlockhash('confirmed'));
    const [fee, balance] = await Promise.all([connection.getFeeForMessage(quote.compileMessage(), 'confirmed'), connection.getBalance(payer, 'confirmed')]);
    requireRecordFee(balance, fee.value);
    if (!await options.approveFee(fee.value!)) throw new Error('USER_CANCELLED');
    approvedFee = fee.value!;
  }
  // Read-only check before opening the wallet; login never calls this fee check.
  const initialBalance = await connection.getBalance(payer, 'confirmed');
  requireRecordFee(initialBalance, 0);
  const submitted = await transact(async (wallet) => {
    const authorization = await wallet.authorize({ chain: options ? 'solana:mainnet' : 'solana:devnet', identity: APP_IDENTITY });
    const account = authorization.accounts.find((candidate) =>
      new PublicKey(Buffer.from(candidate.address, 'base64')).toBase58() === expectedAddress);
    if (!account) throw new Error('WALLET_ACCOUNT_CHANGED');
    const latest = await connection.getLatestBlockhash('confirmed');
    const transaction = makeTransaction(latest);
    const [fee, balance] = await Promise.all([
      connection.getFeeForMessage(transaction.compileMessage(), 'confirmed'),
      connection.getBalance(payer, 'confirmed'),
    ]);
    requireRecordFee(balance, fee.value);
    if (approvedFee !== undefined && fee.value !== approvedFee) throw new Error('RECORD_FEE_UNAVAILABLE');
    const signatures = await wallet.signAndSendTransactions({ transactions: [transaction] });
    if (!signatures[0]) throw new Error('SIGNATURE_MISSING');
    await onSubmitted(signatures[0]);
    return { signature: signatures[0], ...latest };
  });
  // Mainnet finalization is checked by the server. A slow RPC must not hold gameplay
  // behind a long client-side confirmation wait or trigger another broadcast.
  if (options) return { signature: submitted.signature, confirmed: false };
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
