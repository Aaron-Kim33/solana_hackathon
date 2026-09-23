import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PublicKey } from '@solana/web3.js';
import { DatabaseSync } from 'node:sqlite';
import { openGameStore } from './sqlite-store.mjs';
import { openAuthService, authenticatedGame } from './auth-service.mjs';
const keypair = () => { const pair = generateKeyPairSync('ed25519'); return { ...pair, address: new PublicKey(pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)).toBase58() }; };
const signed = (challenge, pair) => sign(null, Buffer.from(challenge.message), pair.privateKey).toString('base64');
function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'lumber-auth-test-')), path = join(folder, 'test.sqlite');
  const store = openGameStore(path), services = [];
  let time = 1_000_000;
  const open = (origin = 'https://lumber.example') => { const auth = openAuthService(path, { origin, now: () => time }); services.push(auth); return auth; };
  t.after(() => { for (const a of services) { try { a.close(); } catch {} } store.close(); rmSync(folder, { recursive: true, force: true }); });
  return { store, open, path, advance: ms => { time += ms; } };
}
test('signed login persists across reopening and replay is blocked', t => {
  const f = fixture(t), auth = f.open(), pair = keypair(), challenge = auth.challenge(pair.address);
  const session = auth.login(challenge.challengeId, signed(challenge, pair));
  assert.equal(auth.authenticate(session.token), session.playerId);
  assert.throws(() => auth.login(challenge.challengeId, signed(challenge, pair)), /CHALLENGE_UNAVAILABLE/);
  auth.close(); const reopened = f.open();
  assert.equal(reopened.authenticate(session.token), session.playerId);
  const next = reopened.challenge(pair.address);
  assert.equal(reopened.login(next.challengeId, signed(next, pair)).playerId, session.playerId);
  const db = new DatabaseSync(f.path);
  assert.equal(db.prepare('SELECT count(*) AS n FROM auth_sessions WHERE token_hash = ?').get(session.token).n, 0); db.close();
});
test('wrong wallet, altered message, wrong origin and expired challenge fail', t => {
  const f = fixture(t), auth = f.open(), pair = keypair(), c = auth.challenge(pair.address);
  assert.throws(() => auth.login(c.challengeId, signed(c, keypair())), /INVALID_SIGNATURE/);
  assert.throws(() => auth.login(c.challengeId, signed({ ...c, message: c.message + 'x' }, pair)), /INVALID_SIGNATURE/);
  assert.throws(() => f.open('https://other.example').login(c.challengeId, signed(c, pair)), /CHALLENGE_UNAVAILABLE/);
  f.advance(300000);
  assert.throws(() => auth.login(c.challengeId, signed(c, pair)), /CHALLENGE_UNAVAILABLE/);
});
test('sessions isolate accounts, expire and revoke access on logout', t => {
  const f = fixture(t), auth = f.open(), game = authenticatedGame(auth, f.store);
  const login = () => { const p = keypair(), c = auth.challenge(p.address); return auth.login(c.challengeId, signed(c, p)); };
  const a = login(), b = login(); assert.notEqual(a.playerId, b.playerId);
  assert.equal(game.load(a.token).revision, 0);
  assert.throws(() => game.load('invalid'), /UNAUTHENTICATED/);
  auth.logout(a.token);
  assert.throws(() => game.load(a.token), /UNAUTHENTICATED/);
  assert.equal(auth.authenticate(b.token), b.playerId);
  f.advance(86400000);
  assert.throws(() => auth.authenticate(b.token), /UNAUTHENTICATED/);
});
