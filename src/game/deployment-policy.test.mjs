import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentConfig } from './deployment-policy.ts';
test('default mode keeps existing local behavior and never enables a release API implicitly', () => {
  assert.equal(deploymentConfig({}, true).apiUrl, 'http://127.0.0.1:8787');
  assert.equal(deploymentConfig({}, true).serverEnabled, true);
  assert.equal(deploymentConfig({}, false).serverEnabled, false);
});
test('explicit preview enables release server UI with independent API and wallet origins', () => {
  const config = deploymentConfig({ mode: 'server-preview', apiUrl: 'https://api.example.com/', identityOrigin: 'https://game.example.com' }, false);
  assert.equal(config.serverEnabled, true);
  assert.equal(config.apiUrl, 'https://api.example.com');
  assert.equal(config.identityOrigin, 'https://game.example.com');
});
test('preview fails closed on missing, unsafe or malformed configuration', () => {
  assert.throws(() => deploymentConfig({ mode: 'server-preview' }, false));
  assert.throws(() => deploymentConfig({ mode: 'production' }, false));
  for (const apiUrl of ['http://api.example.com', 'https://127.0.0.1', 'https://localhost', 'https://192.168.1.2', 'https://10.0.0.2', 'https://172.20.0.1', 'https://user:secret@api.example.com', 'https://api.example.com/path', 'https://api.example.com?token=secret', 'https://api.example.com#fragment', 'https://lumber-rush.example', 'https://<approved-api-domain>']) {
    assert.throws(() => deploymentConfig({ mode: 'server-preview', apiUrl, identityOrigin: 'https://game.example.com' }, false), apiUrl);
  }
});
