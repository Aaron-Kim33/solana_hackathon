import { DatabaseSync } from 'node:sqlite';
import { randomInt, randomUUID } from 'node:crypto';
import { initialProgress, parseProgress, hit, collect, recover, regrow, upgrade, equipAxeSkin, claimFirstRecord, walletUnlocked, questSteps } from '../src/game/progression.ts';
import { createMemoryGameService, parseRequest } from './game-service.ts';

// Server-only single-host persistence. No network endpoint or authentication is provided here.
// accountId must be resolved by a future authenticated session, never trusted from an HTTP body.
export function openGameStore(path, { random = () => randomInt(0, 2 ** 32) / 2 ** 32, now = Date.now } = {}) {
  const db = new DatabaseSync(path, { timeout: 5000 });
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version > 4) throw new Error('DATABASE_VERSION_UNSUPPORTED');
    db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK(revision >= 0),
        provenance TEXT NOT NULL CHECK(provenance IN ('local-test', 'server')),
        progress TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS commands (
        player_id TEXT NOT NULL REFERENCES players(id), request_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL, response TEXT NOT NULL,
        PRIMARY KEY(player_id, request_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS economy_events (
        player_id TEXT NOT NULL REFERENCES players(id), revision INTEGER NOT NULL,
        request_id TEXT NOT NULL, command TEXT NOT NULL, before_state TEXT NOT NULL,
        after_state TEXT NOT NULL, created_at INTEGER NOT NULL,
        PRIMARY KEY(player_id, revision), UNIQUE(player_id, request_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS play_state (
        player_id TEXT PRIMARY KEY REFERENCES players(id), last_action INTEGER NOT NULL,
        collect_until INTEGER NOT NULL, drops TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS first_records (
        player_id TEXT PRIMARY KEY REFERENCES players(id), wallet TEXT NOT NULL,
        memo TEXT NOT NULL UNIQUE, signature TEXT UNIQUE, status TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS wallet_coin_grants (
        player_id TEXT PRIMARY KEY REFERENCES players(id), granted_at INTEGER NOT NULL
      ) STRICT;
      PRAGMA user_version = 4;
      COMMIT;
    `);
  } catch (error) { db.close(); throw error; }
  const id = value => {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw new Error('INVALID_PLAYER_ID');
    return value;
  };
  const load = accountId => {
    const row = db.prepare('SELECT * FROM players WHERE id = ?').get(id(accountId));
    if (!row) throw new Error('PLAYER_NOT_FOUND');
    const play = db.prepare('SELECT drops FROM play_state WHERE player_id = ?').get(accountId);
    const time = now();
    const walletCoinRewardClaimed = !!db.prepare('SELECT 1 FROM wallet_coin_grants WHERE player_id = ?').get(accountId);
    return { revision: row.revision, provenance: row.provenance, progress: parseProgress(row.progress), walletCoinRewardClaimed,
      drops: play ? JSON.parse(play.drops).filter(drop => drop.expiresAt > time) : [], serverTime: time };
  };
  return {
    // Fresh records only. No API exists to import a mobile save as ranked progress.
    createPlayer(accountId, language = 'ko') {
      if (!['ko', 'en'].includes(language)) throw new Error('INVALID_LANGUAGE');
      db.prepare('INSERT INTO players VALUES (?, 0, ?, ?)').run(id(accountId), 'server', JSON.stringify(initialProgress(language)));
      return load(accountId);
    },
    load,
    execute(accountId, input) {
      id(accountId);
      const r = parseRequest(input);
      const fingerprint = JSON.stringify([r.expectedRevision, r.command.type, r.command.type === 'equipAxe' ? r.command.skin : r.command.type === 'fuse' ? r.command.tier : r.command.type === 'collectDrop' ? r.command.dropId : r.command.type === 'hitBatch' ? r.command.count : null]);
      db.exec('BEGIN IMMEDIATE');
      try {
        const prior = db.prepare('SELECT * FROM commands WHERE player_id = ? AND request_id = ?').get(accountId, r.requestId);
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new Error('REQUEST_ID_REUSED');
          const response = JSON.parse(prior.response);
          db.exec('COMMIT');
          return response;
        }
        const before = load(accountId);
        const time = now(), c = r.command;
        let after;
        if (['acknowledgeWallet', 'claimFirstRecord'].includes(c.type)) {
          if (before.revision !== r.expectedRevision) throw new Error('REVISION_CONFLICT');
          if (!Number.isSafeInteger(before.revision + 1)) throw new Error('REVISION_OVERFLOW');
          let next;
          if (c.type === 'acknowledgeWallet') {
            if (!walletUnlocked(before.progress) || !db.prepare('SELECT wallet FROM wallet_links WHERE player_id=?').get(accountId)) throw new Error('ACTION_UNAVAILABLE');
            if (before.walletCoinRewardClaimed) throw new Error('ACTION_UNAVAILABLE');
            const coins = before.progress.coins + 20;
            if (!Number.isSafeInteger(coins)) throw new Error('RESOURCE_OVERFLOW');
            next = { ...before.progress, walletCompleted: true, coins };
            db.prepare('INSERT INTO wallet_coin_grants VALUES (?, ?)').run(accountId, time);
          } else next = claimFirstRecord(before.progress);
          if (next === before.progress) throw new Error('ACTION_UNAVAILABLE');
          after = { ...before, progress: next, revision: before.revision + 1,
            ...(c.type === 'acknowledgeWallet' ? { walletCoinRewardClaimed: true } : {}) };
        } else if (['hit', 'hitBatch', 'collectDrop', 'recover', 'regrow', 'upgradeTree', 'upgradeAxe', 'equipAxe'].includes(c.type)) {
          if (before.revision !== r.expectedRevision) throw new Error('REVISION_CONFLICT');
          if (!Number.isSafeInteger(before.revision + 1)) throw new Error('REVISION_OVERFLOW');
          const play = db.prepare('SELECT * FROM play_state WHERE player_id = ?').get(accountId);
          if (play && (time < play.last_action + 150 || time < play.collect_until)) throw new Error('ACTION_TOO_FAST');
          let drops = [...before.drops], next = recover(before.progress, time), lastDamage;
          const hitEvents = [];
          if (c.type === 'hit' || c.type === 'hitBatch') {
            const count = c.type === 'hitBatch' ? c.count : 1;
            // Server-owned time budget: no client timestamps or unlimited offline accumulation.
            const start = time - (count - 1) * 150;
            if (play && (start < play.last_action + 150 || start < play.collect_until)) throw new Error('ACTION_TOO_FAST');
            next = before.progress;
            for (let index = 0; index < count; index++) {
              const at = start + index * 150;
              const result = hit(next, at, random, false);
              if (!result) { if (index === 0) throw new Error('ACTION_UNAVAILABLE'); break; }
              next = result.state; lastDamage = result.damage;
              hitEvents.push({ hit: next.totalHits, damage: result.damage, critical: result.critical });
              if (result.manualWood > 0) drops.push({ id: randomUUID(), value: result.manualWood, expiresAt: at + 5000 });
            }
          } else if (c.type === 'collectDrop') {
            const drop = drops.find(d => d.id === c.dropId);
            if (!drop) throw new Error('DROP_UNAVAILABLE');
            next = collect(next, drop.value); drops = drops.filter(d => d.id !== c.dropId);
          } else if (c.type !== 'recover') {
            const updated = c.type === 'regrow' ? regrow(next) : c.type === 'equipAxe' ? equipAxeSkin(next, c.skin) : upgrade(next, c.type === 'upgradeAxe' ? 'axe' : 'tree');
            if (updated === next) throw new Error('ACTION_UNAVAILABLE');
            next = updated;
          }
          after = { ...before, progress: next, revision: before.revision + 1, drops, serverTime: time, ...(lastDamage === undefined ? {} : { lastDamage, hitEvents }) };
          db.prepare('INSERT INTO play_state VALUES (?,?,?,?) ON CONFLICT(player_id) DO UPDATE SET last_action=excluded.last_action,collect_until=excluded.collect_until,drops=excluded.drops')
            .run(accountId, time, c.type === 'collectDrop' ? time + 250 : 0, JSON.stringify(drops));
        } else after = createMemoryGameService(before, random).execute(r);
        // Validate the result before making all three writes visible atomically.
        parseProgress(JSON.stringify(after.progress));
        db.prepare('UPDATE players SET revision = ?, progress = ? WHERE id = ?').run(after.revision, JSON.stringify(after.progress), accountId);
        db.prepare('INSERT INTO commands VALUES (?, ?, ?, ?)').run(accountId, r.requestId, fingerprint, JSON.stringify(after));
        db.prepare('INSERT INTO economy_events VALUES (?, ?, ?, ?, ?, ?, ?)').run(accountId, after.revision, r.requestId, JSON.stringify(r.command), JSON.stringify(before.progress), JSON.stringify(after.progress), Date.now());
        db.exec('COMMIT');
        return after;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    audit(accountId) {
      return db.prepare('SELECT revision, request_id, command, created_at FROM economy_events WHERE player_id = ? ORDER BY revision').all(id(accountId));
    },
    recordStatus(accountId) {
      // Read-only: reconnecting must not create a new intent or change progress.
      id(accountId);
      return db.prepare('SELECT wallet,memo,signature,status FROM first_records WHERE player_id=?').get(accountId) ?? null;
    },
    prepareRecord(accountId) {
      const state = load(accountId);
      const existing = db.prepare('SELECT * FROM first_records WHERE player_id=?').get(accountId);
      if (existing) return existing;
      if (questSteps(state.progress)[5] !== 'active') throw new Error('ACTION_UNAVAILABLE');
      const link = db.prepare('SELECT wallet FROM wallet_links WHERE player_id=?').get(accountId);
      if (!link) throw new Error('UNAUTHENTICATED');
      const memo = `Lumber Rush | first-harvest | devnet | ${randomUUID()}`;
      db.prepare('INSERT INTO first_records VALUES (?,?,?,NULL,?)').run(accountId, link.wallet, memo, 'prepared');
      return db.prepare('SELECT * FROM first_records WHERE player_id=?').get(accountId);
    },
    submitRecord(accountId, signature) {
      if (typeof signature !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) throw new Error('INVALID_BODY');
      const intent = this.prepareRecord(accountId);
      if (intent.signature && intent.signature !== signature) throw new Error('RECORD_ALREADY_SUBMITTED');
      db.prepare('UPDATE first_records SET signature=?,status=? WHERE player_id=? AND signature IS NULL').run(signature, 'pending', accountId);
      return this.prepareRecord(accountId);
    },
    // Trusted verifier only; never exposed as a public game command.
    finishRecord(accountId, signature, status) {
      if (!['confirmed', 'failed'].includes(status)) throw new Error('INVALID_BODY');
      db.exec('BEGIN IMMEDIATE');
      try {
        const intent = db.prepare('SELECT * FROM first_records WHERE player_id=?').get(accountId);
        if (!intent || intent.signature !== signature) throw new Error('INVALID_BODY');
        const before = load(accountId);
        if (intent.status === 'confirmed') { db.exec('COMMIT'); return before; }
        if (questSteps(before.progress)[5] !== 'active') throw new Error('ACTION_UNAVAILABLE');
        const progress = { ...before.progress, receipt: { address: intent.wallet, signature, status } };
        parseProgress(JSON.stringify(progress));
        const revision = before.revision + 1;
        if (!Number.isSafeInteger(revision)) throw new Error('REVISION_OVERFLOW');
        db.prepare('UPDATE players SET progress=?,revision=? WHERE id=?').run(JSON.stringify(progress), revision, accountId);
        db.prepare('INSERT INTO economy_events VALUES (?,?,?,?,?,?,?)').run(accountId, revision, `record_${signature}`, JSON.stringify({ type: 'verifyFirstRecord', status }), JSON.stringify(before.progress), JSON.stringify(progress), now());
        // A failed finalized transaction can be replaced; a confirmed one remains permanently bound.
        if (status === 'failed') db.prepare('DELETE FROM first_records WHERE player_id=?').run(accountId);
        else db.prepare('UPDATE first_records SET status=? WHERE player_id=?').run(status, accountId);
        db.exec('COMMIT'); return load(accountId);
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close: () => db.close(),
  };
}
