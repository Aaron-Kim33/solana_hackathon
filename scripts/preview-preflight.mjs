const PNG_HEADER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

async function checkedFetch(url, fetcher) {
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`PREVIEW_ENDPOINT_FAILED: ${url} (${response.status})`);
  return response;
}

// Read-only preflight. Never sends a wallet signature, token, or game command.
export async function checkPreviewEndpoints(config, fetcher = fetch) {
  const healthUrl = `${config.apiUrl}/health`;
  const healthResponse = await checkedFetch(healthUrl, fetcher);
  if (!healthResponse.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    throw new Error('PREVIEW_HEALTH_NOT_JSON');
  let health;
  try { health = await healthResponse.json(); } catch { throw new Error('PREVIEW_HEALTH_INVALID'); }
  if (health?.status !== 'ok' || health.mode !== 'preview') throw new Error('PREVIEW_API_MODE_MISMATCH');
  if (health.identityOrigin !== config.identityOrigin) throw new Error('PREVIEW_IDENTITY_MISMATCH');

  const iconUrl = `${config.identityOrigin}/icon.png`;
  const iconResponse = await checkedFetch(iconUrl, fetcher);
  if (iconResponse.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'image/png')
    throw new Error('PREVIEW_ICON_NOT_PNG');
  const icon = Buffer.from(await iconResponse.arrayBuffer());
  if (icon.length < PNG_HEADER.length || icon.length > 2 * 1024 * 1024 || !icon.subarray(0, PNG_HEADER.length).equals(PNG_HEADER))
    throw new Error('PREVIEW_ICON_INVALID');
  return { apiUrl: config.apiUrl, identityOrigin: config.identityOrigin };
}
