import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseRequest } from '../server/game-service.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Source contracts supplement (not replace) inspection of the signed APK.
test('test rest and wallet skip UI stay behind development and offline guards', () => {
  const app = source('App.tsx');
  assert.match(app, /if \(__DEV__ && !online && commit\(testRest/);
  assert.match(app, /\{__DEV__ && !online && <Pressable onPress=\{rest\}/);
  assert.match(app, /useState\(\(\) => __DEV__ && !online && loadDevWalletSkip\(\)\)/);
  assert.match(app, /devQuestPreview\(progress, __DEV__ && !online && devWalletSkip\)/);
  assert.match(app, /\{__DEV__ && !online && quests\[index\] === 'active' && index === 1/);
  const character = source('src/game/CharacterPanel.tsx');
  assert.match(character, /\{__DEV__ && !serverCommand && .*button\(t\('testOptions'\)/);
  assert.match(character, /\{__DEV__ && !serverCommand && button\(t\('testGems'\)/);
});

test('API command parser never accepts development grants or fatigue bypass', () => {
  for (const type of ['testRest', 'grantTestOptions', 'grantTestGems', 'grantLocalTestAdmin', 'skipWallet']) {
    assert.throws(() => parseRequest({ requestId: 'release_guard_01', expectedRevision: 0, command: { type } }), /INVALID_COMMAND/);
  }
  assert.throws(() => parseRequest({ requestId: 'release_guard_02', expectedRevision: 0,
    command: { type: 'hit', admin: true } }), /INVALID_COMMAND/);
});

test('Git upload exclusions cover nested credentials, wallets and runtime database files', () => {
  const paths = ['credentials.json', 'nested/credentials.json', '.env', '.env.preview',
    'nested/signing.keystore', 'nested/signing.jks', 'nested/id.json', 'nested/player-keypair.json',
    'nested/wallet.json', 'server/players.sqlite', 'server/players.sqlite-wal',
    'server/players.db', 'server/players.db-journal'];
  const ignored = execFileSync('git', ['check-ignore', '--no-index', ...paths], { cwd: root, encoding: 'utf8' })
    .trim().split(/\r?\n/);
  assert.deepEqual(ignored, paths);
});
