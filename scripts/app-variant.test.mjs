import { test } from 'node:test';
import assert from 'node:assert/strict';
import config from '../app.config.js';
import { readFileSync } from 'node:fs';

const profiles = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8')).build;

test('preview installs beside the existing app while store keeps the original package', () => {
  const previous = process.env.APP_VARIANT;
  try {
    process.env.APP_VARIANT = 'preview';
    const preview = config();
    process.env.APP_VARIANT = 'production';
    const store = config();
    assert.equal(preview.android.package, 'com.lumberrush.seeker.preview');
    assert.equal(store.android.package, 'com.lumberrush.seeker');
    assert.notEqual(preview.scheme, store.scheme);
    assert.equal(preview.icon, './assets/lumber-rush-icon-v2.png');
    assert.equal(preview.android.adaptiveIcon.foregroundImage, './assets/lumber-rush-adaptive-foreground-v2.png');
    assert.equal(store.icon, preview.icon);
    assert.equal(profiles.preview.android.buildType, 'apk');
    assert.equal(profiles['dapp-store'].android.buildType, 'apk');
    assert.equal(profiles.preview.environment, 'preview');
    assert.equal(profiles['dapp-store'].environment, 'production');
    assert.equal(profiles.preview.env.EXPO_PUBLIC_APP_MODE, 'server-preview');
    assert.equal(profiles['dapp-store'].env.EXPO_PUBLIC_APP_MODE, 'server-preview');
  } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
});

test('unknown app variants fail before a build can use the wrong package', () => {
  const previous = process.env.APP_VARIANT;
  try {
    process.env.APP_VARIANT = 'typo';
    assert.throws(() => config(), { message: 'INVALID_APP_VARIANT' });
  } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
});

test('EAS build rejects missing and placeholder HTTPS endpoints', () => {
  const previous = Object.fromEntries(['EAS_BUILD', 'EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_IDENTITY_ORIGIN'].map(key => [key, process.env[key]]));
  try {
    process.env.EAS_BUILD = 'true';
    delete process.env.EXPO_PUBLIC_API_URL;
    assert.throws(() => config(), { message: 'MISSING_BUILD_URL: EXPO_PUBLIC_API_URL' });
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example';
    process.env.EXPO_PUBLIC_IDENTITY_ORIGIN = 'https://game.example';
    assert.throws(() => config(), { message: 'INVALID_BUILD_URL: EXPO_PUBLIC_API_URL' });
    process.env.EXPO_PUBLIC_API_URL = 'https://api.lumberrush.com';
    process.env.EXPO_PUBLIC_IDENTITY_ORIGIN = 'https://lumberrush.com';
    assert.equal(config().android.package, 'com.lumberrush.seeker');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
