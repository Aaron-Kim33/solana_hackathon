import { useEffect, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Progress } from './progression';
import type { GameCommand } from '../shared/server-contract';
import { WORLD_BOSS_WEEKLY_HITS, type WorldBossSnapshot } from '../shared/world-boss';

export function WorldBossWorld({ state, progress, language, command, locked, lastDamage }: {
  state: WorldBossSnapshot; progress: Progress; language: 'ko' | 'en';
  command: (command: GameCommand) => boolean; locked: boolean; lastDamage?: number;
}) {
  const ko = language === 'ko';
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const current = useRef({ command, locked, hits: state.hits, fatigue: progress.fatigue });
  current.current = { command, locked, hits: state.hits, fatigue: progress.fatigue };
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  useEffect(() => stop, []);
  const attack = () => {
    const value = current.current;
    if (!value.locked && value.hits < WORLD_BOSS_WEEKLY_HITS && value.fatigue < 100)
      value.command({ type: 'hitWorldBoss' });
  };
  const start = () => {
    if (timer.current) return;
    attack();
    timer.current = setInterval(attack, 2_000);
  };
  const exhausted = progress.fatigue >= 100;
  const finished = state.hits >= WORLD_BOSS_WEEKLY_HITS;
  useEffect(() => { if (exhausted || finished) stop(); }, [exhausted, finished]);
  return <View style={s.world}>
    <Image source={require('../../assets/boss/world-boss-forest-v1.png')} style={s.background} resizeMode="stretch" />
    <View pointerEvents="none" style={s.topShade} />
    <View style={s.stats}>
      <Text style={s.title}>{ko ? '고목의 분노' : 'Wrath of the Ancient Tree'}</Text>
      <Text style={s.line}>{ko ? '이번 주 공격' : 'Weekly attacks'}  {state.hits} / {WORLD_BOSS_WEEKLY_HITS}</Text>
      <View style={s.track}><View style={[s.fill, { width: `${state.hits}%` }]} /></View>
      <Text style={s.small}>{ko ? '내 누적 피해' : 'My damage'} {state.damage.toLocaleString()}  ·  {ko ? '피로도' : 'Fatigue'} {progress.fatigue}%</Text>
    </View>
    <View style={s.bottom}>
      {lastDamage !== undefined && <Text style={s.damage}>{ko ? '마지막 공격' : 'Last strike'}  −{lastDamage.toLocaleString()}</Text>}
      <Text style={s.total}>{ko ? '모두의 누적 피해' : 'Community damage'}  {state.totalDamage.toLocaleString()}</Text>
      <Text style={s.small}>{ko ? `참여자 ${state.participants}명 · 합계 ${state.totalHits}타` : `${state.participants} participants · ${state.totalHits} total hits`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={ko ? '월드보스 공격 길게 누르기' : 'Hold to attack world boss'}
        accessibilityState={{ disabled: finished || exhausted }} disabled={finished || exhausted}
        onPressIn={start} onPressOut={stop} style={[s.attack, (finished || exhausted) && s.disabled]}>
        <Text style={s.attackText}>{finished ? ko ? '이번 주 100타 완료' : '100 weekly hits complete'
          : exhausted ? ko ? '피로도 100% · 회복 후 공격' : 'Fatigue 100% · Recover to attack'
            : ko ? '🪓 길게 눌러 공격 · 2초/타' : '🪓 Hold to attack · 2s/hit'}</Text>
      </Pressable>
      <Text style={s.note}>{ko ? '보상 정산 규칙은 준비 중 · 월요일 UTC 00:00 초기화' : 'Reward settlement coming soon · Resets Monday 00:00 UTC'}</Text>
    </View>
  </View>;
}

const s = StyleSheet.create({
  world: { flex: 1, overflow: 'hidden', backgroundColor: '#0D282C' },
  background: { position: 'absolute', width: '100%', height: '100%' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 170, backgroundColor: '#09252BD9' },
  stats: { marginHorizontal: 15, marginTop: 14, padding: 14, borderRadius: 18, backgroundColor: '#102C31DB', borderColor: '#B68B61', borderWidth: 1 },
  title: { color: '#FFE0A4', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  line: { color: '#FFF2D1', fontSize: 15, fontWeight: '800' },
  track: { height: 9, borderRadius: 6, backgroundColor: '#42615A', overflow: 'hidden', marginTop: 8, marginBottom: 7 },
  fill: { height: '100%', backgroundColor: '#E6AC70' },
  small: { color: '#D4DFD4', fontSize: 12, fontWeight: '700' },
  bottom: { position: 'absolute', bottom: 20, left: 15, right: 15, padding: 15, gap: 8, borderRadius: 19, backgroundColor: '#0B282DEB', borderWidth: 1, borderColor: '#B68B61' },
  total: { color: '#FFF0C9', fontSize: 17, fontWeight: '900' },
  damage: { color: '#FFD080', fontSize: 14, fontWeight: '900' },
  attack: { minHeight: 57, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#D49A60', marginTop: 4 },
  disabled: { backgroundColor: '#68736B' },
  attackText: { color: '#203130', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  note: { color: '#BFD2C8', fontSize: 11, textAlign: 'center' },
});
