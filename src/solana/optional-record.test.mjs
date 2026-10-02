import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ko, en } from '../i18n.ts';

test('Mainnet signing is preceded by a real fee quote and explicit opt-in', () => {
  const source = readFileSync(new URL('./achievement.ts', import.meta.url), 'utf8');
  assert.ok(source.indexOf('options.approveFee(fee.value!)') < source.indexOf('await transact'));
  assert.ok(source.indexOf('approvedFee !== undefined && fee.value !== approvedFee') < source.indexOf('wallet.signAndSendTransactions'));
  assert.match(source, /USER_CANCELLED/);
  const serverUI = readFileSync(new URL('../game/ServerLoginPanel.tsx', import.meta.url), 'utf8');
  assert.match(serverUI, /실제 SOL/);
  assert.match(serverUI, /Not now/);
  assert.match(serverUI, /approveFee/);
  assert.match(serverUI, /chain: 'solana:mainnet'/);
});

test('free growth and optional record copy are clear in both languages', () => {
  assert.match(ko.qReward, /무료/);
  assert.match(en.qReward, /free/i);
  assert.match(ko.recordNoSol, /계속 플레이/);
  assert.match(en.recordNoSol, /keep playing/i);
  assert.match(ko.firstRecordRewardDescription, /기록 없이/);
  assert.match(en.firstRecordRewardDescription, /No on-chain record/i);
  assert.doesNotMatch(ko.recordConfirm + en.recordConfirm, /테스트 SOL|test SOL|Devnet/i);
});
