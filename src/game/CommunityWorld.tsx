import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CommunityFacilityId, CommunityQuestId, CommunitySnapshot } from '../shared/community';
import { COMMUNITY_MIN_CONTRIBUTION } from '../shared/community';
import type { GameCommand } from '../shared/server-contract';

const LABELS: Record<CommunityQuestId, { ko: string; en: string }> = {
  d_hits: { ko: '벌목 10회', en: 'Chop 10 times' }, d_bundles: { ko: '목재 묶음 3개 확보', en: 'Secure 3 bundles' },
  d_trolley: { ko: '트롤리 1회 출발', en: 'Dispatch trolley once' }, w_hits: { ko: '벌목 50회', en: 'Chop 50 times' },
  w_bundles: { ko: '목재 묶음 15개 확보', en: 'Secure 15 bundles' }, w_trolley: { ko: '트롤리 5회 출발', en: 'Dispatch trolley 5 times' },
};

export function CommunityWorld({ state, language, command, locked }: { state: CommunitySnapshot; language: 'ko' | 'en';
  command: (command: GameCommand) => boolean; locked: boolean }) {
  const ko = language === 'ko';
  const [selected, setSelected] = useState<CommunityFacilityId | 'quests' | null>(null);
  const facility = state.facilities.find(item => item.id === selected);
  const name = (id: CommunityFacilityId) => id === 'mine' ? ko ? '광산' : 'Mine' : ko ? '묘목길' : 'Sapling path';
  if (state.facilities.some(item => !Number.isInteger(item.contributors)))
    return <View style={s.fallback}><Text style={s.title}>{ko ? '서버를 다시 시작해 주세요' : 'Restart the server'}</Text>
      <Text style={s.small}>{ko ? '새 공동 숲은 로컬 서버 재시작 후 열려요.' : 'The new forest needs the updated local server.'}</Text></View>;
  return <View style={s.world}>
    <Image source={require('../../assets/community/community-clearing-v1.png')} style={s.background} resizeMode="stretch" />
    <View pointerEvents="none" style={s.topShade} />
    <View style={s.status}><Text style={s.statusText}>✦ {ko ? '내 자재' : 'My materials'} {state.materials}</Text>
      <Text style={s.small}>{ko ? '이번 주 내 기여' : 'My contribution this week'} {state.myContribution}</Text></View>
    {state.facilities.map(item => <Pressable key={item.id} accessibilityRole="button"
      accessibilityLabel={`${name(item.id)} Lv.${item.level} · ${ko ? '기여하기' : 'Contribute'}`}
      onPress={() => setSelected(item.id)} style={[s.landmark, item.id === 'mine' ? s.mine : s.saplings]}>
      <View style={s.landmarkLabel}><Text style={s.landmarkName}>{item.id === 'mine' ? '⛏ ' : '🌱 '}{name(item.id)} · Lv.{item.level}</Text>
        <Text style={s.landmarkHint}>{ko ? '눌러서 보태기' : 'Tap to contribute'}</Text></View>
    </Pressable>)}
    {selected === null && <View style={s.dock}><Text style={s.hint}>{ko ? '광산이나 묘목길을 눌러 보세요' : 'Tap the mine or sapling path'}</Text>
      <Pressable accessibilityRole="button" onPress={() => setSelected('quests')} style={s.primary}><Text style={s.primaryText}>{ko ? '📜 자재 퀘스트' : '📜 Material quests'}</Text></Pressable></View>}
    {facility && <View style={s.sheet}>
      <View style={s.sheetHeader}><Text style={s.title}>{facility.id === 'mine' ? '⛏ ' : '🌱 '}{name(facility.id)} · Lv.{facility.level}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={ko ? '닫기' : 'Close'} onPress={() => setSelected(null)} style={s.close}><Text style={s.closeText}>✕</Text></Pressable></View>
      <Text style={s.small}>{ko ? '전체 기여' : 'Community total'} {facility.total}   ·   {ko ? '내 기여' : 'Mine'} {facility.mine}</Text>
      {facility.nextTarget === null ? <Text style={s.gold}>{ko ? '이번 주 최고 레벨!' : 'Maximum level this week!'}</Text> : <>
        <Text style={s.small}>{ko ? '다음 단계' : 'Next level'}  {Math.min(facility.total, facility.nextTarget)} / {facility.nextTarget} {ko ? '자재' : 'materials'}   ·   {facility.contributors} / {facility.nextContributors} {ko ? '명' : 'people'}</Text>
        <View style={s.track}><View style={[s.fill, { width: `${Math.min(100, facility.total / facility.nextTarget * 100)}%` }]} /></View>
        <Text style={s.fine}>{ko ? `시설당 ${COMMUNITY_MIN_CONTRIBUTION}자재 이상 보탠 사람만 인원에 포함돼요.` : `A person counts after contributing ${COMMUNITY_MIN_CONTRIBUTION} materials to this facility.`}</Text>
      </>}
      <View style={s.actions}>{[1, 5, state.materials].filter((amount, index, values) => amount > 0 && values.indexOf(amount) === index).map(amount => <Pressable key={amount}
        accessibilityRole="button" disabled={locked || state.materials < amount} onPress={() => command({ type: 'contributeCommunity', facility: facility.id, amount })}
        style={[s.donate, (locked || state.materials < amount) && s.disabled]}><Text style={s.donateText}>{amount === state.materials && amount > 5 ? ko ? `전부 ${amount}` : `All ${amount}` : `+${amount}`}</Text></Pressable>)}</View>
      <Text style={s.fine}>{ko ? '시설 효과와 펫 파견은 준비 중이에요.' : 'Facility effects and pet dispatches are coming soon.'}</Text>
      <Pressable accessibilityRole="button" onPress={() => setSelected('quests')} style={s.questLink}><Text style={s.gold}>{ko ? '자재 퀘스트 ›' : 'Material quests ›'}</Text></Pressable>
    </View>}
    {selected === 'quests' && <View style={[s.sheet, s.questSheet]}>
      <View style={s.sheetHeader}><Text style={s.title}>{ko ? '📜 자재 퀘스트' : '📜 Material quests'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={ko ? '닫기' : 'Close'} onPress={() => setSelected(null)} style={s.close}><Text style={s.closeText}>✕</Text></Pressable></View>
      <ScrollView contentContainerStyle={s.questContent}>{(['daily', 'weekly'] as const).map(period => <View key={period} style={s.questGroup}>
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
  </View>;
}

const s = StyleSheet.create({
  world: { flex: 1, backgroundColor: '#143B37', overflow: 'hidden' }, topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 92, backgroundColor: '#082C2ABA' },
  background: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  status: { position: 'absolute', top: 12, left: 18, right: 18, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 15, backgroundColor: '#0D3C35D9', borderWidth: 1, borderColor: '#D4C47A' },
  statusText: { color: '#FFF2C6', fontSize: 17, fontWeight: '900' }, small: { color: '#D4E3D3', fontSize: 12, lineHeight: 17 },
  landmark: { position: 'absolute', top: '31%', width: '46%', height: '34%', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 5 }, mine: { left: '2%' }, saplings: { right: '2%' },
  landmarkLabel: { backgroundColor: '#0A3732EA', borderRadius: 13, borderWidth: 1, borderColor: '#E7D48B', paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center' },
  landmarkName: { color: '#FFF1C7', fontSize: 14, fontWeight: '900' }, landmarkHint: { color: '#C3DBBD', fontSize: 10, marginTop: 2 },
  dock: { position: 'absolute', bottom: 14, left: 16, right: 16, gap: 10, alignItems: 'center' },
  hint: { color: '#FFF3D1', backgroundColor: '#0B3730D9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  primary: { minHeight: 52, width: '100%', borderRadius: 15, backgroundColor: '#EEC65E', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#3B3524', fontSize: 15, fontWeight: '900' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, minHeight: 248, padding: 18, paddingBottom: 22, gap: 10, backgroundColor: '#103B39F5', borderTopLeftRadius: 25, borderTopRightRadius: 25, borderTopWidth: 2, borderColor: '#C7C987' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: '#FFF1CB', fontSize: 19, fontWeight: '900' },
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
