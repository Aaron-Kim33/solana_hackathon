import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { generateKeyPairSync, sign } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { PublicKey } from '@solana/web3.js';
import { createApi } from './http-api.mjs';
import { openGameStore } from './sqlite-store.mjs';
import { verifyRecordTransaction } from './record-verifier.mjs';
import { initialProgress, questSteps, firstRecordBonusActive } from '../src/game/progression.ts';

const signature = '2'.repeat(88);
const tx = intent => ({ meta: { err: null }, transaction: { signatures: [intent.signature], message: {
  accountKeys: [{ pubkey: intent.wallet, signer: true }],
  instructions: [{ programId: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', parsed: intent.memo }],
} } });
const ready = () => ({ ...initialProgress('ko'), harvested: 20, axeLevel: 2, xp: 100, treeLevel: 2, treeHp: 400, walletCompleted: true });

test('record verifier rejects wrong signer, signature, memo/program and missing metadata', () => {
  const intent = { wallet: 'wallet', memo: 'unique memo', signature };
  assert.equal(verifyRecordTransaction(null, intent), 'pending');
  assert.equal(verifyRecordTransaction(tx(intent), intent), 'confirmed');
  for (const change of [
    t => { t.transaction.message.accountKeys[0].signer = false; },
    t => { t.transaction.message.accountKeys[0].pubkey = 'other'; },
    t => { t.transaction.signatures[0] = 'other'; },
    t => { t.transaction.message.instructions[0].parsed = 'old local demo'; },
    t => { t.transaction.message.instructions[0].programId = 'fake'; },
    t => { t.meta = null; },
  ]) { const invalid = tx(intent); change(invalid); assert.throws(() => verifyRecordTransaction(invalid, intent), /RECORD_MISMATCH/); }
  const failed = tx(intent); failed.meta.err = { InstructionError: [0, 'error'] };
  assert.equal(verifyRecordTransaction(failed, intent), 'failed');
});

test('record and reward survive restart, replay, failure and audit rollback', t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-record-')), path = join(folder, 'test.sqlite');
  let store = openGameStore(path);
  t.after(() => { store.close(); rmSync(folder, { recursive: true, force: true }); });
  store.createPlayer('alice'); store.createPlayer('bob');
  const db = new DatabaseSync(path);
  db.exec('CREATE TABLE wallet_links (wallet TEXT PRIMARY KEY, player_id TEXT UNIQUE)');
  db.prepare('INSERT INTO wallet_links VALUES (?,?)').run('wallet', 'alice');
  assert.throws(() => store.prepareRecord('alice'), /ACTION_UNAVAILABLE/);
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify(ready()), 'alice');
  const intent = store.prepareRecord('alice');
  assert.deepEqual(store.prepareRecord('alice'), intent);
  store.submitRecord('alice', signature);
  assert.throws(() => store.submitRecord('alice', '3'.repeat(88)), /RECORD_ALREADY_SUBMITTED/);
  assert.throws(() => store.execute('alice', { requestId: 'fake_record', expectedRevision: 0, command: { type: 'confirmRecord', signature } }), /INVALID_COMMAND/);
  db.exec("CREATE TRIGGER fail_record BEFORE INSERT ON economy_events BEGIN SELECT RAISE(ABORT, 'TEST_FAILURE'); END");
  assert.throws(() => store.finishRecord('alice', signature, 'confirmed'), /TEST_FAILURE/);
  assert.equal(store.load('alice').progress.receipt, null);
  db.exec('DROP TRIGGER fail_record'); db.close();
  const confirmed = store.finishRecord('alice', signature, 'confirmed');
  assert.equal(questSteps(confirmed.progress)[6], 'active');
  const request = { requestId: 'claim_record', expectedRevision: confirmed.revision, command: { type: 'claimFirstRecord' } };
  const claimed = store.execute('alice', request);
  store.close(); store = openGameStore(path);
  assert.deepEqual(store.execute('alice', request), claimed);
  assert.equal(store.finishRecord('alice', signature, 'confirmed').revision, claimed.revision);
  assert.equal(store.load('bob').progress.firstRecordClaimed, false);
  assert.equal(store.recordStatus('bob'), null);
  const equipped = store.execute('alice', { requestId: 'equip_record', expectedRevision: claimed.revision, command: { type: 'equipAxe', skin: 'firstRecord' } });
  assert.equal(firstRecordBonusActive(equipped.progress), true);
  assert.equal(questSteps(equipped.progress)[8], 'active');
  assert.equal(store.prepareRecord('alice').signature, signature);
});

test('authenticated HTTP record journey checks chain evidence, never client success flags', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-record-http-')), path = join(folder, 'test.sqlite');
  let transaction = null, rpcFailed = false;
  const options = { path, origin: 'https://lumber-rush.example', readRecordTransaction: async () => { if (rpcFailed) throw new Error('provider offline'); return transaction; } };
  let server = createApi(options);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(folder, { recursive: true, force: true }); });
  let base = `http://127.0.0.1:${server.address().port}`;
  let token;
  const post = (route, data) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data) });
  assert.equal((await post('/record/prepare', {})).status, 401);
  const pair = generateKeyPairSync('ed25519'), wallet = new PublicKey(pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)).toBase58();
  const c = await (await post('/auth/challenge', { wallet })).json();
  const session = await (await post('/auth/login', { challengeId: c.challengeId, signature: sign(null, Buffer.from(c.message), pair.privateKey).toString('base64') })).json();
  token = session.token;
  const getRecord = () => fetch(base + '/record', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(await (await getRecord()).json(), null);
  assert.equal((await (await post('/record/check', {})).json()).status, 'none');
  assert.equal(await (await getRecord()).json(), null);
  assert.equal((await post('/record/prepare', {})).status, 409);
  const db = new DatabaseSync(path);
  db.prepare('UPDATE players SET progress=? WHERE id=?').run(JSON.stringify({ ...ready(), walletCompleted: false }), session.playerId); db.close();
  const ack = await (await post('/commands', { requestId: 'wallet_ack', expectedRevision: 0, command: { type: 'acknowledgeWallet' } })).json();
  assert.equal(ack.progress.walletCompleted, true);
  const intent = await (await post('/record/prepare', {})).json();
  assert.equal(intent.wallet, wallet);
  assert.equal((await post('/record/submit', { signature, confirmed: true })).status, 400);
  assert.equal((await post('/record/submit', { signature })).status, 200);
  const pending = await (await post('/record/check', {})).json();
  assert.equal(pending.status, 'pending'); assert.equal(pending.snapshot.progress.receipt, null);
  // Reopen the actual HTTP service and DB while the transaction is still pending.
  await new Promise(resolve => server.close(resolve));
  server = createApi(options); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await (await getRecord()).json()).signature, signature);
  rpcFailed = true;
  const unavailable = await post('/record/check', {});
  assert.equal(unavailable.status, 503); assert.equal((await unavailable.json()).error, 'RECORD_RPC_UNAVAILABLE');
  assert.equal((await (await getRecord()).json()).status, 'pending');
  rpcFailed = false;
  assert.equal((await post('/commands', { requestId: 'early_claim', expectedRevision: ack.revision, command: { type: 'claimFirstRecord' } })).status, 409);
  transaction = tx({ ...intent, signature, wallet: 'wrong' });
  assert.equal((await post('/record/check', {})).status, 409);
  transaction = tx({ ...intent, signature }); transaction.meta.err = { InstructionError: [0, 'error'] };
  const failed = await (await post('/record/check', {})).json();
  assert.equal(failed.status, 'failed'); assert.equal(failed.snapshot.progress.firstRecordClaimed, false);
  const retryIntent = await (await post('/record/prepare', {})).json();
  assert.notEqual(retryIntent.memo, intent.memo);
  assert.equal((await post('/record/submit', { signature: '3'.repeat(88) })).status, 200);
  transaction = tx({ ...retryIntent, signature: '3'.repeat(88) });
  const confirmed = await (await post('/record/check', {})).json();
  assert.equal(confirmed.status, 'confirmed');
  const again = await (await post('/record/check', {})).json();
  assert.equal(again.snapshot.revision, confirmed.snapshot.revision);
  const claimed = await (await post('/commands', { requestId: 'claim_http', expectedRevision: confirmed.snapshot.revision, command: { type: 'claimFirstRecord' } })).json();
  assert.equal(claimed.progress.firstRecordClaimed, true);
});
