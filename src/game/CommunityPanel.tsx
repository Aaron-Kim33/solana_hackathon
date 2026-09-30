import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CommunitySnapshot, CommunityQuestId } from '../shared/community';
import { COMMUNITY_LEVEL_STEPS } from '../shared/community';
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
  return <View style={s.container}>
    <Text style={s.title}>{ko ? '공동 숲 자재' : 'Community materials'} · {state.materials}</Text>
    <Text style={s.hint}>{ko ? '자재를 보태면 모두의 시설 레벨이 올라가요. 레벨 효과·펫 파견·개인 단계 보상은 준비 중입니다.' : 'Contribute to raise the shared facility level. Level effects, pet dispatches and personal milestone rewards are coming soon.'}</Text>
    {state.facilities.map(facility => <View key={facility.id} style={s.group}>
      <Text style={s.title}>{facility.id === 'mine' ? ko ? '광산' : 'Mine' : ko ? '묘목길' : 'Sapling path'} · Lv.{facility.level}</Text>
      <Text style={s.hint}>{ko ? '전체 기여' : 'Community total'} {facility.total} · {ko ? '내 기여' : 'My contribution'} {facility.mine}</Text>
      <Text style={s.hint}>{facility.nextTarget === null ? ko ? '이번 주 최고 레벨 달성' : 'Maximum level this week' : `${ko ? '다음 레벨' : 'Next level'} ${facility.total} / ${facility.nextTarget}`}</Text>
      <View style={s.actions}>{[1, 5, state.materials].filter((amount, index, values) => amount > 0 && values.indexOf(amount) === index).map(amount => <Pressable key={amount}
        accessibilityRole="button" disabled={locked || state.materials < amount} onPress={() => command({ type: 'contributeCommunity', facility: facility.id, amount })}
        style={[s.button, (locked || state.materials < amount) && s.disabled]}><Text style={s.label}>{amount === state.materials && amount > 5 ? ko ? `전부 ${amount}` : `All ${amount}` : `+${amount}`}</Text></Pressable>)}</View>
    </View>)}
    <Text style={s.hint}>{ko ? `이번 주 레벨 기준: 지난주 참여 ${state.targetUnit}명 · 단계 ${COMMUNITY_LEVEL_STEPS.map(step => step * state.targetUnit).join(' / ')}` : `This week's level targets: ${COMMUNITY_LEVEL_STEPS.map(step => step * state.targetUnit).join(' / ')} · based on ${state.targetUnit} participant(s) last week`}</Text>
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
    <Text style={s.hint}>{ko ? '매일·매주 월요일 UTC 00:00에 새 퀘스트와 시설이 시작돼요. 남은 자재는 다음 주로 넘어가지 않습니다.' : 'Quests and facilities reset daily or every Monday at 00:00 UTC. Unspent materials do not carry into a new week.'}</Text>
  </View>;
}

const s = StyleSheet.create({
  container: { gap: 12 }, group: { backgroundColor: '#173D3C', borderRadius: 16, padding: 12, gap: 10 },
  title: { color: '#F8EED6', fontWeight: '800', fontSize: 17 }, hint: { color: '#B7D2C7', fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#315C55' },
  actions: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1, gap: 4 }, label: { color: '#E7EFE3', fontWeight: '700', fontSize: 13 },
  button: { backgroundColor: '#386C59', paddingHorizontal: 10, minWidth: 76, minHeight: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  disabled: { opacity: 0.48 },
});
