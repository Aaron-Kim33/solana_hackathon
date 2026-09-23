// Loopback-only smoke load; never touches local-dev.sqlite or real wallets.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { PublicKey } from '@solana/web3.js';
import { createApi } from './http-api.mjs';

const folder = mkdtempSync(join(tmpdir(), 'lumber-load-'));
const path = join(folder, 'test.sqlite');
let server;
let base;
const latencies = [];
let bytes = 0;
async function start() {
  server = createApi({ path, origin: 'https://lumber-rush.example' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
}
async function stop() { await new Promise(resolve => server.close(resolve)); }
async function request(route, data, token, expected = 200) {
  const began = performance.now();
  const response = await fetch(base + route, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  if (route === '/commands') { latencies.push(performance.now() - began); bytes += Buffer.byteLength(text); }
  assert.equal(response.status, expected, text);
  return JSON.parse(text);
}
try {
  await start();
  const clients = await Promise.all(Array.from({ length: 20 }, async () => {
    const pair = generateKeyPairSync('ed25519');
    const wallet = new PublicKey(pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)).toBase58();
    const challenge = await request('/auth/challenge', { wallet });
    const session = await request('/auth/login', { challengeId: challenge.challengeId, signature: sign(null, Buffer.from(challenge.message), pair.privateKey).toString('base64') });
    return { token: session.token, state: await request('/me', undefined, session.token) };
  }));
  const cpu = process.cpuUsage(), began = performance.now();
  await Promise.all(clients.map(async (client, index) => {
    for (let batch = 0; batch < 20; batch++) {
      await delay(630);
      const command = { requestId: `load_${index}_${batch}`, expectedRevision: client.state.revision, command: { type: 'hitBatch', count: 4 } };
      client.state = await request('/commands', command, client.token);
      client.last = command;
    }
    assert.equal(client.state.revision, 20);
    assert.equal(client.state.progress.totalHits, 80);
    // The first character level-up at 50 XP resets fatigue.
    assert.equal(client.state.progress.fatigue, 30);
  }));
  const elapsedMs = performance.now() - began, used = process.cpuUsage(cpu);
  latencies.sort((a, b) => a - b);
  const metrics = { users: 20, hits: 1600, batches: 400, elapsedMs: Math.round(elapsedMs), p50Ms: +latencies[199].toFixed(2), p95Ms: +latencies[379].toFixed(2), responseBytes: bytes, processCpuMs: Math.round((used.user + used.system) / 1000), processRssMB: Math.round(process.memoryUsage().rss / 1048576) };
  // Reopen the same disposable database: sessions, progress and receipts survive.
  await stop(); await start();
  for (const client of clients) {
    const state = await request('/me', undefined, client.token);
    assert.equal(state.revision, 20);
    assert.deepEqual(state.progress, client.state.progress);
    assert.deepEqual(await request('/commands', client.last, client.token), client.state);
  }
  // A player's quota cannot exhaust another player's quota, even on one IP.
  for (let i = 0; i < 598; i++) await request('/me', undefined, clients[0].token);
  await request('/me', undefined, clients[0].token, 429);
  await request('/me', undefined, clients[1].token);
  await stop(); server = null;
  metrics.databaseBytes = statSync(path).size;
  console.log(JSON.stringify({ ...metrics, restartAndRetry: 'passed', accountRateIsolation: 'passed', failures: 0 }, null, 2));
} finally {
  if (server?.listening) await stop();
  // folder is exactly the private mkdtemp directory created above.
  rmSync(folder, { recursive: true, force: true });
}
