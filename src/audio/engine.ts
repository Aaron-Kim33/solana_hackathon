import { CUES, type AudioSettings, type SoundCue } from './policy.ts';
export type AudioPort = { playing: boolean; volume: number; loop: boolean;
  play(): void; pause(): void; seekTo(seconds: number): Promise<void>; remove(): void };
export type AudioScene = 'forest' | 'boss';
type Factory = (key: SoundCue | AudioScene, variant: number) => AudioPort;
// One music player, at most 10 cached effect players, never one player/log.
export function createGameAudio(factory: Factory, clock = Date.now) {
  let active = false, disposed = false, scene: AudioScene = 'forest';
  let settings: AudioSettings = { music: true, effects: true };
  let music: AudioPort | null = null, musicScene: AudioScene | null = null;
  let serial = 0, chopVariant = 0;
  const effects = new Map<string, { port: AudioPort; used: number; ticket: number; group: string; pending: boolean }>();
  const lastGroup = new Map<string, number>();
  const safe = (action: () => void) => { try { action(); } catch { /* Sound never blocks gameplay. */ } };
  function pauseEffects() { for (const effect of effects.values()) { effect.ticket = ++serial; effect.pending = false; safe(() => effect.port.pause()); } }
  function syncMusic() {
    if (disposed) return;
    if (!active || !settings.music) { if (music) safe(() => music!.pause()); return; }
    safe(() => {
      if (musicScene !== scene) {
        music?.pause(); music?.remove(); music = null;
        music = factory(scene, 0); music.loop = true; music.volume = scene === 'boss' ? 0.13 : 0.18; musicScene = scene;
      }
      if (music && !music.playing) music.play();
    });
  }
  return {
    play(cue: SoundCue) {
      if (!active || disposed || !settings.effects) return;
      const spec = CUES[cue], now = clock();
      if (now - (lastGroup.get(spec.group) ?? -Infinity) < spec.gap) return;
      lastGroup.set(spec.group, now);
      safe(() => {
        const variant = cue === 'chop' ? chopVariant++ % 3 : 0, key = `${cue}:${variant}`;
        let effect = effects.get(key);
        if (!effect) {
          if (effects.size >= 10) {
            const oldest = [...effects.entries()].sort((a, b) => a[1].used - b[1].used)[0];
            oldest[1].ticket = ++serial; oldest[1].port.pause(); oldest[1].port.remove(); effects.delete(oldest[0]);
          }
          effect = { port: factory(cue, variant), used: now, ticket: 0, group: spec.group, pending: false }; effects.set(key, effect);
        }
        for (const other of effects.values()) if (other !== effect && other.group === spec.group) { other.ticket = ++serial; other.pending = false; other.port.pause(); }
        const playing = [...effects.values()].filter(other => other !== effect && (other.pending || other.port.playing)).sort((a, b) => a.used - b.used);
        while (playing.length >= 3) { const old = playing.shift()!; old.ticket = ++serial; old.pending = false; old.port.pause(); }
        const current = effect, ticket = ++serial;
        current.used = now; current.ticket = ticket; current.pending = true; current.port.volume = spec.volume; current.port.pause();
        void current.port.seekTo(0).then(() => {
          if (current.ticket === ticket) { current.pending = false; if (active && !disposed && settings.effects) safe(() => current.port.play()); }
        }).catch(() => { if (current.ticket === ticket) current.pending = false; });
      });
    },
    setActive(value: boolean) { active = value; if (!value) { pauseEffects(); lastGroup.clear(); } syncMusic(); },
    setScene(value: AudioScene) { scene = value; syncMusic(); },
    configure(value: AudioSettings) { settings = value; if (!value.effects) pauseEffects(); syncMusic(); },
    dispose() {
      disposed = true; pauseEffects(); for (const effect of effects.values()) safe(() => effect.port.remove());
      effects.clear(); if (music) safe(() => { music!.pause(); music!.remove(); }); music = null;
    },
  };
}
