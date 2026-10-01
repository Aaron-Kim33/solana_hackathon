import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SoundPressable as Pressable, useGameAudio } from '../audio/GameAudio';
import type { Progress } from './progression';
import { ForesterSprite } from './ForesterSprite';
import type { GameCommand } from '../shared/server-contract';
import { WORLD_BOSS_WEEKLY_HITS, type WorldBossSnapshot } from '../shared/world-boss';

export function WorldBossWorld({ state, progress, language, command, locked, lastDamage }: {
  state: WorldBossSnapshot; progress: Progress; language: 'ko' | 'en';
  command: (command: GameCommand) => boolean; locked: boolean; lastDamage?: number;
}) {
  const { play: playSound } = useGameAudio();
  const ko = language === 'ko';
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [holding, setHolding] = useState(false);
  const [damageLabel, setDamageLabel] = useState<number | null>(null);
  const priorHits = useRef(state.hits);
  const swing = useRef(new Animated.Value(0)).current;
  const impact = useRef(new Animated.Value(0)).current;
  const damageMotion = useRef(new Animated.Value(0)).current;
  const cameraShake = useRef(new Animated.Value(0)).current;
  const current = useRef({ command, locked, hits: state.hits, fatigue: progress.fatigue });
  current.current = { command, locked, hits: state.hits, fatigue: progress.fatigue };
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; setHolding(false); };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => {
    if (state.hits > priorHits.current && lastDamage !== undefined) {
      playSound('bossHit');
      setDamageLabel(lastDamage);
      impact.stopAnimation(); impact.setValue(0);
      damageMotion.stopAnimation(); damageMotion.setValue(0);
      cameraShake.stopAnimation(); cameraShake.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(impact, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(impact, { toValue: 0, duration: 340, useNativeDriver: true }),
        ]),
        Animated.timing(damageMotion, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(cameraShake, { toValue: 5, duration: 45, useNativeDriver: true }),
          Animated.timing(cameraShake, { toValue: -4, duration: 50, useNativeDriver: true }),
          Animated.timing(cameraShake, { toValue: 0, duration: 90, useNativeDriver: true }),
        ]),
      ]).start();
    }
    priorHits.current = state.hits;
  }, [state.hits, lastDamage, impact, damageMotion, cameraShake, playSound]);
  const playSwing = () => {
    swing.stopAnimation(); swing.setValue(0);
    Animated.sequence([
      Animated.timing(swing, { toValue: 0.25, duration: 140, useNativeDriver: true }),
      Animated.timing(swing, { toValue: 0.5, duration: 100, useNativeDriver: true }),
      Animated.timing(swing, { toValue: 1, duration: 270, useNativeDriver: true }),
    ]).start();
  };
  const attack = () => {
    const value = current.current;
    if (!value.locked && value.hits < WORLD_BOSS_WEEKLY_HITS && value.fatigue < 100)
      if (value.command({ type: 'hitWorldBoss' })) playSwing();
  };
  const start = () => {
    if (timer.current) return;
    setHolding(true);
    attack();
    timer.current = setInterval(attack, 2_000);
  };
  const exhausted = progress.fatigue >= 100;
  const finished = state.hits >= WORLD_BOSS_WEEKLY_HITS;
  useEffect(() => { if (exhausted || finished) stop(); }, [exhausted, finished]);
  return <View style={s.world}>
    <Animated.Image source={require('../../assets/boss/world-boss-forest-v1.png')}
      style={[s.background, { transform: [{ translateX: cameraShake }] }]} resizeMode="stretch" />
    <View pointerEvents="none" style={s.topShade} />
    <Pressable accessibilityRole="button" accessibilityLabel={ko ? '나무 괴물을 길게 눌러 공격' : 'Hold the tree monster to attack'}
      accessibilityState={{ disabled: finished || exhausted }} disabled={finished || exhausted}
      onPressIn={start} onPressOut={stop} style={s.bossTarget} />
    <View pointerEvents="none" style={s.forester}><ForesterSprite motion={swing} skin={progress.axeSkin}
      crowned={progress.wardenRewardsClaimed === 3} size={145} /></View>
    <Animated.View pointerEvents="none" style={[s.impact, { opacity: impact,
      transform: [{ scale: impact.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.35] }) }] }]}>
      <View style={s.impactCore} />
      <View style={[s.impactRay, { transform: [{ rotate: '25deg' }] }]} />
      <View style={[s.impactRay, { transform: [{ rotate: '95deg' }] }]} />
      <View style={[s.impactRay, { transform: [{ rotate: '155deg' }] }]} />
    </Animated.View>
    {damageLabel !== null && <Animated.Text pointerEvents="none" style={[s.floatingDamage, {
      opacity: damageMotion.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
      transform: [{ translateY: damageMotion.interpolate({ inputRange: [0, 1], outputRange: [12, -48] }) }],
    }]}>−{damageLabel.toLocaleString()}</Animated.Text>}
    <View style={s.stats}>
      <Text style={s.title}>{ko ? '고목의 분노' : 'Wrath of the Ancient Tree'}</Text>
      <Text style={s.line}>{ko ? '이번 주 공격' : 'Weekly attacks'}  {state.hits} / {WORLD_BOSS_WEEKLY_HITS}</Text>
      <View style={s.track}><View style={[s.fill, { width: `${state.hits}%` }]} /></View>
      <Text style={s.small}>{ko ? '내 누적 피해' : 'My damage'} {state.damage.toLocaleString()}  ·  {ko ? '피로도' : 'Fatigue'} {progress.fatigue}%</Text>
    </View>
    <View pointerEvents="none" style={[s.holdHint, holding && s.holdHintActive]}>
      <Text style={s.holdHintText}>{finished ? ko ? '이번 주 100타 완료' : '100 weekly hits complete'
        : exhausted ? ko ? '피로도 100% · 회복 후 공격' : 'Fatigue 100% · Recover to attack'
          : holding ? ko ? '도끼질 중!' : 'Chopping!' : ko ? '나무 괴물을 길게 눌러 공격' : 'Hold the monster to attack'}</Text>
    </View>
    <View style={s.bottom}>
      <Text style={s.total}>{ko ? '모두의 누적 피해' : 'Community damage'}  {state.totalDamage.toLocaleString()}</Text>
      <Text style={s.small}>{ko ? `참여자 ${state.participants}명 · 합계 ${state.totalHits}타` : `${state.participants} participants · ${state.totalHits} total hits`}</Text>
      <Text style={s.note}>{ko ? '보상 정산 규칙은 준비 중 · 월요일 UTC 00:00 초기화' : 'Reward settlement coming soon · Resets Monday 00:00 UTC'}</Text>
    </View>
  </View>;
}

const s = StyleSheet.create({
  world: { flex: 1, overflow: 'hidden', backgroundColor: '#0D282C' },
  background: { position: 'absolute', left: '-2%', width: '104%', height: '100%' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 170, backgroundColor: '#09252BD9' },
  bossTarget: { position: 'absolute', top: '23%', bottom: 125, left: 0, right: 0, zIndex: 1 },
  forester: { position: 'absolute', left: '11%', bottom: 119, width: 145, height: 145, zIndex: 2 },
  impact: { position: 'absolute', left: '52%', bottom: '27%', width: 70, height: 70, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  impactCore: { width: 30, height: 30, borderRadius: 6, backgroundColor: '#FFF0B1', transform: [{ rotate: '45deg' }], borderWidth: 4, borderColor: '#F6B75E' },
  impactRay: { position: 'absolute', width: 76, height: 5, borderRadius: 3, backgroundColor: '#FFE7A4' },
  floatingDamage: { position: 'absolute', left: '52%', bottom: '37%', color: '#FFE5A0', fontSize: 27, fontWeight: '900', textShadowColor: '#3D2619', textShadowRadius: 6, zIndex: 4 },
  stats: { marginHorizontal: 15, marginTop: 14, padding: 14, borderRadius: 18, backgroundColor: '#102C31DB', borderColor: '#B68B61', borderWidth: 1 },
  title: { color: '#FFE0A4', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  line: { color: '#FFF2D1', fontSize: 15, fontWeight: '800' },
  track: { height: 9, borderRadius: 6, backgroundColor: '#42615A', overflow: 'hidden', marginTop: 8, marginBottom: 7 },
  fill: { height: '100%', backgroundColor: '#E6AC70' },
  small: { color: '#D4DFD4', fontSize: 12, fontWeight: '700' },
  holdHint: { position: 'absolute', bottom: 129, alignSelf: 'center', borderRadius: 13, backgroundColor: '#173B3BCF', borderColor: '#E4BF78', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, zIndex: 4 },
  holdHintActive: { backgroundColor: '#8B5E2FD9' },
  holdHintText: { color: '#FFF1C6', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  bottom: { position: 'absolute', bottom: 20, left: 15, right: 15, padding: 15, gap: 8, borderRadius: 19, backgroundColor: '#0B282DEB', borderWidth: 1, borderColor: '#B68B61', zIndex: 5 },
  total: { color: '#FFF0C9', fontSize: 17, fontWeight: '900' },
  note: { color: '#BFD2C8', fontSize: 11, textAlign: 'center' },
});
