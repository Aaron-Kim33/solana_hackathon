import { File, Paths } from 'expo-file-system';

const file = () => new File(Paths.document, 'lumber-rush-dev-wallet-skip-v1.json');

export function loadDevWalletSkip(): boolean {
  try {
    const target = file();
    return target.exists && JSON.parse(target.textSync())?.skipWallet === true;
  } catch { return false; }
}

export function saveDevWalletSkip(enabled: boolean): void {
  file().write(JSON.stringify({ skipWallet: enabled }));
}
