import { Buffer } from 'buffer';
import { PublicKey } from '@solana/web3.js';
import { deployment } from '../deployment';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

export const APP_IDENTITY = {
  name: 'Lumber Rush',
  // Reserved development domain. Replace with the published landing-page domain before release.
  uri: deployment.config?.identityOrigin ?? 'https://lumber-rush.example',
  icon: 'icon.png',
};

export type ConnectedWallet = {
  authToken: string;
  publicKey: string;
  shortAddress: string;
  walletUriBase?: string;
};

function toBase58Address(base64Address: string) {
  return new PublicKey(Buffer.from(base64Address, 'base64')).toBase58();
}

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export async function connectWallet(): Promise<ConnectedWallet> {
  return transact(async (wallet: Web3MobileWallet) => {
    const authorization = await wallet.authorize({
      chain: 'solana:devnet',
      identity: APP_IDENTITY,
    });

    const account = authorization.accounts[0];
    if (!account) {
      throw new Error('WALLET_ACCOUNT_MISSING');
    }

    const publicKey = toBase58Address(account.address);
    return {
      authToken: authorization.auth_token,
      publicKey,
      shortAddress: shortenAddress(publicKey),
      walletUriBase: authorization.wallet_uri_base,
    };
  });
}
