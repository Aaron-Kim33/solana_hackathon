import { Buffer } from 'buffer';
import { clusterApiUrl, Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { APP_IDENTITY } from './wallet';

// A commemorative demo memo, not a server-verified score or token reward.
export async function recordHarvest(expectedAddress: string, onSubmitted: (signature: string) => void) {
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const submitted = await transact(async (wallet) => {
    const authorization = await wallet.authorize({ chain: 'solana:devnet', identity: APP_IDENTITY });
    const account = authorization.accounts.find((candidate) =>
      new PublicKey(Buffer.from(candidate.address, 'base64')).toBase58() === expectedAddress);
    if (!account) throw new Error('WALLET_ACCOUNT_CHANGED');
    const payer = new PublicKey(expectedAddress);
    const latest = await connection.getLatestBlockhash('confirmed');
    const transaction = new Transaction({ feePayer: payer, ...latest }).add(new TransactionInstruction({
      programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
      keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
      data: Buffer.from('Lumber Rush | First harvest | 20 wood | demo v1', 'utf8'),
    }));
    const signatures = await wallet.signAndSendTransactions({ transactions: [transaction] });
    if (!signatures[0]) throw new Error('SIGNATURE_MISSING');
    onSubmitted(signatures[0]);
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
