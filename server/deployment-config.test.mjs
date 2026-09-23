import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { serverConfig } from './deployment-config.mjs';
import { createApi } from './http-api.mjs';
test('server defaults bind loopback regardless of generic platform PORT', () => {
  const config = serverConfig({ PORT: '80' });
  assert.equal(config.host, '127.0.0.1'); assert.equal(config.port, 8787);
});
test('public preview requires explicit opt-in, persistent path and HTTPS identity', () => {
  assert.throws(() => serverConfig({ LUMBER_SERVER_MODE: 'preview' }));
  const env = { LUMBER_SERVER_MODE: 'preview', LUMBER_ALLOW_PUBLIC_BIND: 'true', LUMBER_DB_PATH: 'server/test.sqlite', LUMBER_IDENTITY_ORIGIN: 'https://game.example.com', PORT: '9000' };
  assert.equal(serverConfig(env).host, '0.0.0.0'); assert.equal(serverConfig(env).port, 9000);
  assert.throws(() => serverConfig({ ...env, LUMBER_DB_PATH: '' }));
  assert.throws(() => serverConfig({ ...env, PORT: 'NaN' }));
  assert.throws(() => serverConfig({ ...env, LUMBER_IDENTITY_ORIGIN: 'http://game.example.com' }));
});
test('Railway preview refuses an ephemeral or outside-volume SQLite database', () => {
  const mount = resolve('preview-volume');
  const env = { LUMBER_SERVER_MODE: 'preview', LUMBER_ALLOW_PUBLIC_BIND: 'true', LUMBER_DB_PATH: resolve(mount, 'game.sqlite'), LUMBER_IDENTITY_ORIGIN: 'https://game.example.com', RAILWAY_PROJECT_ID: 'project-id' };
  assert.throws(() => serverConfig(env), { message: 'RAILWAY_VOLUME_REQUIRED' });
  assert.equal(serverConfig({ ...env, RAILWAY_VOLUME_MOUNT_PATH: mount }).path, env.LUMBER_DB_PATH);
  assert.throws(() => serverConfig({ ...env, RAILWAY_VOLUME_MOUNT_PATH: mount, LUMBER_DB_PATH: resolve('server', 'game.sqlite') }), { message: 'RAILWAY_DB_OUTSIDE_VOLUME' });
});
test('preview health identifies a preview server rather than a local-development process', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-preview-health-'));
  const server = createApi({ path: join(folder, 'test.sqlite'), origin: 'https://game.example.com', mode: 'preview' });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(folder, { recursive: true, force: true }); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const result = await fetch(`http://127.0.0.1:${server.address().port}/health`);
  assert.deepEqual(await result.json(), { status: 'ok', mode: 'preview', identityOrigin: 'https://game.example.com' });
});
