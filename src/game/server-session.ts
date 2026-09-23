import * as SecureStore from 'expo-secure-store';
import { decodeServerSession, encodeServerSession } from './server-session-codec';

const KEY = 'lumberrush.server.session.v1';

export async function readServerSession(apiUrl: string) {
  return decodeServerSession(await SecureStore.getItemAsync(KEY), apiUrl);
}

export async function writeServerSession(apiUrl: string, token: string) {
  await SecureStore.setItemAsync(KEY, encodeServerSession(apiUrl, token));
}

export async function clearServerSession() {
  await SecureStore.deleteItemAsync(KEY);
}
