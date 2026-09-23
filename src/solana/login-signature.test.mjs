import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { extractLoginSignature } from './login-signature.ts';
test('detached, message-first and signature-first layouts preserve verifiable signature', () => {
  const pair = generateKeyPairSync('ed25519'), message = Buffer.from('로그인 · Lumber Rush test challenge');
  const signature = sign(null, message, pair.privateKey);
  for (const bytes of [signature, Buffer.concat([message, signature]), Buffer.concat([signature, message])]) {
    const extracted = extractLoginSignature(bytes, message);
    assert.equal(verify(null, message, pair.publicKey, extracted), true);
    assert.equal(verify(null, Buffer.from('different challenge'), pair.publicKey, extracted), false);
  }
});
test('unknown or changed message layouts fail closed', () => {
  const message = Buffer.from('expected'), signature = new Uint8Array(64);
  for (const value of [undefined, 'text', new Uint8Array(63), new Uint8Array(65), Buffer.concat([Buffer.from('modified'), signature])]) {
    assert.throws(() => extractLoginSignature(value, message), /INVALID_SIGNED_MESSAGE/);
  }
});
