import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialProgress } from './progression.ts';
import { parseServerSnapshot } from './server-snapshot.ts';

test('older server snapshot without trolley fields renders an empty trolley without changing balances', () => {
  const { trolleyWood, trolleyTrip, ...oldProgress } = initialProgress('ko');
  const snapshot = parseServerSnapshot({ revision: 4, provenance: 'server', progress: oldProgress, drops: [] });
  assert.equal(snapshot.progress.trolleyWood, 0);
  assert.equal(snapshot.progress.trolleyTrip, null);
  assert.equal(snapshot.progress.wood, 0);
  assert.equal(snapshot.progress.harvested, 0);
  assert.equal(snapshot.revision, 4);
  assert.throws(() => parseServerSnapshot({ revision: 4, provenance: 'server', progress: { ...oldProgress, wood: 99 } }), /INVALID_SERVER_SNAPSHOT/);
});
