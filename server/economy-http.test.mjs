import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PublicKey } from '@solana/web3.js';
import { createApi } from './http-api.mjs';
import { initialProgress, parseProgress, treeHealth, xpFloor } from '../src/game/progression.ts';

test('authenticated HTTP economy commands survive restart without duplicate rewards or spending', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-economy-http-'));
  const path = join(folder, 'test.sqlite');
  const options = { path, origin: 'https://lumber-rush.example' };
  let server = createApi(options);
  const listen = async () => {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return `http://127.0.0.1:${server.address().port}`;
  };
  let base = await listen();
  t.after(async () => {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    rmSync(folder, { recursive: true, force: true });
  });
  let token;
  const post = (route, data) => fetch(base + route, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data) });
  const me = () => fetch(base + '/me', { headers: { Authorization: `Bearer ${token}` } });
  const pair = generateKeyPairSync('ed25519');
  const wallet = new PublicKey(pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)).toBase58();
  const challenge = await (await post('/auth/challenge', { wallet })).json();
  const session = await (await post('/auth/login', { challengeId: challenge.challengeId,
    signature: sign(null, Buffer.from(challenge.message), pair.privateKey).toString('base64') })).json();
  token = session.token;
  assert.equal(typeof token, 'string');

  // Fixture-only setup: public commands cannot seed wallets, levels, wood or gems.
  const db = new DatabaseSync(path);
  const start = { ...initialProgress('ko'), treeLevel: 50, treeHp: treeHealth(50), axeLevel: 20,
    xp: xpFloor(10), harvested: 20000, wood: 10000, walletCompleted: true,
    receipt: { address: wallet, signature: 'test', status: 'confirmed' },
    firstRecordClaimed: true, skinQuestHarvestStart: 19900, growthRewardClaimed: true,
    rewardOption: 'low:damage', gemSlotQuestDone: true,
    slots: ['low:damage', 'low:damage'], gems: { low: 6, medium: 0, high: 0, supreme: 0, legendary: 0 } };
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify(start), session.playerId);
  db.close();
  assert.equal(parseProgress(JSON.stringify(start)).treeLevel, 50);

  token = null;
  const claim = { requestId: 'http_adventure_01', expectedRevision: 0, command: { type: 'claimAdventure', stage: 0 } };
  assert.equal((await post('/commands', claim)).status, 401);
  token = session.token;
  const claimResponse = await post('/commands', claim);
  assert.equal(claimResponse.status, 200, await claimResponse.clone().text());
  const claimed = await claimResponse.json();
  assert.equal(claimed.revision, 1);
  assert.equal(claimed.progress.adventureClaimed, 1);
  assert.equal(claimed.progress.gems.low, 7);
  assert.deepEqual(await (await post('/commands', claim)).json(), claimed);
  assert.equal((await post('/commands', { ...claim, command: { type: 'drawGem' } })).status, 409);
  assert.equal((await post('/commands', { ...claim, requestId: 'stale_adventure_01' })).status, 409);

  const draw = { requestId: 'http_draw_01', expectedRevision: 1, command: { type: 'drawGem' } };
  const drawn = await (await post('/commands', draw)).json();
  assert.equal(drawn.revision, 2);
  assert.equal(drawn.progress.wood, 0);
  assert.equal(Object.values(drawn.progress.gems).reduce((sum, count) => sum + count, 0), 8);
  const fuse = { requestId: 'http_fuse_01', expectedRevision: 2, command: { type: 'fuse', tier: 'low' } };
  const fused = await (await post('/commands', fuse)).json();
  assert.equal(fused.revision, 3);
  assert.equal(fused.progress.gems.low, drawn.progress.gems.low - 3);
  assert.ok(fused.progress.gems.medium === drawn.progress.gems.medium ||
    fused.progress.gems.medium === drawn.progress.gems.medium + 1);
  const current = await (await me()).json();
  assert.equal(current.revision, fused.revision);
  assert.deepEqual(current.progress, fused.progress);

  await new Promise(resolve => server.close(resolve));
  server = createApi(options);
  base = await listen();
  assert.deepEqual(await (await post('/commands', claim)).json(), claimed);
  assert.deepEqual(await (await post('/commands', draw)).json(), drawn);
  assert.deepEqual(await (await post('/commands', fuse)).json(), fused);
  const restored = await (await me()).json();
  assert.equal(restored.revision, 3);
  assert.deepEqual(restored.progress, fused.progress);
  const audit = new DatabaseSync(path);
  assert.equal(audit.prepare('SELECT count(*) AS total FROM economy_events WHERE player_id=?').get(session.playerId).total, 3);
  audit.close();
});
