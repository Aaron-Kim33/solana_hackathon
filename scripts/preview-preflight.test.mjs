import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPreviewEndpoints } from './preview-preflight.mjs';

const config = { apiUrl: 'https://api.lumberrush.com', identityOrigin: 'https://lumberrush.com' };
const icon = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2]);
function fetcher({ mode = 'preview', identityOrigin = config.identityOrigin, status = 200, iconType = 'image/png', bytes = icon } = {}) {
  return async (url, options) => {
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    return url.endsWith('/health')
      ? new Response(JSON.stringify({ status: 'ok', mode, identityOrigin }), { status, headers: { 'content-type': 'application/json' } })
      : new Response(bytes, { headers: { 'content-type': iconType } });
  };
}
test('external preflight reads preview health and PNG identity icon only', async () => {
  const urls = [];
  const probe = fetcher();
  const result = await checkPreviewEndpoints(config, (url, options) => { urls.push(url); return probe(url, options); });
  assert.deepEqual(result, config);
  assert.deepEqual(urls, [`${config.apiUrl}/health`, `${config.identityOrigin}/icon.png`]);
});
test('external preflight rejects local API, unavailable endpoint and invalid identity icon', async () => {
  await assert.rejects(checkPreviewEndpoints(config, fetcher({ mode: 'local-development' })), /PREVIEW_API_MODE_MISMATCH/);
  await assert.rejects(checkPreviewEndpoints(config, fetcher({ identityOrigin: 'https://other.example.com' })), /PREVIEW_IDENTITY_MISMATCH/);
  await assert.rejects(checkPreviewEndpoints(config, fetcher({ status: 503 })), /PREVIEW_ENDPOINT_FAILED/);
  await assert.rejects(checkPreviewEndpoints(config, fetcher({ iconType: 'text/html' })), /PREVIEW_ICON_NOT_PNG/);
  await assert.rejects(checkPreviewEndpoints(config, fetcher({ bytes: Buffer.from('<html>') })), /PREVIEW_ICON_INVALID/);
});
