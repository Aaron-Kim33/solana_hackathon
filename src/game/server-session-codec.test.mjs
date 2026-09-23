import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeServerSession, encodeServerSession } from './server-session-codec.ts';

const api = 'http://127.0.0.1:8787';
const token = 'a'.repeat(43);

test('device session is scoped to the configured API and rejects malformed tokens', () => {
  const saved = encodeServerSession(api, token);
  assert.equal(decodeServerSession(saved, api), token);
  assert.equal(decodeServerSession(saved, 'https://api.example.org'), null);
  assert.equal(decodeServerSession('{', api), null);
  assert.equal(decodeServerSession(JSON.stringify({ apiUrl: api, token: 'bad' }), api), null);
  assert.equal(decodeServerSession(null, api), null);
  assert.throws(() => encodeServerSession(api, 'bad'), /INVALID_SESSION/);
});
