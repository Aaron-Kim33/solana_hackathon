import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SoundPressable as Pressable, useGameAudio } from '../audio/GameAudio';
import type { Progress } from './progression';
import { ForesterSprite } from './ForesterSprite';
import { ServerActionNotice, type ServerActionNoticeProps } from './ServerActionNotice';
import type { GameCommand } from '../shared/server-contract';
import { WORLD_BOSS_WEEKLY_HITS, WORLD_BOSS_SHARED_MIN_HITS, type WorldBossSnapshot } from '../shared/world-boss';
import { WeeklyRankingButton } from './WeeklyRankingButton';
import type { LoadWeeklyRanking } from '../shared/weekly-ranking';

export function WorldBossWorld({ state, progress, language, command, locked, lastDamage, onRefresh, actionNotice, loadRanking, initialRewardsOpen = false }: {
  state: WorldBossSnapshot; progress: Progress; language: 'ko' | 'en';
  command: (command: GameCommand) => boolean; locked: boolean; lastDamage?: number; onRefresh?: () => void; actionNotice?: ServerActionNoticeProps;
  initialRewardsOpen?: boolean;
  loadRanking: LoadWeeklyRanking;
}) {
  const { play: playSound } = useGameAudio();
  const ko = language === 'ko';
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [holding, setHolding] = useState(false);
  const [rewardsOpen, setRewardsOpen] = useState(initialRewardsOpen);
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
  const sharedGoals = state.sharedRewards?.filter(item => item.weekStart === state.weekStart);
  const nextShared = sharedGoals?.find(item => item.totalDamage < item.target);
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
      <View style={s.rankRow}><Text style={[s.line, { flex: 1 }]}>{ko ? '이번 주 공격' : 'Weekly attacks'}  {state.hits} / {WORLD_BOSS_WEEKLY_HITS}</Text>
        <WeeklyRankingButton category="world-boss" language={language} load={loadRanking} beforeOpen={stop} /></View>
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
      <Pressable accessibilityRole="button" onPress={() => { stop(); setRewardsOpen(true); onRefresh?.(); }} style={s.rewardButton}>
        <Text style={s.rewardButtonText}>{ko ? '🎁 주간 참여 보상' : '🎁 Weekly participation rewards'}</Text>
        {(state.rewards?.some(item => item.ready && !item.claimed) || state.sharedRewards?.some(item => item.ready && !item.claimed)) && <View pointerEvents="none" style={s.rewardDot} />}
      </Pressable>
      <Text style={s.note}>{sharedGoals ? nextShared ? ko ? `다음 공동 목표 · ${nextShared.target.toLocaleString()} 피해` : `Next community goal · ${nextShared.target.toLocaleString()} damage`
        : ko ? '공동 목표 3단계 모두 달성!' : 'All three community goals reached!'
        : ko ? '월요일 UTC 00:00 · 공격 횟수 초기화' : 'Attacks reset Monday 00:00 UTC'}</Text>
    </View>
    <Modal visible={rewardsOpen} transparent animationType="fade" onRequestClose={() => setRewardsOpen(false)}>
      <View style={s.rewardBackdrop}><View style={s.rewardSheet}>
        <View style={s.rewardHeader}><Text style={s.rewardTitle}>{ko ? '주간 참여 보상' : 'Weekly rewards'}</Text>
          <View style={s.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={ko ? '공동 피해와 보상 새로고침' : 'Refresh community damage and rewards'} disabled={locked || !onRefresh} onPress={onRefresh} style={[s.close, locked && s.disabled]}><Text style={s.refreshText}>↻</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={ko ? '닫기' : 'Close'} onPress={() => setRewardsOpen(false)} style={s.close}><Text style={s.small}>✕</Text></Pressable>
          </View></View>
        {actionNotice && <ServerActionNotice {...actionNotice} />}
        <Text style={s.note}>{ko ? '20 · 50 · 100타마다 한 번씩 받아요. 피해량 순위와 무관해요.' : 'One reward at 20, 50 and 100 hits. No damage ranking required.'}</Text>
        <ScrollView style={s.rewardScroll} contentContainerStyle={s.rewardList}>
          <Text style={s.sectionTitle}>{ko ? '함께 달성한 공동 보상' : 'Community damage rewards'}</Text>
          <Text style={s.note}>{ko ? '이번 주 20타 이상 참여하면 모두 같은 보상을 받아요.' : 'Everyone with 20 weekly attacks earns the same unlocked rewards.'}</Text>
          {state.sharedRewards === undefined ? <Text style={s.small}>{ko ? '공동 보상 정보를 불러오지 못했어요. 다시 연결해 주세요.' : 'Community reward data is unavailable. Please reconnect.'}</Text>
            : state.sharedRewards.map(item => <View key={`shared:${item.weekStart}:${item.stage}`} style={s.rewardRow}>
              <View style={s.rewardDescription}>
                <Text style={s.line}>{item.weekStart === state.weekStart ? ko ? '이번 주' : 'This week' : `${new Date(item.weekStart).toISOString().slice(5, 10)} UTC`} · {ko ? `${item.stage + 1}단계` : `Tier ${item.stage + 1}`}</Text>
                <Text style={s.rewardDetail}>{item.mediumGems ? ko ? '중급 보석 1개' : '1 medium-tier gem' : ko ? `하급 보석 ${item.lowGems}개` : `${item.lowGems} low-tier gems`}</Text>
                <Text style={s.small}>{Math.floor(item.totalDamage).toLocaleString()} / {item.target.toLocaleString()} {ko ? '피해' : 'damage'}</Text>
                <View style={s.sharedTrack}><View style={[s.fill, { width: `${Math.min(100, item.totalDamage / item.target * 100)}%` }]} /></View>
                {item.myHits < WORLD_BOSS_SHARED_MIN_HITS && <Text style={s.note}>{ko ? `내 참여 ${item.myHits}/${WORLD_BOSS_SHARED_MIN_HITS}타` : `My participation ${item.myHits}/${WORLD_BOSS_SHARED_MIN_HITS} hits`}</Text>}
              </View>
              <Pressable accessibilityRole="button" disabled={locked || !item.ready || item.claimed}
                onPress={() => command({ type: 'claimWorldBossSharedReward', stage: item.stage, weekStart: item.weekStart })}
                style={[s.claim, (locked || !item.ready || item.claimed) && s.disabled]}>
                <Text style={s.claimText}>{item.claimed ? ko ? '수령 완료' : 'Claimed' : item.ready ? ko ? '받기' : 'Claim'
                  : item.myHits < WORLD_BOSS_SHARED_MIN_HITS ? ko ? '20타 필요' : 'Need 20 hits' : ko ? '목표 진행 중' : 'Goal pending'}</Text>
              </Pressable>
            </View>)}
          <Text style={s.sectionTitle}>{ko ? '내 참여 보상' : 'My participation rewards'}</Text>
          {state.rewards === undefined ? <Text style={s.small}>{ko ? '보상 정보를 불러오지 못했어요. 다시 연결해 주세요.' : 'Reward data is unavailable. Please reconnect.'}</Text>
            : state.rewards.map(item => <View key={`${item.weekStart}:${item.stage}`} style={s.rewardRow}>
              <View style={s.rewardDescription}><Text style={s.line}>{item.weekStart === state.weekStart ? ko ? '이번 주' : 'This week' : `${new Date(item.weekStart).toISOString().slice(5, 10)} UTC`} · {item.target}{ko ? '타' : ' hits'}</Text>
                <Text style={s.rewardDetail}>{item.lowGems ? ko ? '하급 보석 1개' : '1 low-tier gem' : item.potions ? ko ? '피로회복제 1개' : '1 fatigue potion'
                  : item.treeLevel > 0 ? `${item.coins.toLocaleString()} ${ko ? '코인' : 'coins'}` : ko ? '첫 공격 고목 레벨 × 20 코인' : 'Tree level at first attack × 20 coins'}</Text>
              </View>
              <Pressable accessibilityRole="button" disabled={locked || !item.ready || item.claimed}
                onPress={() => command({ type: 'claimWorldBossReward', stage: item.stage, weekStart: item.weekStart })}
                style={[s.claim, (locked || !item.ready || item.claimed) && s.disabled]}>
                <Text style={s.claimText}>{item.claimed ? ko ? '수령 완료' : 'Claimed' : item.ready ? ko ? '받기' : 'Claim' : ko ? '진행 중' : 'In progress'}</Text>
              </Pressable>
            </View>)}
        </ScrollView>
        <Text style={s.note}>{state.rewardTreeLevel == null ? ko ? '코인은 이번 주 첫 공격의 고목 레벨로 고정돼요.' : 'Coins are locked to your tree level at the first attack this week.'
          : ko ? `이번 주 코인 기준: 고목 Lv.${state.rewardTreeLevel}` : `This week's coin basis: tree Lv.${state.rewardTreeLevel}`}</Text>
        <Text style={s.note}>{ko ? '달성한 미수령 보상은 다음 주에도 남아요.' : 'Earned, unclaimed rewards remain available next week.'}</Text>
        <Text style={s.note}>{ko ? '월요일 UTC 00:00에 새 목표 · 주중 목표는 고정돼요.' : 'New goals Monday 00:00 UTC. Targets stay fixed during the week.'}</Text>
      </View></View>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  world: { flex: 1, overflow: 'hidden', backgroundColor: '#0D282C' },
  background: { position: 'absolute', left: '-2%', width: '104%', height: '100%' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 170, backgroundColor: '#09252BD9' },
  bossTarget: { position: 'absolute', top: '23%', bottom: 178, left: 0, right: 0, zIndex: 1 },
  forester: { position: 'absolute', left: '11%', bottom: 172, width: 145, height: 145, zIndex: 2 },
  impact: { position: 'absolute', left: '52%', bottom: '27%', width: 70, height: 70, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  impactCore: { width: 30, height: 30, borderRadius: 6, backgroundColor: '#FFF0B1', transform: [{ rotate: '45deg' }], borderWidth: 4, borderColor: '#F6B75E' },
  impactRay: { position: 'absolute', width: 76, height: 5, borderRadius: 3, backgroundColor: '#FFE7A4' },
  floatingDamage: { position: 'absolute', left: '52%', bottom: '37%', color: '#FFE5A0', fontSize: 27, fontWeight: '900', textShadowColor: '#3D2619', textShadowRadius: 6, zIndex: 4 },
  stats: { marginHorizontal: 15, marginTop: 14, padding: 14, borderRadius: 18, backgroundColor: '#102C31DB', borderColor: '#B68B61', borderWidth: 1, zIndex: 5 },
  title: { color: '#FFE0A4', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  line: { color: '#FFF2D1', fontSize: 15, fontWeight: '800' },
  track: { height: 9, borderRadius: 6, backgroundColor: '#42615A', overflow: 'hidden', marginTop: 8, marginBottom: 7 },
  fill: { height: '100%', backgroundColor: '#E6AC70' },
  small: { color: '#D4DFD4', fontSize: 12, fontWeight: '700' },
  holdHint: { position: 'absolute', bottom: 182, alignSelf: 'center', borderRadius: 13, backgroundColor: '#173B3BCF', borderColor: '#E4BF78', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, zIndex: 4 },
  holdHintActive: { backgroundColor: '#8B5E2FD9' },
  holdHintText: { color: '#FFF1C6', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  bottom: { position: 'absolute', bottom: 20, left: 15, right: 15, padding: 15, gap: 8, borderRadius: 19, backgroundColor: '#0B282DEB', borderWidth: 1, borderColor: '#B68B61', zIndex: 5 },
  total: { color: '#FFF0C9', fontSize: 17, fontWeight: '900' },
  note: { color: '#BFD2C8', fontSize: 11, textAlign: 'center' },
  rewardButton: { minHeight: 44, borderRadius: 12, backgroundColor: '#EAC471', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  rewardButtonText: { color: '#453822', fontSize: 13, fontWeight: '900' },
  rewardDot: { position: 'absolute', right: 10, top: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: '#FFF064', borderWidth: 1, borderColor: '#6B4B20' },
  rewardBackdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: '#00000099' },
  rewardSheet: { maxHeight: '80%', borderRadius: 22, padding: 16, gap: 12, backgroundColor: '#143B3B', borderWidth: 1, borderColor: '#D8BE78' },
  rewardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row' }, refreshText: { color: '#FFE0A4', fontSize: 24 },
  rewardTitle: { color: '#FFE0A4', fontSize: 19, fontWeight: '900' }, close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  rewardList: { gap: 10 }, rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#254B43' },
  rewardScroll: { flexShrink: 1 }, sectionTitle: { color: '#FFE0A4', fontSize: 14, fontWeight: '900', marginTop: 4 },
  sharedTrack: { height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: '#42615A' },
  rewardDescription: { flex: 1, gap: 5 }, rewardDetail: { color: '#FFE1A2', fontSize: 12, fontWeight: '700' },
  claim: { minWidth: 80, minHeight: 44, borderRadius: 10, backgroundColor: '#EAC471', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  claimText: { color: '#453822', fontSize: 12, fontWeight: '900' }, disabled: { opacity: 0.45 },
});
