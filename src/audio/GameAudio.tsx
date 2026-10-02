import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Pressable, Text, View, type PressableProps } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { createGameAudio, type AudioScene } from './engine';
import { AUDIO_SOURCES } from './sources';
import { parseAudioSettings, type AudioSettings, type SoundCue } from './policy';
type Controller = { play: (cue: SoundCue) => void; scene: (value: AudioScene) => void;
  settings: AudioSettings; toggle: (key: keyof AudioSettings) => void; available: boolean | null; saveFailed: boolean };
const Context = createContext<Controller>({ play: () => {}, scene: () => {}, settings: { music: true, effects: true }, toggle: () => {}, available: null, saveFailed: false });
const settingsFile = () => new File(Paths.document, 'lumber-rush-audio-v1.json');
export function GameAudioProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(() => { try { const file = settingsFile(); return parseAudioSettings(file.exists ? file.textSync() : null); } catch { return parseAudioSettings(null); } });
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const [available, setAvailable] = useState<boolean | null>(null), [saveFailed, setSaveFailed] = useState(false);
  const engine = useRef<ReturnType<typeof createGameAudio> | null>(null), sceneRef = useRef<AudioScene>('forest');
  useEffect(() => {
    let disposed = false;
    // Old dev clients may lack the native module. Keep gameplay usable and
    // display a rebuild hint rather than failing the game render.
    void (async () => {
      try {
        const native: typeof import('expo-audio') = require('expo-audio');
        // Media volume and in-game toggles govern audio, not the phone ringer mode.
        await native.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true,
          shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' });
        if (disposed) return;
        const next = createGameAudio((key, variant) => native.createAudioPlayer(AUDIO_SOURCES[key][variant], { updateInterval: 1000 }));
        engine.current = next; next.configure(settingsRef.current); next.setScene(sceneRef.current);
        next.setActive(AppState.currentState === 'active'); setAvailable(true);
      } catch { if (!disposed) setAvailable(false); }
    })();
    const subscription = AppState.addEventListener('change', state => engine.current?.setActive(state === 'active'));
    return () => { disposed = true; subscription.remove(); engine.current?.dispose(); engine.current = null; };
  }, []);
  const play = useCallback((cue: SoundCue) => engine.current?.play(cue), []);
  const scene = useCallback((value: AudioScene) => { sceneRef.current = value; engine.current?.setScene(value); }, []);
  const controller = useMemo<Controller>(() => ({ settings, available, saveFailed, play, scene,
    toggle: key => {
      const next = { ...settingsRef.current, [key]: !settingsRef.current[key] };
      settingsRef.current = next; engine.current?.configure(next); setSettings(next);
      try { settingsFile().write(JSON.stringify({ version: 1, ...next })); setSaveFailed(false); } catch { setSaveFailed(true); }
      if (next.effects) engine.current?.play('select');
    },
  }), [settings, available, saveFailed, play, scene]);
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export const useGameAudio = () => useContext(Context);
// No sounds on drag moves, canceled presses or disabled controls.
export function SoundPressable({ sound = 'click', onPress, ...props }: PressableProps & { sound?: SoundCue | false }) {
  const audio = useGameAudio();
  return <Pressable {...props} onPress={onPress ? event => { if (!props.disabled && sound) audio.play(sound); onPress(event); } : undefined} />;
}
export function AudioSettingsControls({ language }: { language: 'ko' | 'en' }) {
  const audio = useGameAudio(), ko = language === 'ko';
  return <View style={{ gap: 8 }}>
    {(['music', 'effects'] as const).map(key => <SoundPressable key={key} sound={false} accessibilityRole="switch"
      accessibilityState={{ checked: audio.settings[key] }} onPress={() => audio.toggle(key)}
      style={{ minHeight: 44, padding: 12, borderRadius: 10, backgroundColor: '#29524C' }}>
      <Text style={{ color: '#E6EFDD', fontWeight: '700' }}>{key === 'music' ? ko ? '배경음' : 'Music' : ko ? '효과음' : 'Sound effects'} · {audio.settings[key] ? 'ON' : 'OFF'}</Text>
    </SoundPressable>)}
    {audio.available === false && <Text style={{ color: '#FFD18E' }}>{ko ? '소리를 사용하려면 새 개발 앱/APK가 필요해요.' : 'Audio needs an updated development client / APK.'}</Text>}
    {audio.saveFailed && <Text style={{ color: '#FFD18E' }}>{ko ? '소리 설정을 저장하지 못했어요. 이번 실행에는 적용돼요.' : 'Could not save audio settings. They apply for this session.'}</Text>}
    <Text style={{ color: '#ADC5BC', fontSize: 11 }}>CC0 audio · Bobjt / congusbongus / Kenney / JaggedStone / angeloyazar</Text>
  </View>;
}
