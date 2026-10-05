import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { generateKeyPairSync, sign } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { createApi } from './http-api.mjs';
// A shared :memory: path would create separate databases for store and auth.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('auth attempts have a separate cap and spoofed forwarded IPs cannot bypass it', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-http-limit-'));
  const server = createApi({ path: join(folder, 'test.sqlite'), origin: 'https://lumber-rush.example' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(folder, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (let attempt = 0; attempt < 31; attempt++) {
    const response = await fetch(base + '/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `192.0.2.${attempt}` },
      body: JSON.stringify({ challengeId: 'missing', signature: 'A'.repeat(88) }) });
    assert.equal(response.status, attempt < 30 ? 401 : 429);
    await response.json();
  }
  assert.equal((await fetch(base + '/health')).status, 200);
});
test('HTTP login, account retrieval, rejection, logout end to end', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-http-'));
  const server = createApi({ path: join(folder, 'test.sqlite'), origin: 'https://lumber-rush.example' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(folder, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, data, token) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data) });
  assert.equal((await fetch(base + '/me')).status, 401);
  assert.equal((await fetch(base + '/leaderboards/community')).status, 401);
  assert.equal((await fetch(base + '/leaderboards/world-boss')).status, 401);
  const pair = generateKeyPairSync('ed25519'), wallet = new PublicKey(pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)).toBase58();
  const c = await (await post('/auth/challenge', { wallet })).json();
  const signature = sign(null, Buffer.from(c.message), pair.privateKey).toString('base64');
  const session = await (await post('/auth/login', { challengeId: c.challengeId, signature })).json();
  assert.equal(typeof session.token, 'string');
  const me = await (await fetch(base + '/me', { headers: { Authorization: `Bearer ${session.token}` } })).json();
  assert.equal(me.progress.wood, 10);
  assert.equal(me.progress.harvested, 0);
  for (const category of ['community', 'world-boss']) {
    const ranked = await fetch(base + `/leaderboards/${category}`, { headers: { Authorization: `Bearer ${session.token}` } });
    assert.equal(ranked.status, 200);
    const ranking = await ranked.json();
    assert.equal(ranking.category, category); assert.deepEqual(ranking.entries, []); assert.equal(ranking.mine, null);
    assert.equal(ranking.eligible, true);
    assert.equal(ranked.headers.get('cache-control'), 'no-store');
  }
  assert.equal((await fetch(base + '/leaderboards/community?playerId=someone', { headers: { Authorization: `Bearer ${session.token}` } })).status, 404);
  assert.equal((await post('/auth/login', { challengeId: c.challengeId, signature })).status, 401);
  assert.equal((await post('/auth/challenge', { wallet, wood: 900 })).status, 400);
  assert.equal((await post('/auth/logout', {}, session.token)).status, 200);
  assert.equal((await fetch(base + '/me', { headers: { Authorization: `Bearer ${session.token}` } })).status, 401);
});
