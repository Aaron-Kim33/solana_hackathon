import { test } from 'node:test';
import assert from 'node:assert/strict';
import { en, ko, translate } from './i18n.ts';

test('English and Korean strings keep the same interpolation fields', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ko).sort());
  for (const key of Object.keys(ko)) {
    const fields = text => [...text.matchAll(/\{[^}]+\}/g)].map(match => match[0]).sort();
    assert.deepEqual(fields(en[key]), fields(ko[key]), `${key} has different placeholders`);
    for (const language of ['en', 'ko']) {
      assert.ok(translate(language, key, 42).length > 0, `${language}.${key} is empty`);
      assert.ok(!translate(language, key, 42).includes('{value}'), `${language}.${key} left a value placeholder`);
    }
  }
});
