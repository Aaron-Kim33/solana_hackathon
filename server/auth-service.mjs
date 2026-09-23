import { DatabaseSync } from 'node:sqlite';
import { createHash, createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { initialProgress } from '../src/game/progression.ts';

const CHALLENGE_MS = 5 * 60_000, SESSION_MS = 24 * 60 * 60_000;
const hash = token => createHash('sha256').update(token).digest('hex');
function walletKey(address) {
  if (typeof address !== 'string' || address.length > 44) throw new Error('INVALID_WALLET');
  let key;
  try { key = new PublicKey(address); } catch { throw new Error('INVALID_WALLET'); }
  if (key.toBase58() !== address || !PublicKey.isOnCurve(key.toBytes())) throw new Error('INVALID_WALLET');
  return createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key.toBuffer()]), format: 'der', type: 'spki' });
}

// Server-only message-signing authentication, not an HTTP endpoint or SIWS adapter.
// Initialize the same DB with openGameStore first. origin must be operator-configured.
export function openAuthService(path, { origin, now = Date.now } = {}) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin) throw new Error('INVALID_AUTH_ORIGIN');
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS wallet_links (wallet TEXT PRIMARY KEY, player_id TEXT NOT NULL UNIQUE REFERENCES players(id)) STRICT;
    CREATE TABLE IF NOT EXISTS auth_challenges (id TEXT PRIMARY KEY, wallet TEXT NOT NULL, origin TEXT NOT NULL, message TEXT NOT NULL, issued_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0) STRICT;
    CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id), origin TEXT NOT NULL, issued_at INTEGER NOT NULL, expires_at INTEGER NOT NULL) STRICT;
  `);
  return {
    challenge(wallet) {
      walletKey(wallet);
      const time = now(), expiresAt = time + CHALLENGE_MS, challengeId = randomUUID();
      const nonce = randomBytes(24).toString('hex');
      const message = `${url.host} requests a Lumber Rush login.\nWallet: ${wallet}\nThis signature only signs you in. It does not transfer funds.\nOrigin: ${origin}\nNonce: ${nonce}\nIssued At: ${new Date(time).toISOString()}\nExpires At: ${new Date(expiresAt).toISOString()}`;
      db.prepare('INSERT INTO auth_challenges (id,wallet,origin,message,issued_at,expires_at) VALUES (?,?,?,?,?,?)').run(challengeId, wallet, origin, message, time, expiresAt);
      return { challengeId, message, expiresAt };
    },
    login(challengeId, signatureBase64) {
      if (typeof challengeId !== 'string' || challengeId.length > 64 || typeof signatureBase64 !== 'string' || signatureBase64.length !== 88) throw new Error('INVALID_SIGNATURE');
      const signature = Buffer.from(signatureBase64, 'base64');
      if (signature.length !== 64 || signature.toString('base64') !== signatureBase64) throw new Error('INVALID_SIGNATURE');
      db.exec('BEGIN IMMEDIATE');
      try {
        const time = now();
        const c = db.prepare('SELECT * FROM auth_challenges WHERE id = ?').get(challengeId);
        if (!c || c.used || c.origin !== origin || time < c.issued_at || time >= c.expires_at) throw new Error('CHALLENGE_UNAVAILABLE');
        if (!verify(null, Buffer.from(c.message, 'utf8'), walletKey(c.wallet), signature)) throw new Error('INVALID_SIGNATURE');
        let playerId = db.prepare('SELECT player_id FROM wallet_links WHERE wallet = ?').get(c.wallet)?.player_id;
        if (!playerId) {
          playerId = randomUUID();
          db.prepare('INSERT INTO players VALUES (?,0,?,?)').run(playerId, 'server', JSON.stringify(initialProgress('ko')));
          db.prepare('INSERT INTO wallet_links VALUES (?,?)').run(c.wallet, playerId);
        }
        const token = randomBytes(32).toString('base64url'), expiresAt = time + SESSION_MS;
        db.prepare('INSERT INTO auth_sessions VALUES (?,?,?,?,?)').run(hash(token), playerId, origin, time, expiresAt);
        db.prepare('UPDATE auth_challenges SET used = 1 WHERE id = ?').run(challengeId);
        db.exec('COMMIT');
        return { token, expiresAt, playerId };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    authenticate(token) {
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('UNAUTHENTICATED');
      const session = db.prepare('SELECT * FROM auth_sessions WHERE token_hash = ?').get(hash(token)), time = now();
      if (!session || session.origin !== origin || time < session.issued_at || time >= session.expires_at) throw new Error('UNAUTHENTICATED');
      return session.player_id;
    },
    logout(token) {
      if (typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)) db.prepare('DELETE FROM auth_sessions WHERE token_hash = ? AND origin = ?').run(hash(token), origin);
    },
    close: () => db.close(),
  };
}

// The caller supplies only a session and command, never chooses another player's identity.
export function authenticatedGame(auth, store) {
  return {
    load: token => store.load(auth.authenticate(token)),
    execute: (token, command) => store.execute(auth.authenticate(token), command),
  };
}
