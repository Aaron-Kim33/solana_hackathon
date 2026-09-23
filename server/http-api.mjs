import { createServer } from 'node:http';
import { openGameStore } from './sqlite-store.mjs';
import { openAuthService, authenticatedGame } from './auth-service.mjs';
import { createRateLimit } from './rate-limit.mjs';
import { fetchRecordTransaction, verifyRecordTransaction } from './record-verifier.mjs';

const errors = { INVALID_BODY: 400, INVALID_COMMAND: 400, INVALID_WALLET: 400, INVALID_SIGNATURE: 401, CHALLENGE_UNAVAILABLE: 401, UNAUTHENTICATED: 401, ACTION_UNAVAILABLE: 409, DROP_UNAVAILABLE: 409, ACTION_TOO_FAST: 429, REVISION_CONFLICT: 409, REQUEST_ID_REUSED: 409, TOO_LARGE: 413, RATE_LIMITED: 429 };
async function body(req, keys) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new Error('INVALID_BODY');
  let size = 0, chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 4096) throw new Error('TOO_LARGE'); chunks.push(chunk); }
  let data; try { data = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new Error('INVALID_BODY'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(k => !keys.includes(k)) || keys.some(k => !(k in data))) throw new Error('INVALID_BODY');
  return data;
}
// Local-only launcher below binds loopback. Do not expose publicly without TLS/security review.
export function createApi({ path, origin, mode = 'local', readRecordTransaction = fetchRecordTransaction }) {
  const store = openGameStore(path), auth = openAuthService(path, { origin }), game = authenticatedGame(auth, store);
  const anonymousLimit = createRateLimit(), playerLimit = createRateLimit();
  const recordLimit = createRateLimit({ limit: 12 });
  const recordChecks = new Set();
  const server = createServer({ requestTimeout: 10000, headersTimeout: 10000, maxHeaderSize: 8192 }, async (req, res) => {
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
    try {
      const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
      let playerId;
      if (token) {
        try { playerId = auth.authenticate(token); }
        catch (error) { anonymousLimit(req.socket.remoteAddress ?? 'unknown'); throw error; }
      }
      if (playerId) playerLimit(playerId);
      else anonymousLimit(req.socket.remoteAddress ?? 'unknown');
      if (req.headers.origin && req.headers.origin !== origin) return send(403, { error: 'ORIGIN_DENIED' });
      const route = `${req.method} ${req.url}`;
      if (route === 'GET /health') return send(200, mode === 'preview'
        ? { status: 'ok', mode: 'preview', identityOrigin: origin }
        : { status: 'ok', mode: 'local-development' });
      if (route === 'POST /auth/challenge') { const b = await body(req, ['wallet']); return send(200, auth.challenge(b.wallet)); }
      if (route === 'POST /auth/login') { const b = await body(req, ['challengeId', 'signature']); return send(200, auth.login(b.challengeId, b.signature)); }
      if (route === 'GET /me') return send(200, game.load(token));
      if (route === 'GET /record') {
        auth.authenticate(token);
        return send(200, store.recordStatus(playerId));
      }
      if (route === 'POST /record/prepare') {
        auth.authenticate(token); await body(req, []);
        return send(200, store.prepareRecord(playerId));
      }
      if (route === 'POST /record/submit') {
        auth.authenticate(token); const b = await body(req, ['signature']);
        return send(200, store.submitRecord(playerId, b.signature));
      }
      if (route === 'POST /record/check') {
        auth.authenticate(token); await body(req, []);
        const intent = store.recordStatus(playerId);
        if (!intent) return send(200, { status: 'none', snapshot: store.load(playerId) });
        if (!intent.signature) return send(200, { status: 'prepared', snapshot: store.load(playerId) });
        if (intent.status === 'confirmed') return send(200, { status: 'confirmed', snapshot: store.load(playerId) });
        recordLimit(playerId);
        if (recordChecks.has(playerId)) throw new Error('RECORD_CHECK_BUSY');
        recordChecks.add(playerId);
        let status;
        try {
          let transaction;
          try { transaction = await readRecordTransaction(intent.signature); }
          catch { throw new Error('RECORD_RPC_UNAVAILABLE'); }
          status = verifyRecordTransaction(transaction, intent);
        } finally { recordChecks.delete(playerId); }
        // The session might expire while the RPC request is in flight.
        auth.authenticate(token);
        const snapshot = status === 'pending' ? store.load(playerId) : store.finishRecord(playerId, intent.signature, status);
        return send(200, { status, snapshot });
      }
      if (route === 'POST /commands') return send(200, game.execute(token, await body(req, ['requestId', 'expectedRevision', 'command'])));
      if (route === 'POST /auth/logout') { auth.authenticate(token); auth.logout(token); return send(200, { ok: true }); }
      send(404, { error: 'NOT_FOUND' });
    } catch (error) {
      const recordErrors = { RECORD_ALREADY_SUBMITTED: 409, RECORD_MISMATCH: 409, RECORD_RPC_UNAVAILABLE: 503, RECORD_CHECK_BUSY: 429 };
      const status = errors[error.message] ?? recordErrors[error.message];
      send(status ?? 500, { error: status ? error.message : 'INTERNAL_ERROR' });
    }
  });
  server.on('close', () => { auth.close(); store.close(); });
  return server;
}
