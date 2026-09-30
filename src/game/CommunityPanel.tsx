import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CommunitySnapshot, CommunityQuestId } from '../shared/community';
import { COMMUNITY_LEVEL_STEPS, COMMUNITY_CONTRIBUTOR_STEPS, COMMUNITY_MIN_CONTRIBUTION } from '../shared/community';
import type { GameCommand } from '../shared/server-contract';

const LABELS: Record<CommunityQuestId, { ko: string; en: string }> = {
  d_hits: { ko: '벌목 10회', en: 'Chop 10 times' },
  d_bundles: { ko: '목재 묶음 3개 확보', en: 'Secure 3 wood bundles' },
  d_trolley: { ko: '트롤리 1회 출발', en: 'Dispatch the trolley once' },
  w_hits: { ko: '벌목 50회', en: 'Chop 50 times' },
  w_bundles: { ko: '목재 묶음 15개 확보', en: 'Secure 15 wood bundles' },
  w_trolley: { ko: '트롤리 5회 출발', en: 'Dispatch the trolley 5 times' },
};

export function CommunityPanel({ state, language, command, locked }: { state: CommunitySnapshot; language: 'ko' | 'en';
  command: (command: GameCommand) => boolean; locked: boolean }) {
  const ko = language === 'ko';
  if (state.facilities.some(facility => !Number.isInteger(facility.contributors)))
    return <View style={s.group}><Text style={s.title}>{ko ? '서버 업데이트가 필요해요' : 'Server update needed'}</Text>
      <Text style={s.hint}>{ko ? '새 공동 레벨 규칙을 보려면 로컬 서버를 재시작해 주세요.' : 'Restart the local server to load the new shared-level rules.'}</Text></View>;
  return <View style={s.container}>
    <View style={s.hero}>
      <Text style={s.heroIcon}>🏕️</Text>
      <Text style={s.heroTitle}>{ko ? '함께 키우는 숲' : 'A forest we grow together'}</Text>
      <Text style={s.heroText}>{ko ? '매주 모은 자재로 광산과 묘목길을 함께 열어요.' : 'Grow the mine and sapling path with materials gathered each week.'}</Text>
      <Text style={s.materials}>{ko ? '내 자재' : 'My materials'}  ✦ {state.materials}</Text>
    </View>
    {state.facilities.map(facility => <View key={facility.id} style={s.group}>
      <View style={s.facilityHeader}><Text style={s.facilityIcon}>{facility.id === 'mine' ? '⛏️' : '🌱'}</Text>
        <View><Text style={s.title}>{facility.id === 'mine' ? ko ? '광산' : 'Mine' : ko ? '묘목길' : 'Sapling path'} · Lv.{facility.level}</Text>
          <Text style={s.hint}>{ko ? '함께한 사람' : 'Contributors'} {facility.contributors}{ko ? '명' : ''} · {ko ? '내 기여' : 'Mine'} {facility.mine}</Text></View></View>
      <Text style={s.hint}>{facility.nextTarget === null ? ko ? '이번 주 최고 레벨 달성' : 'Maximum level this week' : `${ko ? '다음 레벨' : 'Next level'} · ${Math.min(facility.total, facility.nextTarget)} / ${facility.nextTarget} ${ko ? '자재' : 'materials'} · ${facility.contributors} / ${facility.nextContributors} ${ko ? '명' : 'people'}`}</Text>
      <View style={s.track}><View style={[s.fill, { width: `${facility.nextTarget === null ? 100 : Math.min(100, facility.total / facility.nextTarget * 100)}%` }]} /></View>
      <View style={s.actions}>{[1, 5, state.materials].filter((amount, index, values) => amount > 0 && values.indexOf(amount) === index).map(amount => <Pressable key={amount}
        accessibilityRole="button" disabled={locked || state.materials < amount} onPress={() => command({ type: 'contributeCommunity', facility: facility.id, amount })}
        style={[s.button, (locked || state.materials < amount) && s.disabled]}><Text style={s.label}>{amount === state.materials && amount > 5 ? ko ? `전부 ${amount}` : `All ${amount}` : `+${amount}`}</Text></Pressable>)}</View>
    </View>)}
    <Text style={s.hint}>{ko ? `다음 단계는 자재와 참여 인원을 모두 채워야 해요. 시설당 ${COMMUNITY_MIN_CONTRIBUTION}자재 이상 보탠 사람만 인원에 포함됩니다. 지난주 참여 기준 ${state.targetUnit}명 · 단계별 자재 ${COMMUNITY_LEVEL_STEPS.map(step => step * state.targetUnit).join(' / ')} · 인원 ${COMMUNITY_CONTRIBUTOR_STEPS.join(' / ')}` : `Both materials and people are needed. A person counts after contributing ${COMMUNITY_MIN_CONTRIBUTION} to that facility. Last-week baseline ${state.targetUnit}; material steps ${COMMUNITY_LEVEL_STEPS.map(step => step * state.targetUnit).join(' / ')}; people ${COMMUNITY_CONTRIBUTOR_STEPS.join(' / ')}.`}</Text>
    {(['daily', 'weekly'] as const).map(period => <View key={period} style={s.group}>
      <Text style={s.title}>{period === 'daily' ? ko ? '일일 퀘스트' : 'Daily quests' : ko ? '주간 퀘스트' : 'Weekly quests'}</Text>
      {state.quests.filter(quest => quest.id.startsWith(period === 'daily' ? 'd_' : 'w_')).map(quest => {
        const ready = quest.progress >= quest.target && !quest.claimed;
        return <View key={quest.id} style={s.row}>
          <View style={s.grow}><Text style={s.label}>{LABELS[quest.id][language]}</Text>
            <Text style={s.hint}>{Math.min(quest.progress, quest.target)} / {quest.target} · {ko ? `자재 +${quest.materials}` : `+${quest.materials} materials`}</Text></View>
          <Pressable accessibilityRole="button" disabled={!ready || locked} onPress={() => command({ type: 'claimCommunityQuest', questId: quest.id })}
            style={[s.button, (!ready || locked) && s.disabled]}><Text style={s.label}>{quest.claimed ? ko ? '완료' : 'Claimed' : ready ? ko ? '받기' : 'Claim' : ko ? '진행 중' : 'In progress'}</Text></Pressable>
        </View>;
      })}
    </View>)}
    <Text style={s.hint}>{ko ? '레벨 효과·펫·개인 단계 보상은 준비 중이에요. 일일 퀘스트는 매일, 시설과 주간 퀘스트는 월요일 UTC 00:00에 초기화됩니다. 남은 자재는 이월되지 않아요.' : 'Level effects, pets and personal milestone rewards are coming soon. Daily quests reset each day; facilities and weekly quests reset Monday 00:00 UTC. Materials do not carry over.'}</Text>
  </View>;
}

const s = StyleSheet.create({
  container: { gap: 14, paddingBottom: 28 }, group: { backgroundColor: '#173D3CEB', borderRadius: 20, padding: 16, gap: 12, borderWidth: 1, borderColor: '#6C9D80' },
  hero: { minHeight: 190, borderRadius: 24, backgroundColor: '#235348D9', alignItems: 'center', justifyContent: 'center', padding: 18, gap: 6, borderWidth: 1, borderColor: '#B1CA8C' },
  heroIcon: { fontSize: 45 }, heroTitle: { color: '#FFF0C2', fontSize: 23, fontWeight: '900' },
  heroText: { color: '#D3E5C7', fontSize: 12, textAlign: 'center' },
  materials: { color: '#FFE394', fontSize: 16, fontWeight: '900', marginTop: 7 },
  facilityHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, facilityIcon: { fontSize: 37 },
  track: { height: 8, borderRadius: 6, overflow: 'hidden', backgroundColor: '#2E5B50' },
  fill: { height: '100%', borderRadius: 6, backgroundColor: '#EFC75E' },
  title: { color: '#F8EED6', fontWeight: '800', fontSize: 17 }, hint: { color: '#B7D2C7', fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#315C55' },
  actions: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1, gap: 4 }, label: { color: '#E7EFE3', fontWeight: '700', fontSize: 13 },
  button: { backgroundColor: '#386C59', paddingHorizontal: 10, minWidth: 76, minHeight: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  disabled: { opacity: 0.48 },
});
