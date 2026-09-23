export type Deployment = { mode: 'local' | 'server-preview'; apiUrl: string; identityOrigin: string; serverEnabled: boolean };
export function httpsOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !/^[a-z0-9.-]+$/i.test(url.hostname) || !url.hostname.includes('.') ||
      /(^127\.|^0\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) ||
      /(^localhost$|\.localhost$|\.local$|\.example$|\.invalid$|\.test$)/i.test(url.hostname)) {
    throw new Error('HTTPS_ORIGIN_REQUIRED');
  }
  return url.origin;
}
export function deploymentConfig(input: { mode?: string; apiUrl?: string; identityOrigin?: string }, development: boolean): Deployment {
  const mode = input.mode || 'local';
  if (mode === 'local') return { mode, apiUrl: 'http://127.0.0.1:8787', identityOrigin: 'https://lumber-rush.example', serverEnabled: development };
  if (mode !== 'server-preview') throw new Error('INVALID_APP_MODE');
  if (!input.apiUrl || !input.identityOrigin) throw new Error('PREVIEW_CONFIG_REQUIRED');
  return { mode, apiUrl: httpsOrigin(input.apiUrl), identityOrigin: httpsOrigin(input.identityOrigin), serverEnabled: true };
}
