import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SoundPressable as Pressable } from '../audio/GameAudio';
import type { LoadWeeklyRanking, WeeklyRanking, WeeklyRankingCategory, WeeklyRankingEntry } from '../shared/weekly-ranking';

export function WeeklyRankingButton({ category, language, load, beforeOpen }: {
  category: WeeklyRankingCategory; language: 'ko' | 'en'; load: LoadWeeklyRanking; beforeOpen?: () => void;
}) {
  const ko = language === 'ko', community = category === 'community';
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [data, setData] = useState<WeeklyRanking | null>(null), [error, setError] = useState(false);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  const refresh = async () => {
    const serial = ++request.current;
    setBusy(true); setError(false); setData(null);
    try {
      const result = await load(category);
      if (result.category !== category || !Array.isArray(result.entries)) throw new Error('INVALID_RANKING');
      if (serial === request.current) setData(result);
    } catch { if (serial === request.current) setError(true); }
    finally { if (serial === request.current) setBusy(false); }
  };
  const close = () => { request.current++; setOpen(false); setBusy(false); };
  const row = (entry: WeeklyRankingEntry, own = false) => <View key={entry.tag} style={[s.row, (own || entry.isMe) && s.own]}>
    <Text style={s.rank}>{entry.rank}</Text>
    <View style={s.person}>
      <Text style={s.name}>{entry.isMe ? ko ? '나' : 'You' : `${ko ? '벌목꾼' : 'Forester'} ${entry.tag.slice(0, 6).toUpperCase()}`}</Text>
      <Text style={s.fine}>{community ? ko ? `광산 ${entry.mine ?? 0} · 묘목길 ${entry.saplings ?? 0}` : `Mine ${entry.mine ?? 0} · Path ${entry.saplings ?? 0}`
        : ko ? `이번 주 ${entry.hits ?? 0}/100타` : `${entry.hits ?? 0}/100 weekly hits`}</Text>
    </View>
    <Text style={s.score}>{entry.score.toLocaleString()}</Text>
  </View>;
  return <>
    <Pressable accessibilityRole="button" onPress={() => { beforeOpen?.(); setOpen(true); void refresh(); }} style={s.button}>
      <Text style={s.buttonText}>{community ? ko ? '🏆 기여 순위' : '🏆 Contributions' : ko ? '🏆 피해 순위' : '🏆 Damage ranks'}</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View style={s.backdrop}><View style={s.sheet} accessibilityViewIsModal>
        <View style={s.header}><Text style={s.title}>{community ? ko ? '이번 주 공동숲 기여' : 'Weekly forest contributions' : ko ? '이번 주 보스 피해' : 'Weekly boss damage'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={ko ? '닫기' : 'Close'} onPress={close} style={s.icon}><Text style={s.name}>✕</Text></Pressable></View>
        <Text style={s.fine}>{community ? ko ? '광산 + 묘목길에 실제로 보탠 자재' : 'Materials contributed to the mine + sapling path'
          : ko ? '성장에 따라 피해량이 달라져요. 순위별 추가 보상은 없어요.' : 'Damage depends on growth. No extra rewards for rank.'}</Text>
        {busy && <ActivityIndicator color="#F1CE76" accessibilityLabel={ko ? '순위 불러오는 중' : 'Loading ranks'} />}
        {error && <Text accessibilityLiveRegion="polite" style={s.error}>{ko ? '순위를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.' : 'Ranks unavailable. Check your connection and try again.'}</Text>}
        {data && <>
          <Text style={s.fine}>{ko ? `참여 ${data.participants}명 · 상위 10명` : `${data.participants} participants · Top 10`}</Text>
          <ScrollView style={s.list} contentContainerStyle={s.listContent}>
            {data.entries.length ? data.entries.map(entry => row(entry)) : <Text style={s.empty}>{ko ? '이번 주 첫 기여를 기다리고 있어요 🌱' : 'Waiting for the first contribution this week 🌱'}</Text>}
          </ScrollView>
          <Text style={s.name}>{ko ? '내 순위' : 'Your rank'}</Text>
          {data.mine ? row(data.mine, true) : <Text style={s.empty}>{!data.eligible ? ko ? '개발 테스트 계정은 순위에서 제외돼요.' : 'Development test accounts are excluded.'
            : community ? ko ? '시설에 자재를 보태면 순위에 참여해요.' : 'Contribute materials to join the rankings.'
              : ko ? '보스를 공격하면 순위에 참여해요.' : 'Attack the boss to join the rankings.'}</Text>}
          <Text style={s.fine}>{ko ? '동점은 같은 순위 · 월요일 UTC 00:00 초기화' : 'Ties share a rank · Resets Monday 00:00 UTC'}</Text>
          <Text style={s.fine}>{ko ? '주 시작' : 'Week of'} {new Date(data.weekStart).toISOString().slice(0, 10)} · {ko ? '확인' : 'Checked'} {new Date(data.asOf).toLocaleTimeString(language === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
        </>}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void refresh()} style={[s.refresh, busy && s.disabled]}>
          <Text style={s.buttonText}>{ko ? '↻ 새로고침' : '↻ Refresh'}</Text>
        </Pressable>
      </View></View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  button: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#30564AF2', borderWidth: 1, borderColor: '#C7B36C', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFE4A0', fontWeight: '800', fontSize: 12 },
  backdrop: { flex: 1, padding: 18, paddingVertical: 40, justifyContent: 'center', backgroundColor: '#000000A0' },
  sheet: { maxHeight: '100%', padding: 16, gap: 10, borderRadius: 22, borderWidth: 1, borderColor: '#D8BE78', backgroundColor: '#143B37' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4 }, title: { flex: 1, color: '#FFE4A0', fontSize: 18, fontWeight: '900' },
  icon: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  list: { flexShrink: 1 }, listContent: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, minHeight: 58, backgroundColor: '#254B43', borderRadius: 12 },
  own: { backgroundColor: '#415B3B', borderWidth: 1, borderColor: '#E0C774' },
  rank: { width: 26, color: '#FFE4A0', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  person: { flex: 1, gap: 3 }, name: { color: '#FFF0CB', fontSize: 13, fontWeight: '800' },
  fine: { color: '#C6DACA', fontSize: 11, lineHeight: 16 }, score: { color: '#FFE4A0', fontSize: 15, fontWeight: '900', maxWidth: '36%' },
  empty: { color: '#E0E9D4', fontSize: 12, lineHeight: 18, padding: 10 }, error: { color: '#FFD18E', fontSize: 13, lineHeight: 19 },
  refresh: { minHeight: 44, borderRadius: 12, backgroundColor: '#30564A', alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.4 },
});
