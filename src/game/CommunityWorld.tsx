import { useEffect, useRef, useState } from 'react';
import { Animated, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SoundPressable as Pressable } from '../audio/GameAudio';
import type { CommunityFacilityId, CommunityQuestId, CommunitySnapshot } from '../shared/community';
import { COMMUNITY_MIN_CONTRIBUTION } from '../shared/community';
import type { GameCommand } from '../shared/server-contract';
import type { SquirrelSnapshot } from '../shared/pets';
import { SquirrelExpedition } from './SquirrelExpedition';
import { CommunityLifeTree } from './CommunityLifeTree';
import { lifeTreeStage } from './community-presentation';
import { communityLevelUps, communityNextAction, confirmedContributions, facilityNeeds, facilityRewardPreview, facilityStage } from './community-presentation';

const LABELS: Record<CommunityQuestId, { ko: string; en: string }> = {
  d_hits: { ko: '벌목 20회', en: 'Chop 20 times' }, d_bundles: { ko: '목재 묶음 5개 확보', en: 'Secure 5 bundles' },
  d_trolley: { ko: '트롤리 2회 출발', en: 'Dispatch trolley twice' }, w_hits: { ko: '벌목 100회', en: 'Chop 100 times' },
  w_bundles: { ko: '목재 묶음 25개 확보', en: 'Secure 25 bundles' }, w_trolley: { ko: '트롤리 8회 출발', en: 'Dispatch trolley 8 times' },
};

export function CommunityWorld({ state, pet, now, language, command, locked, treeLevel }: { state: CommunitySnapshot;
  pet?: SquirrelSnapshot; now: number; treeLevel: number; language: 'ko' | 'en';
  command: (command: GameCommand) => boolean; locked: boolean }) {
  const ko = language === 'ko';
  const petVisible = !!pet && (!pet.owned || !pet.trip || now >= pet.trip.returnsAt);
  const nextAction = communityNextAction(state, pet, now);
  const actionHint = nextAction === 'collect-pet' ? ko ? '다람쥐가 돌아왔어요! 눌러서 보상을 받아요.' : 'Your squirrel is back! Tap it to collect.'
    : nextAction === 'first-contribution' ? ko ? '첫 자재예요! 광산·묘목길을 눌러 보태 보세요.' : 'Your first materials! Tap either facility to contribute.'
    : nextAction === 'claim-pet' ? ko ? '첫 동료가 기다려요! 다람쥐를 눌러 받아요.' : 'Your first companion is ready! Tap the squirrel to claim.'
    : nextAction === 'first-trip' ? ko ? '시설을 키우면 탐험 보상도 UP! 다람쥐를 보내 볼까요?' : 'Growing facilities boosts trip rewards! Send your squirrel?'
    : nextAction === 'claim-materials' ? ko ? '완료한 자재 퀘스트가 있어요! 보상을 받아요.' : 'A material quest is ready! Collect your reward.'
    : nextAction === 'contribute' ? ko ? '모은 자재를 시설에 보태 숲을 키워요.' : 'Contribute your materials to grow our forest.'
    : nextAction === 'get-materials' ? ko ? '자재 퀘스트부터! 함께 시설을 키워요.' : 'Start with material quests and grow our facilities.' : null;
  const [selected, setSelected] = useState<CommunityFacilityId | 'quests' | 'pet' | 'life-tree' | null>(null);
  const [celebration, setCelebration] = useState<{ id: CommunityFacilityId; level: number }[]>([]);
  const [firstContribution, setFirstContribution] = useState(false);
  const previous = useRef(state);
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const reset = previous.current.weekStart !== state.weekStart;
    const gained = communityLevelUps(previous.current, state);
    const donated = confirmedContributions(previous.current, state);
    const firstDonation = donated.length > 0 && previous.current.myContribution === 0;
    previous.current = state;
    // Return to the scene only after the server confirms the contribution,
    // so the facility sheet does not cover the tree's response.
    if (donated.length) setSelected(current => current === 'mine' || current === 'saplings' ? null : current);
    if (reset) { setCelebration([]); setFirstContribution(false); }
    if (firstDonation) { setFirstContribution(true); setCelebration([]); }
    if (gained.length) { setFirstContribution(false); setCelebration(gained.map(({ id, level }) => ({ id, level }))); }
  }, [state]);
  useEffect(() => {
    if (!celebration.length && !firstContribution) { celebrationOpacity.setValue(0); return; }
    celebrationOpacity.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(celebrationOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(2400),
      Animated.timing(celebrationOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [celebration, firstContribution, celebrationOpacity]);
  const facility = state.facilities.find(item => item.id === selected);
  const reward = facility ? facilityRewardPreview(facility, treeLevel) : null;
  const needs = facility ? facilityNeeds(facility) : null;
  const name = (id: CommunityFacilityId) => id === 'mine' ? ko ? '광산' : 'Mine' : ko ? '묘목길' : 'Sapling path';
  if (state.facilities.some(item => !Number.isInteger(item.contributors)))
    return <View style={s.fallback}><Text style={s.title}>{ko ? '공동 숲을 불러오지 못했어요' : 'Forest unavailable'}</Text>
      <Text style={s.small}>{ko ? '다시 연결해 주세요. 계속되면 최신 앱인지 확인해 주세요.' : 'Reconnect and try again. If this continues, check for an app update.'}</Text></View>;
  return <View style={s.world}>
    <Image source={require('../../assets/community/community-clearing-v1.png')} style={s.background} resizeMode="stretch" />
    <View pointerEvents="none" style={s.topShade} />
    <View style={s.status}><Text style={s.statusText}>✦ {ko ? '내 자재' : 'My materials'} {state.materials}</Text>
      <Text style={s.small}>{ko ? '이번 주 내 기여' : 'My contribution this week'} {state.myContribution}</Text>
      <Text style={s.small}>{ko ? '생명나무' : 'Life tree'} · {(ko ? ['새싹', '어린 나무', '풍성한 나무'] : ['Sprout', 'Young tree', 'Lush tree'])[lifeTreeStage(state)]} · {ko ? '시설 성장과 함께 자라요' : 'Grows with our facilities'}</Text></View>
    {state.facilities.map(item => <Pressable key={item.id} accessibilityRole="button"
      accessibilityLabel={`${name(item.id)} Lv.${item.level} · ${ko ? '기여하기' : 'Contribute'}`}
      onPress={() => setSelected(item.id)} style={[s.landmark, item.id === 'mine' ? s.mine : s.saplings]}>
      <View pointerEvents="none" style={[s.facilityGlow, item.id === 'saplings' && s.saplingGlow, { opacity: (item.level - 1) * 0.12 }]} />
      <View pointerEvents="none" style={s.growthAccents}>
        {Array.from({ length: Math.max(0, Math.min(4, item.level - 1)) }, (_, index) => item.id === 'mine'
          ? <View key={index} style={[s.ore, { height: 12 + index * 3, backgroundColor: index % 2 ? '#C5E5D2' : '#F3CE77' }]} />
          : <View key={index} style={[s.sprout, { height: 20 + index * 4 }]}><View style={s.leafLeft} /><View style={s.leafRight} />{item.level >= 4 && <View style={s.flower} />}</View>)}
      </View>
      <View style={[s.landmarkLabel, nextAction === 'first-contribution' && s.nextTarget]}><Text style={s.landmarkName}>{item.id === 'mine' ? '⛏ ' : '🌱 '}{name(item.id)} · Lv.{item.level}</Text>
        <Text style={s.stage}>{facilityStage(item, language)}</Text>
        <Text style={s.landmarkHint}>{nextAction === 'first-contribution' ? item.id === 'mine' ? ko ? '탐험 코인 ↑ · 눌러 보태기' : 'Trip coins ↑ · Tap to contribute' : ko ? '탐험 목재 ↑ · 눌러 보태기' : 'Trip wood ↑ · Tap to contribute' : ko ? '눌러서 보태기' : 'Tap to contribute'}</Text></View>
    </Pressable>)}
    <CommunityLifeTree state={state} language={language} onPress={() => setSelected('life-tree')} />
    {pet && petVisible && <Pressable accessibilityRole="button" accessibilityLabel={ko ? '다람쥐 탐험 보기' : 'View squirrel expeditions'}
      onPress={() => setSelected('pet')} style={s.petSpot}>
      <Image source={require('../../assets/pets/squirrel-v1.png')} style={s.petArt} resizeMode="contain" />
      <Text style={s.petSpotLabel}>{nextAction === 'collect-pet' ? ko ? '보상 받기 ●' : 'Collect ●' : nextAction === 'claim-pet' ? ko ? '다람쥐 받기 ●' : 'Claim ●' : pet.owned ? ko ? '다람쥐 탐험' : 'Squirrel' : ko ? '다람쥐 퀘스트' : 'Squirrel quest'}</Text>
    </Pressable>}
    {selected === null && <View style={s.dock}>{actionHint && <Text style={s.hint}>{actionHint}</Text>}
      <Pressable accessibilityRole="button" onPress={() => setSelected('quests')} style={s.primary}><Text style={s.primaryText}>{state.quests.some(quest => !quest.claimed && quest.progress >= quest.target) ? ko ? '📜 자재 퀘스트 · 보상 받기 ●' : '📜 Material quests · Claim ●' : ko ? '📜 자재 퀘스트' : '📜 Material quests'}</Text></Pressable>
      {!pet && <Text style={s.hint}>{ko ? '탐험 정보를 불러오지 못했어요. 다시 연결해 주세요.' : 'Expedition data is unavailable. Please reconnect.'}</Text>}</View>}
    {facility && reward && needs && <View style={[s.sheet, s.facilitySheet]}>
      <View style={s.sheetHeader}><Text style={s.title}>{facility.id === 'mine' ? '⛏ ' : '🌱 '}{name(facility.id)} · Lv.{facility.level}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={ko ? '닫기' : 'Close'} onPress={() => setSelected(null)} style={s.close}><Text style={s.closeText}>✕</Text></Pressable></View>
      <ScrollView contentContainerStyle={s.facilityContent}>
      <View style={s.rewardCard}><Text style={s.rewardTitle}>{ko ? '🐿 내 다람쥐 · 4시간 탐험' : '🐿 My squirrel · 4-hour trip'}</Text>
        <Text style={s.rewardAmount}>{reward.current.toLocaleString()}{reward.next !== null ? ` → ${reward.next.toLocaleString()}` : ''} {facility.id === 'mine' ? ko ? '코인' : 'coins' : ko ? '목재' : 'wood'}</Text>
        <Text style={s.fine}>{reward.next === null ? ko ? '이번 주 최대 탐험 보상이에요.' : 'Maximum expedition reward this week.'
          : ko ? `다음 레벨에서 +${reward.increase.toLocaleString()} · 현재 고목 기준` : `Next level: +${reward.increase.toLocaleString()} · At your current tree level`}</Text>
        <Text style={s.fine}>{ko ? '새로 출발할 탐험에 적용돼요. 탐험 중 보상은 그대로예요.' : 'Applies to new trips. Rewards for trips already underway stay unchanged.'}</Text>
      </View>
      <Text style={s.small}>{ko ? '전체 기여' : 'Community total'} {facility.total}   ·   {ko ? '내 기여' : 'Mine'} {facility.mine}</Text>
      {facility.nextTarget === null ? <Text style={s.gold}>{ko ? '이번 주 최고 레벨!' : 'Maximum level this week!'}</Text> : <>
        <Text style={s.small}>{ko ? '다음 단계' : 'Next level'}  {Math.min(facility.total, facility.nextTarget)} / {facility.nextTarget} {ko ? '자재' : 'materials'}   ·   {facility.contributors} / {facility.nextContributors} {ko ? '명' : 'people'}</Text>
        <View style={s.track}><View style={[s.fill, { width: `${Math.min(100, facility.total / facility.nextTarget * 100)}%` }]} /></View>
        <Text style={s.gold}>{ko ? `자재 ${needs.materials}개 · 참여 ${needs.people}명 더 필요해요` : `${needs.materials} more materials · ${needs.people} more contributors needed`}</Text>
        <Text style={s.fine}>{ko ? `시설당 ${COMMUNITY_MIN_CONTRIBUTION}자재 이상 보탠 사람만 인원에 포함돼요.` : `A person counts after contributing ${COMMUNITY_MIN_CONTRIBUTION} materials to this facility.`}</Text>
      </>}
      <View style={s.actions}>{[1, 5, state.materials].filter((amount, index, values) => amount > 0 && values.indexOf(amount) === index).map(amount => <Pressable key={amount}
        accessibilityRole="button" disabled={locked || state.materials < amount} onPress={() => command({ type: 'contributeCommunity', facility: facility.id, amount })}
        style={[s.donate, (locked || state.materials < amount) && s.disabled]}><Text style={s.donateText}>{amount === state.materials && amount > 5 ? ko ? `전부 ${amount}` : `All ${amount}` : `+${amount}`}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" onPress={() => setSelected('quests')} style={s.questLink}><Text style={s.gold}>{ko ? '자재 퀘스트 ›' : 'Material quests ›'}</Text></Pressable>
      </ScrollView>
    </View>}
    {selected === 'life-tree' && <View style={[s.sheet, s.facilitySheet]}>
      <View style={s.sheetHeader}><Text style={s.title}>{ko ? '🌿 함께 키우는 생명나무' : '🌿 Our life tree'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={ko ? '닫기' : 'Close'} onPress={() => setSelected(null)} style={s.close}><Text style={s.closeText}>✕</Text></Pressable></View>
      <ScrollView contentContainerStyle={s.facilityContent}>
        <Text style={s.treeBody}>{ko ? '모두가 함께 키운 공동 숲의 성장을 보여주는 나무예요. 자재를 광산이나 묘목길에 보태 시설 레벨을 올리면 함께 자라요.' : 'This tree shows how our community forest grows. Contribute materials to the mine or sapling path: as the facilities level up, our tree grows too.'}</Text>
        <View style={s.rewardCard}><Text style={s.gold}>{ko ? '현재 모습' : 'Current stage'} · {(ko ? ['새싹', '어린 나무', '풍성한 나무'] : ['Sprout', 'Young tree', 'Lush tree'])[lifeTreeStage(state)]}</Text>
          <Text style={s.small}>{state.facilities.map(item => `${name(item.id)} Lv.${item.level}`).join(' · ')}</Text></View>
        <Text style={s.treeBody}>{ko ? '시설 레벨이 높아지면 새로 출발하는 다람쥐의 탐험 보상이 늘어요. 생명나무 자체는 별도 재화나 버프를 주지 않아요.' : 'Higher facility levels improve rewards for new squirrel expeditions. The life tree itself does not grant extra resources or buffs.'}</Text>
        <Text style={s.fine}>{ko ? '월요일 UTC 00:00에 시설이 초기화되면 나무도 다시 작은 모습으로 시작해요.' : 'Facilities reset Monday 00:00 UTC, and the tree starts small again.'}</Text>
        <Pressable accessibilityRole="button" onPress={() => setSelected('quests')} style={s.primary}><Text style={s.primaryText}>{ko ? '📜 자재 퀘스트 보기' : '📜 View material quests'}</Text></Pressable>
      </ScrollView>
    </View>}
    {selected === 'pet' && pet && <View style={s.sheet}>
      <View style={s.sheetHeader}><Text style={s.title}>{ko ? '🐿 다람쥐 탐험' : '🐿 Squirrel expedition'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={ko ? '닫기' : 'Close'} onPress={() => setSelected(null)} style={s.close}><Text style={s.closeText}>✕</Text></Pressable></View>
      <SquirrelExpedition pet={pet} community={state} now={now} treeLevel={treeLevel} language={language} command={command} locked={locked} />
    </View>}
    {selected === 'quests' && <View style={[s.sheet, s.questSheet]}>
      <View style={s.sheetHeader}><Text style={s.title}>{ko ? '📜 자재 퀘스트' : '📜 Material quests'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={ko ? '닫기' : 'Close'} onPress={() => setSelected(null)} style={s.close}><Text style={s.closeText}>✕</Text></Pressable></View>
      <ScrollView contentContainerStyle={s.questContent}>{pet && !pet.owned && <View style={s.questGroup}>
        <Text style={s.gold}>{ko ? '첫 동료' : 'First companion'}</Text>
        <View style={s.questRow}><Image source={require('../../assets/pets/squirrel-v1.png')} style={s.questPetArt} resizeMode="contain" />
          <View style={s.questText}><Text style={s.questName}>{ko ? '공동 자재 퀘스트 1개 수령' : 'Claim 1 material quest'}</Text>
            <Text style={s.small}>{pet.questReady ? ko ? '완료 · 다람쥐 영구 해금' : 'Ready · permanent squirrel' : ko ? '0 / 1 · 다람쥐 보상' : '0 / 1 · squirrel reward'}</Text></View>
          <Pressable accessibilityRole="button" disabled={!pet.questReady || locked} onPress={() => command({ type: 'claimSquirrel' })}
            style={[s.claim, (!pet.questReady || locked) && s.disabled]}><Text style={s.claimText}>{pet.questReady ? ko ? '받기' : 'Claim' : ko ? '진행 중' : 'In progress'}</Text></Pressable></View>
      </View>}{(['daily', 'weekly'] as const).map(period => <View key={period} style={s.questGroup}>
        <Text style={s.gold}>{period === 'daily' ? ko ? '오늘' : 'Today' : ko ? '이번 주' : 'This week'}</Text>
        {state.quests.filter(quest => quest.id.startsWith(period === 'daily' ? 'd_' : 'w_')).map(quest => {
          const ready = quest.progress >= quest.target && !quest.claimed;
          return <View key={quest.id} style={s.questRow}><View style={s.questText}><Text style={s.questName}>{LABELS[quest.id][language]}</Text>
            <Text style={s.small}>{Math.min(quest.progress, quest.target)} / {quest.target} · +{quest.materials}</Text></View>
            <Pressable accessibilityRole="button" disabled={!ready || locked} onPress={() => command({ type: 'claimCommunityQuest', questId: quest.id })}
              style={[s.claim, (!ready || locked) && s.disabled]}><Text style={s.claimText}>{quest.claimed ? ko ? '완료' : 'Claimed' : ready ? ko ? '받기' : 'Claim' : ko ? '진행 중' : 'In progress'}</Text></Pressable></View>;
        })}</View>)}
        <Text style={s.fine}>{ko ? '일일 퀘스트는 매일, 시설과 주간 퀘스트는 월요일 UTC 00:00에 초기화돼요. 자재는 이월되지 않아요.' : 'Daily quests reset each day. Facilities and weekly quests reset Monday 00:00 UTC. Materials do not carry over.'}</Text>
      </ScrollView>
    </View>}
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={[s.celebration, { opacity: celebrationOpacity, transform: [{ translateY: celebrationOpacity.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
      {firstContribution && <><Text style={s.celebrationTitle}>{ko ? '✦ 자재를 보탰어요!' : '✦ Contribution received!'}</Text>
        <Text style={s.small}>{ko ? '시설이 자라면 새 탐험 보상도 늘어요.' : 'Growing facilities improves new trip rewards.'}</Text></>}
      {celebration.length > 0 && <><Text style={s.celebrationTitle}>{ko ? '✦ 함께 키운 숲이 성장했어요!' : '✦ Our forest has grown!'}</Text>
        <Text style={s.small}>{celebration.map(item => `${name(item.id)} Lv.${item.level}`).join(' · ')} {ko ? '달성' : 'reached'}</Text></>}
    </Animated.View>
  </View>;
}

const s = StyleSheet.create({
  world: { flex: 1, backgroundColor: '#143B37', overflow: 'hidden' }, topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 92, backgroundColor: '#082C2ABA' },
  background: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  status: { position: 'absolute', top: 12, left: 18, right: 18, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 15, backgroundColor: '#0D3C35D9', borderWidth: 1, borderColor: '#D4C47A' },
  statusText: { color: '#FFF2C6', fontSize: 17, fontWeight: '900' }, small: { color: '#D4E3D3', fontSize: 12, lineHeight: 17 },
  treeBody: { color: '#E0E8D6', fontSize: 13, lineHeight: 20 },
  landmark: { position: 'absolute', top: '31%', width: '46%', height: '34%', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 5 }, mine: { left: '2%' }, saplings: { right: '2%' },
  landmarkLabel: { backgroundColor: '#0A3732EA', borderRadius: 13, borderWidth: 1, borderColor: '#E7D48B', paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center' },
  landmarkName: { color: '#FFF1C7', fontSize: 14, fontWeight: '900' }, landmarkHint: { color: '#C3DBBD', fontSize: 10, marginTop: 2 },
  nextTarget: { borderColor: '#FFE99B', borderWidth: 2, backgroundColor: '#285248F2' },
  stage: { color: '#F5DD98', fontSize: 10, marginTop: 3 },
  facilityGlow: { position: 'absolute', bottom: 65, width: 125, height: 110, borderRadius: 65, backgroundColor: '#FFE398' },
  saplingGlow: { backgroundColor: '#B5ED91' },
  growthAccents: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', justifyContent: 'center', height: 42, marginBottom: 5 },
  ore: { width: 12, borderRadius: 3, borderWidth: 1, borderColor: '#FFF0B6', transform: [{ rotate: '35deg' }] },
  sprout: { width: 3, backgroundColor: '#72A558', borderRadius: 2, marginHorizontal: 7 },
  leafLeft: { position: 'absolute', top: 5, right: 0, width: 13, height: 8, backgroundColor: '#99C970', borderTopLeftRadius: 10, borderBottomRightRadius: 10, transform: [{ rotate: '25deg' }] },
  leafRight: { position: 'absolute', top: 1, left: 1, width: 13, height: 8, backgroundColor: '#C1DF8B', borderTopRightRadius: 10, borderBottomLeftRadius: 10, transform: [{ rotate: '-25deg' }] },
  flower: { position: 'absolute', top: -5, left: -3, width: 9, height: 9, borderRadius: 5, backgroundColor: '#FFE5A6', borderWidth: 2, borderColor: '#EAB877' },
  celebration: { position: 'absolute', top: 91, left: 18, right: 18, padding: 12, borderRadius: 14, alignItems: 'center', gap: 4, backgroundColor: '#123C32F5', borderWidth: 1, borderColor: '#EBC76A' },
  celebrationTitle: { color: '#FFE4A0', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  petSpot: { position: 'absolute', bottom: '15%', left: '50%', marginLeft: -143, width: 80, height: 112, alignItems: 'center', justifyContent: 'flex-end' },
  petArt: { width: 76, height: 74 }, petSpotLabel: { color: '#FFF2C6', backgroundColor: '#123B32E8', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, fontWeight: '900' },
  questPetArt: { width: 39, height: 42 },
  dock: { position: 'absolute', bottom: 14, left: 16, right: 16, gap: 10, alignItems: 'center' },
  hint: { color: '#FFF3D1', backgroundColor: '#0B3730D9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  primary: { minHeight: 52, width: '100%', borderRadius: 15, backgroundColor: '#EEC65E', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#3B3524', fontSize: 15, fontWeight: '900' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, minHeight: 248, padding: 18, paddingBottom: 22, gap: 10, backgroundColor: '#103B39F5', borderTopLeftRadius: 25, borderTopRightRadius: 25, borderTopWidth: 2, borderColor: '#C7C987' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: '#FFF1CB', fontSize: 19, fontWeight: '900' },
  facilitySheet: { maxHeight: '74%' }, facilityContent: { gap: 10, paddingBottom: 4 },
  rewardCard: { backgroundColor: '#244E42', borderRadius: 12, padding: 11, gap: 4 },
  rewardTitle: { color: '#E4EACF', fontSize: 12, fontWeight: '800' }, rewardAmount: { color: '#FFE091', fontSize: 20, fontWeight: '900' },
  close: { minWidth: 38, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#335C53' }, closeText: { color: '#FFF4D6', fontSize: 16, fontWeight: '800' },
  gold: { color: '#FFE091', fontSize: 13, fontWeight: '800' }, fine: { color: '#B7D3C3', fontSize: 11, lineHeight: 15 },
  track: { height: 9, borderRadius: 6, overflow: 'hidden', backgroundColor: '#366259' }, fill: { height: '100%', borderRadius: 6, backgroundColor: '#EFC75E' },
  actions: { flexDirection: 'row', gap: 8 }, donate: { minHeight: 44, minWidth: 72, paddingHorizontal: 13, borderRadius: 11, backgroundColor: '#EFC75E', alignItems: 'center', justifyContent: 'center' },
  donateText: { color: '#3B3427', fontSize: 13, fontWeight: '900' }, disabled: { opacity: 0.43 }, questLink: { alignSelf: 'flex-end', paddingVertical: 4 },
  questSheet: { height: '57%', minHeight: 300 }, questContent: { paddingBottom: 15, gap: 15 }, questGroup: { gap: 6 },
  questRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#4E7566' }, questText: { flex: 1, gap: 3 },
  questName: { color: '#FFF0CD', fontSize: 13, fontWeight: '800' }, claim: { minWidth: 78, minHeight: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4A8061' },
  claimText: { color: '#F2F5DF', fontSize: 12, fontWeight: '800' }, fallback: { flex: 1, padding: 22, backgroundColor: '#143B37' },
});
