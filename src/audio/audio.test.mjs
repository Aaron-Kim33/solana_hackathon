import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createGameAudio } from './engine.ts';
import { CUES, parseAudioSettings, progressCues, serverCues } from './policy.ts';
import { initialProgress, xpFloor } from '../game/progression.ts';

const tick = () => new Promise(resolve => setImmediate(resolve));
test('boss participation reward cue plays only on a confirmed revision change', () => {
  const before = { revision: 0, progress: initialProgress('ko'), provenance: 'server' };
  for (const type of ['claimWorldBossReward', 'claimWorldBossSharedReward']) {
    const command = { type, stage: 2, weekStart: 0 };
    assert.deepEqual(serverCues(before, before, command), []);
    assert.deepEqual(serverCues(before, { ...before, revision: 1 }, command), ['reward']);
  }
});
function fixture(defer = false) {
  let now = 0;
  const ports = [], seeks = [];
  const engine = createGameAudio((key, variant) => {
    const port = { key, variant, volume: 1, loop: false, playing: false, removed: false, plays: 0,
      play() { assert.equal(this.removed, false); this.playing = true; this.plays++; },
      pause() { this.playing = false; }, remove() { this.removed = true; this.playing = false; },
      seekTo() { return defer ? new Promise(resolve => seeks.push(resolve)) : Promise.resolve(); },
    };
    ports.push(port); return port;
  }, () => now);
  return { engine, ports, seeks, advance: () => { now += 2000; } };
}
test('audio settings are separate, strictly parsed and safe after corruption', () => {
  for (const raw of [null, '{', '{}', '{"version":2,"music":false,"effects":false}', '{"version":1,"music":"false","effects":false}'])
    assert.deepEqual(parseAudioSettings(raw), { music: true, effects: true });
  assert.deepEqual(parseAudioSettings('{"version":1,"music":false,"effects":true}'), { music: false, effects: true });
});
test('confirmed progress events do not sound on no-op, passive hit coins or loading', () => {
  const state = initialProgress('ko');
  assert.deepEqual(progressCues(state, state), []);
  assert.deepEqual(progressCues(state, { ...state, coins: 1, totalHits: 1 }), []);
  assert.deepEqual(progressCues(state, { ...state, treeLevel: 2, coins: 80 }), ['upgrade']);
  assert.deepEqual(progressCues(state, { ...state, xp: xpFloor(2), harvested: 3 }), ['reward']);
  assert.deepEqual(progressCues(state, { ...state, trolleyWood: 10 }), ['load']);
  assert.deepEqual(progressCues(state, { ...state, firstRecordClaimed: true, coins: 100, gems: { ...state.gems, low: 1 } }), ['reward']);
});
test('farm and trolley cues require actual mutations; direct collection differs from unloading', () => {
  const state = initialProgress('ko'), trip = { departedAt: 1, arrivesAt: 3, returnsAt: 5 };
  assert.deepEqual(progressCues(state, { ...state, trolleyTrip: trip }), ['trolley']);
  assert.deepEqual(progressCues({ ...state, trolleyTrip: trip, trolleyWood: 10 }, { ...state, harvested: 10 }), ['unload']);
  assert.deepEqual(progressCues(state, { ...state, harvested: 10 }), ['collect']);
  const farm = { karma: 0, grown: 0, dayStart: 0, plantedToday: 0, plots: [null, null], puzzle: null };
  assert.deepEqual(progressCues({ ...state, farm }, { ...state, farm: { ...farm, plots: [{ plantedAt: 5, readyAt: 10, quick: false }, null] } }), ['plant']);
  assert.deepEqual(progressCues({ ...state, farm }, { ...state, farm: { ...farm, karma: 1, grown: 1 } }), ['magic']);
});
test('gem fusion success and failure, changing axes versus upgrading, are distinguished', () => {
  const state = initialProgress('ko'), before = { ...state, gems: { ...state.gems, low: 3 } };
  assert.deepEqual(progressCues(before, { ...state, gems: { ...state.gems, medium: 1 } }), ['magic']);
  assert.deepEqual(progressCues(before, state), ['unavailable']);
  assert.deepEqual(progressCues(state, { ...state, axeSkin: 'pioneer', axeLevel: 50 }), ['select']);
  assert.deepEqual(progressCues(state, { ...state, axeLevel: 2 }), ['upgrade']);
});
test('server response replay is silent and pet cues reflect the confirmed trip', () => {
  const state = { revision: 3, provenance: 'server', progress: initialProgress('ko'), squirrel: { owned: true, questReady: false, trips: 0, trip: null } };
  const after = { ...state, revision: 4, squirrel: { ...state.squirrel, trip: { departedAt: 1, returnsAt: 5, destination: 'mine', reward: 10 } } };
  assert.deepEqual(serverCues(state, after, { type: 'dispatchSquirrel', destination: 'mine' }), ['pet']);
  assert.deepEqual(serverCues(after, after, { type: 'dispatchSquirrel', destination: 'mine' }), []);
  assert.deepEqual(serverCues(after, { ...state, revision: 5 }, { type: 'collectSquirrel' }), ['coins']);
});
test('forest music survives menus, pauses in background, and is released on scene change/unmount', () => {
  const { engine, ports } = fixture();
  engine.setActive(true); engine.setScene('forest'); engine.setScene('forest');
  assert.equal(ports.length, 1); assert.equal(ports[0].plays, 1);
  engine.setActive(false); assert.equal(ports[0].playing, false);
  engine.setActive(true); assert.equal(ports[0].plays, 2);
  engine.setScene('boss'); assert.equal(ports[0].removed, true); assert.equal(ports[1].key, 'boss');
  engine.dispose(); assert.ok(ports.every(port => port.removed));
});
test('mute and background cancel pending effects; they cannot play later on resume', async () => {
  const { engine, ports, seeks, advance } = fixture(true);
  engine.setActive(true); engine.play('click'); engine.setActive(false); seeks.shift()();
  await tick(); assert.equal(ports[1].plays, 0);
  engine.setActive(true); advance(); engine.play('click'); engine.configure({ music: true, effects: false }); seeks.shift()();
  await tick(); assert.equal(ports[1].plays, 0);
  engine.configure({ music: false, effects: true }); assert.equal(ports[0].playing, false);
  advance(); engine.play('click'); seeks.shift()(); await tick(); assert.equal(ports[1].plays, 1);
  engine.dispose();
});
test('sweep spam is throttled, chop uses three variants, effect cache stays bounded', async () => {
  const { engine, ports, advance } = fixture(); engine.setActive(true);
  for (let i = 0; i < 100; i++) engine.play('load');
  await tick(); assert.equal(ports.filter(port => port.key === 'load').length, 1);
  assert.equal(ports.find(port => port.key === 'load').plays, 1);
  for (let i = 0; i < 6; i++) { advance(); engine.play('chop'); await tick(); }
  assert.deepEqual(ports.filter(port => port.key === 'chop').map(port => port.variant), [0, 1, 2]);
  for (const cue of Object.keys(CUES)) { advance(); engine.play(cue); await tick(); }
  assert.ok(ports.filter(port => !port.removed).length <= 11);
  assert.ok(ports.filter(port => port.playing && port.key !== 'forest').length <= 3);
  engine.dispose(); assert.ok(ports.every(port => port.removed));
});
test('concurrent asynchronous seeks also respect the three-voice limit and disposal', async () => {
  const { engine, ports, seeks, advance } = fixture(true); engine.setActive(true);
  for (const cue of ['click', 'chop', 'load', 'reward', 'pet']) { advance(); engine.play(cue); }
  seeks.splice(0).forEach(resolve => resolve()); await tick();
  assert.ok(ports.filter(port => port.playing && port.key !== 'forest').length <= 3);
  advance(); engine.play('magic'); engine.dispose(); seeks.splice(0).forEach(resolve => resolve()); await tick();
  assert.ok(ports.every(port => port.removed && !port.playing));
});
test('audio failures do not propagate into gameplay', () => {
  const engine = createGameAudio(() => { throw new Error('no native audio'); });
  assert.doesNotThrow(() => { engine.setActive(true); engine.play('click'); engine.setScene('boss'); engine.dispose(); });
});
test('game audio follows media volume in silent mode without enabling recording or background playback', () => {
  const provider = readFileSync(new URL('./GameAudio.tsx', import.meta.url), 'utf8');
  assert.match(provider, /playsInSilentMode: true/);
  assert.match(provider, /allowsRecording: false/);
  assert.match(provider, /shouldPlayInBackground: false/);
});

test('approved upgrade and audible chopping/landing sounds keep other audio levels unchanged', () => {
  const sources = readFileSync(new URL('./sources.ts', import.meta.url), 'utf8');
  assert.ok(sources.includes("upgrade: [require('../../assets/audio/confirmation.ogg')]"));
  assert.ok(sources.includes("drop: [require('../../assets/audio/trolley-load.ogg')]"));
  assert.equal(CUES.chop.volume, 0.8);
  assert.equal(CUES.drop.volume, 0.5);
  assert.equal(CUES.upgrade.volume, 0.22);
  assert.equal(CUES.click.volume, 0.32);
  for (const cue of Object.values(CUES)) assert.ok(cue.volume >= 0 && cue.volume <= 1);
});

test('all bundled sources are real Ogg files and configuration requests no recording/background playback', () => {
  const root = new URL('../../assets/audio/', import.meta.url), sources = readFileSync(new URL('./sources.ts', import.meta.url), 'utf8');
  const files = [...sources.matchAll(/assets\/audio\/([^']+)/g)].map(match => match[1]);
  assert.equal(new Set(files).size, 24);
  const originals = readdirSync(root).filter(name => name.endsWith('.ogg'));
  assert.ok([...new Set(files)].every(name => originals.includes(name)));
  for (const file of files) assert.equal(readFileSync(new URL(file, root)).subarray(0, 4).toString(), 'OggS');
  const config = readFileSync(new URL('../../app.config.js', import.meta.url), 'utf8');
  assert.match(config, /microphonePermission: false/); assert.match(config, /recordAudioAndroid: false/);
  assert.match(config, /enableBackgroundPlayback: false/);
});
