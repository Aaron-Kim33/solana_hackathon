import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, formatSignedNumber } from './format-number.ts';

test('display numbers round to at most two decimals without trailing zeros', () => {
  for (const [value, expected] of [[2.200000000000003, '2.2'], [3.299999999999997, '3.3'], [1.236, '1.24'], [2, '2'], [-0.001, '0']]) {
    assert.equal(formatNumber(value), expected);
  }
});

test('comparison numbers preserve signs and suppress rounded negative zero', () => {
  assert.equal(formatSignedNumber(2.200000000000003), '+2.2');
  assert.equal(formatSignedNumber(-3.299999999999997), '-3.3');
  assert.equal(formatSignedNumber(1.236), '+1.24');
  assert.equal(formatSignedNumber(-0.001), '0');
  assert.equal(formatSignedNumber(0.001), '0');
});
