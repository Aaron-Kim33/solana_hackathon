import { DatabaseSync } from 'node:sqlite';
import { randomInt, randomUUID } from 'node:crypto';
import { starterProgress, parseProgress, hit, rollCombatDamage, recoveryOwned, collect, loadTrolley, dispatchTrolley, recover, regrow, upgrade, equipAxeSkin, equip, claimFirstRecord, claimGrowthReward, claimWardenReward, openGem, walletUnlocked, questSteps, attackIntervalMs } from '../src/game/progression.ts';
import { createMemoryGameService, parseRequest } from './game-service.ts';
import { claimAdventure, drawWoodGem, fuseGems } from '../src/game/progression.ts';
import { COMMUNITY_QUESTS, COMMUNITY_FACILITIES, COMMUNITY_LEVEL_STEPS, COMMUNITY_CONTRIBUTOR_STEPS, COMMUNITY_MIN_CONTRIBUTION, communityFacilityLevel, communityDayStart, communityWeekStart } from '../src/shared/community.ts';
import { WORLD_BOSS_WEEKLY_HITS, worldBossWeekStart } from '../src/shared/world-boss.ts';
import { SQUIRREL_EXPEDITION_MS, squirrelReward } from '../src/shared/pets.ts';
import { startFarmPuzzle, finishFarmPuzzle, claimFarmTree } from '../src/game/farm.ts';
import { WOOD_DROP_ACCEPT_MS } from '../src/shared/drop-lifetime.ts';


// Server-only single-host persistence. No network endpoint or authentication is provided here.
// accountId must be resolved by a future authenticated session, never trusted from an HTTP body.
export function openGameStore(path, { random = () => randomInt(0, 2 ** 32) / 2 ** 32, now = Date.now, mode = 'local' } = {}) {
  const db = new DatabaseSync(path, { timeout: 5000 });
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version > 6) throw new Error('DATABASE_VERSION_UNSUPPORTED');
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
      CREATE TABLE IF NOT EXISTS community_activity (
        player_id TEXT NOT NULL REFERENCES players(id), day_start INTEGER NOT NULL,
        hits INTEGER NOT NULL DEFAULT 0, bundles INTEGER NOT NULL DEFAULT 0,
        trolleys INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(player_id, day_start)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS community_claims (
        player_id TEXT NOT NULL REFERENCES players(id), period_start INTEGER NOT NULL,
        quest_id TEXT NOT NULL, claimed_at INTEGER NOT NULL,
        PRIMARY KEY(player_id, period_start, quest_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS community_balances (
        player_id TEXT NOT NULL REFERENCES players(id), week_start INTEGER NOT NULL,
        materials INTEGER NOT NULL CHECK(materials >= 0),
        PRIMARY KEY(player_id, week_start)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS community_contributions (
        player_id TEXT NOT NULL REFERENCES players(id), week_start INTEGER NOT NULL,
        facility TEXT NOT NULL CHECK(facility IN ('mine','saplings')),
        amount INTEGER NOT NULL CHECK(amount >= 0),
        PRIMARY KEY(player_id, week_start, facility)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS world_boss_hits (
        player_id TEXT NOT NULL REFERENCES players(id), week_start INTEGER NOT NULL,
        hits INTEGER NOT NULL CHECK(hits >= 0 AND hits <= 100),
        damage REAL NOT NULL CHECK(damage >= 0),
        PRIMARY KEY(player_id, week_start)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS squirrel_pets (
        player_id TEXT PRIMARY KEY REFERENCES players(id), claimed_at INTEGER NOT NULL,
        destination TEXT CHECK(destination IN ('mine','saplings')),
        departed_at INTEGER, returns_at INTEGER,
        reward INTEGER NOT NULL DEFAULT 0 CHECK(reward >= 0),
        trips INTEGER NOT NULL DEFAULT 0 CHECK(trips >= 0)
      ) STRICT;
      ${mode === 'local' ? 'CREATE TABLE IF NOT EXISTS local_test_admins (player_id TEXT PRIMARY KEY REFERENCES players(id)) STRICT;' : ''}
      ${version < 5 ? 'ALTER TABLE play_state ADD COLUMN last_hit INTEGER NOT NULL DEFAULT 0;' : ''}
      PRAGMA user_version = 6;
      COMMIT;
    `);
  } catch (error) { db.close(); throw error; }
  const id = value => {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw new Error('INVALID_PLAYER_ID');
    return value;
  };
  const isLocalTestAdmin = accountId => mode === 'local' && !!db.prepare('SELECT 1 FROM local_test_admins WHERE player_id=?').get(accountId);
  const communitySnapshot = (accountId, time) => {
    const dayStart = communityDayStart(time), weekStart = communityWeekStart(time);
    const today = db.prepare('SELECT hits,bundles,trolleys FROM community_activity WHERE player_id=? AND day_start=?').get(accountId, dayStart) ?? { hits: 0, bundles: 0, trolleys: 0 };
    const week = db.prepare('SELECT COALESCE(SUM(hits),0) AS hits,COALESCE(SUM(bundles),0) AS bundles,COALESCE(SUM(trolleys),0) AS trolleys FROM community_activity WHERE player_id=? AND day_start>=? AND day_start<?').get(accountId, weekStart, weekStart + 7 * 86_400_000);
    const claims = new Set(db.prepare('SELECT period_start,quest_id FROM community_claims WHERE player_id=? AND period_start IN (?,?)').all(accountId, dayStart, weekStart).map(row => `${row.period_start}:${row.quest_id}`));
    const materials = db.prepare('SELECT materials FROM community_balances WHERE player_id=? AND week_start=?').get(accountId, weekStart)?.materials ?? 0;
    const lastWeek = weekStart - 7 * 86_400_000;
    const targetUnit = Math.max(1, Math.min(10_000, db.prepare('SELECT COUNT(DISTINCT player_id) AS count FROM community_claims WHERE claimed_at>=? AND claimed_at<?').get(lastWeek, weekStart).count));
    const facilities = COMMUNITY_FACILITIES.map(facility => {
      const total = db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM community_contributions WHERE week_start=? AND facility=?').get(weekStart, facility).total;
      const contributors = db.prepare('SELECT COUNT(*) AS contributors FROM community_contributions WHERE week_start=? AND facility=? AND amount>=?').get(weekStart, facility, COMMUNITY_MIN_CONTRIBUTION).contributors;
      const mine = db.prepare('SELECT amount FROM community_contributions WHERE player_id=? AND week_start=? AND facility=?').get(accountId, weekStart, facility)?.amount ?? 0;
      const level = communityFacilityLevel(total, targetUnit, contributors);
      return { id: facility, total, mine, contributors, level, nextTarget: level >= 5 ? null : COMMUNITY_LEVEL_STEPS[level - 1] * targetUnit,
        nextContributors: level >= 5 ? null : COMMUNITY_CONTRIBUTOR_STEPS[level - 1] };
    });
    return { dayStart, weekStart, materials, targetUnit, facilities,
      myContribution: facilities.reduce((sum, facility) => sum + facility.mine, 0),
      quests: COMMUNITY_QUESTS.map(quest => ({ id: quest.id,
      progress: (quest.period === 'daily' ? today : week)[quest.metric], target: quest.target, materials: quest.materials,
      claimed: claims.has(`${quest.period === 'daily' ? dayStart : weekStart}:${quest.id}`) })) };
  };
  const worldBossSnapshot = (accountId, time) => {
    const weekStart = worldBossWeekStart(time);
    const mine = db.prepare('SELECT hits,damage FROM world_boss_hits WHERE player_id=? AND week_start=?').get(accountId, weekStart) ?? { hits: 0, damage: 0 };
    const global = db.prepare('SELECT COALESCE(SUM(hits),0) AS totalHits,COALESCE(SUM(damage),0) AS totalDamage,COUNT(*) AS participants FROM world_boss_hits WHERE week_start=?').get(weekStart);
    return { weekStart, hits: mine.hits, damage: Math.round(mine.damage * 100) / 100, totalHits: global.totalHits,
      totalDamage: Math.round(global.totalDamage * 100) / 100, participants: global.participants };
  };
  const squirrelSnapshot = accountId => {
    const pet = db.prepare('SELECT destination,departed_at,returns_at,reward,trips FROM squirrel_pets WHERE player_id=?').get(accountId);
    const questReady = !!db.prepare('SELECT 1 FROM community_claims WHERE player_id=? LIMIT 1').get(accountId);
    return { owned: !!pet, questReady, trips: pet?.trips ?? 0,
      trip: pet?.destination ? { destination: pet.destination, departedAt: pet.departed_at,
        returnsAt: pet.returns_at, reward: pet.reward } : null };
  };
  const load = accountId => {
    const row = db.prepare('SELECT * FROM players WHERE id = ?').get(id(accountId));
    if (!row) throw new Error('PLAYER_NOT_FOUND');
    const play = db.prepare('SELECT drops FROM play_state WHERE player_id = ?').get(accountId);
    const time = now();
    const walletCoinRewardClaimed = !!db.prepare('SELECT 1 FROM wallet_coin_grants WHERE player_id = ?').get(accountId);
    const progress = parseProgress(row.progress);
    return { revision: row.revision, provenance: row.provenance,
      progress: isLocalTestAdmin(accountId) ? { ...progress, fatigue: 0, recoveryAt: null } : progress, walletCoinRewardClaimed,
      community: communitySnapshot(accountId, time),
      worldBoss: worldBossSnapshot(accountId, time),
      squirrel: squirrelSnapshot(accountId),
      drops: play ? JSON.parse(play.drops).filter(drop => drop.expiresAt > time) : [], serverTime: time };
  };
  return {
    // Operator-only local test grant. No HTTP route or client command can call this.
    grantLocalTestAdmin(wallet) {
      if (mode !== 'local') throw new Error('LOCAL_ADMIN_ONLY');
      db.exec('BEGIN IMMEDIATE');
      try {
        const linked = db.prepare('SELECT player_id FROM wallet_links WHERE wallet=?').get(wallet);
        if (!linked) throw new Error('PLAYER_NOT_FOUND');
        db.prepare('INSERT OR IGNORE INTO local_test_admins (player_id) VALUES (?)').run(linked.player_id);
        db.prepare("UPDATE players SET provenance='local-test' WHERE id=?").run(linked.player_id);
        db.exec('COMMIT');
        return linked.player_id;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    // Fresh records only. No API exists to import a mobile save as ranked progress.
    createPlayer(accountId, language = 'ko') {
      if (!['ko', 'en'].includes(language)) throw new Error('INVALID_LANGUAGE');
      db.prepare('INSERT INTO players VALUES (?, 0, ?, ?)').run(id(accountId), 'server', JSON.stringify(starterProgress(language)));
      return load(accountId);
    },
    load,
    execute(accountId, input) {
      id(accountId);
      const r = parseRequest(input);
      // Keep the original fingerprint for already-persisted command receipts.
      const fingerprint = JSON.stringify([r.expectedRevision, r.command.type, r.command.type === 'contributeCommunity' ? [r.command.facility, r.command.amount] : r.command.type === 'dispatchSquirrel' ? r.command.destination : r.command.type === 'claimCommunityQuest' ? r.command.questId : r.command.type === 'startFarmPuzzle' || r.command.type === 'claimFarmTree' ? r.command.plot : r.command.type === 'finishFarmPuzzle' ? r.command.rotations : r.command.type === 'claimAdventure' ? r.command.stage : r.command.type === 'equipAxe' ? r.command.skin : r.command.type === 'fuse' || r.command.type === 'openGem' ? r.command.tier : r.command.type === 'equipOption' ? [r.command.slot, r.command.item] : r.command.type === 'collectDrop' || r.command.type === 'loadTrolley' ? r.command.dropId : r.command.type === 'loadTrolleyBatch' ? r.command.dropIds : r.command.type === 'hitBatch' ? r.command.count : null]);
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
        const testAdmin = isLocalTestAdmin(accountId);
        const time = now(), c = r.command;
        let after;
        if (c.type === 'claimSquirrel') {
          if (before.revision !== r.expectedRevision) throw new Error('REVISION_CONFLICT');
          if (!Number.isSafeInteger(before.revision + 1)) throw new Error('REVISION_OVERFLOW');
          if (!before.squirrel.questReady || before.squirrel.owned) throw new Error('ACTION_UNAVAILABLE');
          db.prepare('INSERT INTO squirrel_pets (player_id,claimed_at) VALUES (?,?)').run(accountId, time);
          after = { ...before, revision: before.revision + 1 };
        } else if (c.type === 'dispatchSquirrel') {
          if (before.revision !== r.expectedRevision) throw new Error('REVISION_CONFLICT');
          if (!Number.isSafeInteger(before.revision + 1)) throw new Error('REVISION_OVERFLOW');
          if (!before.squirrel.owned || before.squirrel.trip) throw new Error('ACTION_UNAVAILABLE');
          const facility = before.community.facilities.find(item => item.id === c.destination);
          if (!facility) throw new Error('ACTION_UNAVAILABLE');
          const reward = squirrelReward(c.destination, before.progress.treeLevel, facility.level);
          const updated = db.prepare('UPDATE squirrel_pets SET destination=?,departed_at=?,returns_at=?,reward=? WHERE player_id=? AND destination IS NULL')
            .run(c.destination, time, time + SQUIRREL_EXPEDITION_MS, reward, accountId);
          if (updated.changes !== 1) throw new Error('ACTION_UNAVAILABLE');
          after = { ...before, revision: before.revision + 1 };
        } else if (c.type === 'collectSquirrel') {
          if (before.revision !== r.expectedRevision) throw new Error('REVISION_CONFLICT');
          if (!Number.isSafeInteger(before.revision + 1)) throw new Error('REVISION_OVERFLOW');
          const trip = before.squirrel.trip;
          if (!trip || time < trip.returnsAt) throw new Error('ACTION_UNAVAILABLE');
          const field = trip.destination === 'mine' ? 'coins' : 'wood';
          const balance = before.progress[field] + trip.reward;
          if (!Number.isSafeInteger(balance)) throw new Error('RESOURCE_OVERFLOW');
          const harvested = before.progress.harvested + (field === 'wood' ? trip.reward : 0);
          if (!Number.isSafeInteger(harvested)) throw new Error('RESOURCE_OVERFLOW');
          const next = { ...before.progress, [field]: balance, harvested };
          db.prepare('UPDATE squirrel_pets SET destination=NULL,departed_at=NULL,returns_at=NULL,reward=0,trips=trips+1 WHERE player_id=?').run(accountId);
          after = { ...before, progress: next, revision: before.revision + 1 };
        } else if (c.type === 'hitWorldBoss') {
          if (before.revision !== r.expectedRevision) throw new Error('REVISION_CONFLICT');
          if (!Number.isSafeInteger(before.revision + 1)) throw new Error('REVISION_OVERFLOW');
          const play = db.prepare('SELECT * FROM play_state WHERE player_id = ?').get(accountId);
          if (play && (time < play.last_action + 150 || time < play.collect_until || time < play.last_hit + attackIntervalMs(before.progress))) throw new Error('ACTION_TOO_FAST');
          if (before.worldBoss.hits >= WORLD_BOSS_WEEKLY_HITS) throw new Error('ACTION_UNAVAILABLE');
          const current = recover(before.progress, time);
          if (current.fatigue >= 100) throw new Error('ACTION_UNAVAILABLE');
          const { damage, critical } = rollCombatDamage(current, random);
          const fatigueSaved = !testAdmin && current.axeSkin === 'recovery' && recoveryOwned(current) && random() < 0.3;
          const next = { ...current, fatigue: testAdmin ? 0 : Math.min(100, current.fatigue + (fatigueSaved ? 0 : 1)),
            recoveryAt: testAdmin ? null : fatigueSaved ? current.recoveryAt : current.recoveryAt ?? time };
          const weekStart = worldBossWeekStart(time);
          db.prepare('INSERT INTO world_boss_hits VALUES (?,?,1,?) ON CONFLICT(player_id,week_start) DO UPDATE SET hits=hits+1,damage=ROUND(damage+excluded.damage,2)')
            .run(accountId, weekStart, damage);
          after = { ...before, progress: next, revision: before.revision + 1, serverTime: time,
            lastBossDamage: damage, lastBossCritical: critical };
          db.prepare('INSERT INTO play_state (player_id,last_action,collect_until,drops,last_hit) VALUES (?,?,?,?,?) ON CONFLICT(player_id) DO UPDATE SET last_action=excluded.last_action,last_hit=excluded.last_hit')
            .run(accountId, time, 0, JSON.stringify(before.drops), time);
        } else if (c.type === 'contributeCommunity') {
          if (before.revision !== r.expectedRevision) throw new Error('REVISION_CONFLICT');
          if (!Number.isSafeInteger(before.revision + 1)) throw new Error('REVISION_OVERFLOW');
          if (communitySnapshot(accountId, time).materials < c.amount) throw new Error('ACTION_UNAVAILABLE');
          const weekStart = communityWeekStart(time);
          db.prepare('UPDATE community_balances SET materials=materials-? WHERE player_id=? AND week_start=?').run(c.amount, accountId, weekStart);
          db.prepare('INSERT INTO community_contributions VALUES (?,?,?,?) ON CONFLICT(player_id,week_start,facility) DO UPDATE SET amount=amount+excluded.amount')
            .run(accountId, weekStart, c.facility, c.amount);
          after = { ...before, revision: before.revision + 1 };
        } else if (c.type === 'claimCommunityQuest') {
          if (before.revision !== r.expectedRevision) throw new Error('REVISION_CONFLICT');
          if (!Number.isSafeInteger(before.revision + 1)) throw new Error('REVISION_OVERFLOW');
          const quest = COMMUNITY_QUESTS.find(item => item.id === c.questId);
          const status = communitySnapshot(accountId, time).quests.find(item => item.id === c.questId);
          if (!quest || !status || status.claimed || status.progress < status.target) throw new Error('ACTION_UNAVAILABLE');
          const periodStart = quest.period === 'daily' ? communityDayStart(time) : communityWeekStart(time);
          const weekStart = communityWeekStart(time);
          db.prepare('INSERT INTO community_claims VALUES (?,?,?,?)').run(accountId, periodStart, quest.id, time);
          db.prepare('INSERT INTO community_balances VALUES (?,?,?) ON CONFLICT(player_id,week_start) DO UPDATE SET materials=materials+excluded.materials')
            .run(accountId, weekStart, quest.materials);
          after = { ...before, revision: before.revision + 1 };
        } else if (['startFarmPuzzle', 'finishFarmPuzzle', 'claimFarmTree', 'acknowledgeWallet', 'claimFirstRecord', 'claimGrowthReward', 'claimWardenReward', 'claimAdventure', 'openGem', 'equipOption', 'drawGem', 'fuse'].includes(c.type)) {
          if (before.revision !== r.expectedRevision) throw new Error('REVISION_CONFLICT');
          if (!Number.isSafeInteger(before.revision + 1)) throw new Error('REVISION_OVERFLOW');
          let next;
          if (c.type === 'startFarmPuzzle') next = startFarmPuzzle(before.progress, time, Math.floor(random() * 2_147_483_648), c.plot);
          else if (c.type === 'finishFarmPuzzle') next = finishFarmPuzzle(before.progress, time, c.rotations);
          else if (c.type === 'claimFarmTree') next = claimFarmTree(before.progress, time, c.plot);
          else if (c.type === 'acknowledgeWallet') {
            if (!walletUnlocked(before.progress) || !db.prepare('SELECT wallet FROM wallet_links WHERE player_id=?').get(accountId)) throw new Error('ACTION_UNAVAILABLE');
            if (before.walletCoinRewardClaimed) throw new Error('ACTION_UNAVAILABLE');
            const coins = before.progress.coins + 20;
            if (!Number.isSafeInteger(coins)) throw new Error('RESOURCE_OVERFLOW');
            next = { ...before.progress, walletCompleted: true, coins };
            db.prepare('INSERT INTO wallet_coin_grants VALUES (?, ?)').run(accountId, time);
          } else if (c.type === 'claimFirstRecord') next = claimFirstRecord(before.progress);
          else if (c.type === 'claimGrowthReward') next = claimGrowthReward(before.progress);
          else if (c.type === 'claimWardenReward') next = claimWardenReward(before.progress);
          else if (c.type === 'claimAdventure') {
            if (c.stage !== before.progress.adventureClaimed) throw new Error('ACTION_UNAVAILABLE');
            next = claimAdventure(before.progress);
            if (!Number.isSafeInteger(next.coins)) throw new Error('RESOURCE_OVERFLOW');
          }
          else if (c.type === 'drawGem') next = drawWoodGem(before.progress, random)?.state;
          else if (c.type === 'fuse') next = fuseGems(before.progress, c.tier, random)?.state;
          else if (c.type === 'openGem') next = openGem(before.progress, c.tier, random)?.state;
          else next = equip(before.progress, c.slot, c.item);
          if (!next || next === before.progress) throw new Error('ACTION_UNAVAILABLE');
          after = { ...before, progress: next, revision: before.revision + 1,
            ...(c.type === 'acknowledgeWallet' ? { walletCoinRewardClaimed: true } : {}) };
        } else if (['hit', 'hitBatch', 'collectDrop', 'loadTrolley', 'loadTrolleyBatch', 'collectTrolley', 'recover', 'regrow', 'upgradeTree', 'upgradeAxe', 'equipAxe'].includes(c.type)) {
          if (before.revision !== r.expectedRevision) throw new Error('REVISION_CONFLICT');
          if (!Number.isSafeInteger(before.revision + 1)) throw new Error('REVISION_OVERFLOW');
          const play = db.prepare('SELECT * FROM play_state WHERE player_id = ?').get(accountId);
          if (play && (time < play.last_action + 150 || time < play.collect_until)) throw new Error('ACTION_TOO_FAST');
          let drops = [...before.drops], next = recover(before.progress, time), lastDamage;
          const hitEvents = [];
          let lastHit = play?.last_hit ?? 0;
          if (c.type === 'hit' || c.type === 'hitBatch') {
            const attackInterval = attackIntervalMs(before.progress);
            const count = c.type === 'hitBatch' ? c.count : 1;
            // Server-owned time budget: no client timestamps or unlimited offline accumulation.
            const start = time - (count - 1) * attackInterval;
            if (play && (start < play.last_action + 150 || start < play.collect_until)) throw new Error('ACTION_TOO_FAST');
            if (play && start < play.last_hit + attackInterval) throw new Error('ACTION_TOO_FAST');
            next = before.progress;
            for (let index = 0; index < count; index++) {
              const at = start + index * attackInterval;
              const result = hit(next, at, random, false);
              if (!result) { if (index === 0) throw new Error('ACTION_UNAVAILABLE'); break; }
              next = testAdmin ? { ...result.state, fatigue: 0, recoveryAt: null } : result.state;
              lastDamage = result.damage; lastHit = at;
              hitEvents.push({ hit: next.totalHits, damage: result.damage, critical: result.critical });
              if (result.manualWood > 0) drops.push({ id: randomUUID(), value: result.manualWood, expiresAt: at + WOOD_DROP_ACCEPT_MS });
            }
          } else if (c.type === 'collectDrop' || c.type === 'loadTrolley') {
            const drop = drops.find(d => d.id === c.dropId);
            if (!drop) throw new Error('DROP_UNAVAILABLE');
            const updated = c.type === 'loadTrolley' ? loadTrolley(next, drop.value) : collect(next, drop.value);
            if (updated === next) throw new Error('ACTION_UNAVAILABLE');
            next = updated;
            drops = drops.filter(d => d.id !== c.dropId);
          } else if (c.type === 'loadTrolleyBatch') {
            const selected = drops.filter(d => c.dropIds.includes(d.id));
            if (selected.length !== c.dropIds.length) throw new Error('DROP_UNAVAILABLE');
            const total = selected.reduce((sum, drop) => sum + drop.value, 0);
            const updated = loadTrolley(next, total);
            if (updated === next) throw new Error('ACTION_UNAVAILABLE');
            next = updated;
            const ids = new Set(c.dropIds);
            drops = drops.filter(d => !ids.has(d.id));
          } else if (c.type === 'collectTrolley') {
            const dispatched = dispatchTrolley(next, time);
            if (dispatched === next) throw new Error('ACTION_UNAVAILABLE');
            next = dispatched;
          } else if (c.type !== 'recover') {
            const updated = c.type === 'regrow' ? regrow(next) : c.type === 'equipAxe' ? equipAxeSkin(next, c.skin) : upgrade(next, c.type === 'upgradeAxe' ? 'axe' : 'tree');
            if (updated === next) throw new Error('ACTION_UNAVAILABLE');
            next = updated;
          }
          after = { ...before, progress: next, revision: before.revision + 1, drops, serverTime: time, ...(lastDamage === undefined ? {} : { lastDamage, hitEvents }) };
          db.prepare('INSERT INTO play_state (player_id,last_action,collect_until,drops,last_hit) VALUES (?,?,?,?,?) ON CONFLICT(player_id) DO UPDATE SET last_action=excluded.last_action,collect_until=excluded.collect_until,drops=excluded.drops,last_hit=excluded.last_hit')
            .run(accountId, time, ['collectDrop', 'loadTrolley', 'loadTrolleyBatch', 'collectTrolley'].includes(c.type) ? time + 250 : 0, JSON.stringify(drops), lastHit);
        } else after = createMemoryGameService(before, random).execute(r);
        if (c.type === 'hit' || c.type === 'hitBatch' || c.type === 'collectDrop' || c.type === 'loadTrolley' || c.type === 'loadTrolleyBatch' || c.type === 'collectTrolley') {
          const hits = after.progress.totalHits - before.progress.totalHits;
          const bundles = c.type === 'collectDrop' || c.type === 'loadTrolley' ? 1 : c.type === 'loadTrolleyBatch' ? c.dropIds.length : 0;
          const trolleys = c.type === 'collectTrolley' ? 1 : 0;
          db.prepare('INSERT INTO community_activity VALUES (?,?,?,?,?) ON CONFLICT(player_id,day_start) DO UPDATE SET hits=hits+excluded.hits,bundles=bundles+excluded.bundles,trolleys=trolleys+excluded.trolleys')
            .run(accountId, communityDayStart(time), hits, bundles, trolleys);
        }
        after.community = communitySnapshot(accountId, time);
        after.worldBoss = worldBossSnapshot(accountId, time);
        after.squirrel = squirrelSnapshot(accountId);
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
