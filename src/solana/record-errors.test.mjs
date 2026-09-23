import test from 'node:test';
import assert from 'node:assert/strict';
import { requireRecordFee, recordErrorKey } from './record-errors.ts';

test('zero or insufficient SOL blocks signing, exact fee balance passes', () => {
  assert.throws(() => requireRecordFee(0, 0), /RECORD_INSUFFICIENT_SOL/);
  assert.throws(() => requireRecordFee(4999, 5000), /RECORD_INSUFFICIENT_SOL/);
  assert.doesNotThrow(() => requireRecordFee(5000, 5000));
  assert.doesNotThrow(() => requireRecordFee(10000, 5000));
});
test('unknown/invalid fee never silently passes', () => {
  for (const fee of [null, NaN, Infinity, -1]) assert.throws(() => requireRecordFee(10000, fee), /RECORD_FEE_UNAVAILABLE/);
});
test('errors have stable localizable messages without disclosing wallet payloads', () => {
  assert.equal(recordErrorKey(new Error('RECORD_INSUFFICIENT_SOL')), 'recordNoSol');
  assert.equal(recordErrorKey(new Error('RECORD_FEE_UNAVAILABLE')), 'recordFeeUnavailable');
  assert.equal(recordErrorKey(new Error('RECORD_SAVE_FAILED')), 'saveError');
  assert.equal(recordErrorKey(new Error('WALLET_ACCOUNT_CHANGED')), 'recordAccountChanged');
  assert.equal(recordErrorKey({ secret: 'never display' }), 'recordError');
});
