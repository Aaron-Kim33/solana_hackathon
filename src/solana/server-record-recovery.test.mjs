import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recoverServerRecord, recordRecoveryNotice } from './server-record-recovery.ts';

const intent = { wallet: 'wallet', memo: 'issued memo', signature: null, status: 'prepared' };
test('reconnect without a submitted record neither prepares nor signs a transaction', async () => {
  for (const record of [null, intent]) {
    const calls = [];
    const result = await recoverServerRecord(async path => { calls.push(path); return record; }, () => null);
    assert.equal(result.status, record ? 'prepared' : 'none');
    assert.deepEqual(calls, ['/record']);
  }
});

test('locally persisted signature is registered before checking; repeated recovery never resends', async () => {
  const calls = []; let serverSignature = null;
  const api = async (path, payload) => {
    calls.push([path, payload]);
    if (path === '/record') return { ...intent, signature: serverSignature };
    if (path === '/record/submit') { serverSignature = payload.signature; return {}; }
    if (path === '/record/check') return { status: 'pending' };
    throw new Error('Unexpected path');
  };
  assert.equal((await recoverServerRecord(api, () => 'saved_signature')).status, 'pending');
  assert.equal((await recoverServerRecord(api, () => { throw new Error('must not read stale file'); })).status, 'pending');
  assert.deepEqual(calls.map(c => c[0]), ['/record', '/record/submit', '/record/check', '/record', '/record/check']);
  assert.deepEqual(calls[1][1], { signature: 'saved_signature' });
});

test('recovery fails closed on corrupted receipt or lost submit response', async () => {
  const calls = [];
  const api = async path => { calls.push(path); if (path === '/record') return intent; throw new Error('NETWORK'); };
  await assert.rejects(recoverServerRecord(api, () => { throw new Error('INVALID_RECEIPT'); }), /INVALID_RECEIPT/);
  assert.deepEqual(calls, ['/record']);
  calls.length = 0;
  await assert.rejects(recoverServerRecord(api, () => 'signature'), /NETWORK/);
  assert.deepEqual(calls, ['/record', '/record/submit']);
});

test('confirmed server result wins over stale local state and has Korean/English feedback', async () => {
  const snapshot = { revision: 7 };
  const result = await recoverServerRecord(async path => path === '/record'
    ? { ...intent, signature: 'signature', status: 'confirmed' }
    : { status: 'confirmed', snapshot }, () => { throw new Error('must not read'); });
  assert.equal(result.snapshot, snapshot);
  for (const status of ['pending', 'confirmed', 'failed']) {
    assert.ok(recordRecoveryNotice(status, true));
    assert.ok(recordRecoveryNotice(status, false));
  }
});
