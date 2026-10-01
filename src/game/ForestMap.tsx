import { Pressable, StyleSheet, Text, View } from 'react-native';

export function ForestMap({ language, farmReady, communityReady, bossReady, onPersonal, onFarm, onCommunity, onWorldBoss }: { language: 'ko' | 'en'; farmReady: boolean; communityReady: boolean; bossReady: boolean;
  onPersonal: () => void; onFarm: () => void; onCommunity: () => void; onWorldBoss: () => void }) {
  const ko = language === 'ko';
  return <View style={s.container}>
    <Text style={s.caption}>{ko ? '어디로 갈까요?' : 'Where to next?'}</Text>
    <View style={s.route}>
      <Pressable accessibilityRole="button" accessibilityLabel={ko ? '개인 숲으로 돌아가기' : 'Return to personal forest'}
        onPress={onPersonal} style={[s.place, s.personal]}>
        <Text style={s.icon}>🌳</Text>
        <Text style={s.title}>{ko ? '개인 숲' : 'Personal forest'}</Text>
        <Text style={s.detail}>{ko ? '벌목하고 목재를 모으는 곳' : 'Chop trees and gather wood'}</Text>
        <Text style={s.enter}>{ko ? '돌아가기 ›' : 'Return ›'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={ko ? '묘목 농장으로 이동' : 'Enter sapling farm'}
        accessibilityState={{ disabled: !farmReady }} disabled={!farmReady} onPress={onFarm}
        style={[s.farmPlace, !farmReady && s.unavailable]}>
        <Text style={s.farmIcon}>🌱</Text><View style={{ flex: 1 }}><Text style={s.farmTitle}>{ko ? '묘목 농장' : 'Sapling farm'}</Text>
          <Text style={s.farmDetail}>{farmReady ? ko ? '뿌리에 물길을 잇고 카르마 모으기 ›' : 'Guide roots and earn karma ›'
            : ko ? '고목 Lv.15에 열려요' : 'Unlocks at tree Lv.15'}</Text></View>
      </Pressable>
      <View style={s.path}><View style={s.pathDot} /><View style={s.pathLine} /><View style={s.pathDot} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={ko ? '공동 숲으로 이동' : 'Enter community forest'}
        accessibilityState={{ disabled: !communityReady }} disabled={!communityReady} onPress={onCommunity}
        style={[s.place, s.community, !communityReady && s.unavailable]}>
        <Text style={s.icon}>🏕️</Text>
        <Text style={s.title}>{ko ? '공동 숲' : 'Community forest'}</Text>
        <Text style={s.detail}>{ko ? '함께 광산과 묘목길을 키우는 곳' : 'Build the mine and sapling path together'}</Text>
        <Text style={s.enter}>{communityReady ? ko ? '들어가기 ›' : 'Enter ›' : ko ? '서버 저장 연결 후 입장' : 'Connect server save to enter'}</Text>
      </Pressable>
      <View style={s.path}><View style={s.pathDot} /><View style={s.pathLine} /><View style={s.pathDot} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={ko ? '월드보스 숲으로 이동' : 'Enter world boss forest'}
        accessibilityState={{ disabled: !bossReady }} disabled={!bossReady} onPress={onWorldBoss}
        style={[s.place, s.boss, !bossReady && s.unavailable]}>
        <Text style={s.icon}>🌲</Text>
        <Text style={s.title}>{ko ? '월드보스 숲' : 'World boss forest'}</Text>
        <Text style={s.detail}>{ko ? '무시무시한 나무 괴물 · 주간 100타' : 'Ancient tree monster · 100 weekly hits'}</Text>
        <Text style={s.enter}>{bossReady ? ko ? '도전하기 ›' : 'Challenge ›' : communityReady ? ko ? '서버 업데이트 후 입장' : 'Update server to enter'
          : ko ? '서버 저장 연결 후 입장' : 'Connect server save to enter'}</Text>
      </Pressable>
    </View>
  </View>;
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 18, paddingVertical: 20 },
  caption: { color: '#FFF0CB', fontSize: 21, fontWeight: '900', textAlign: 'center' },
  route: { alignItems: 'center' },
  place: { width: '100%', minHeight: 172, borderRadius: 24, padding: 19, alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 2 },
  personal: { backgroundColor: '#1E5445ED', borderColor: '#A8D18B' },
  farmPlace: { width: '82%', minHeight: 76, marginTop: 8, alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 11,
    borderRadius: 18, padding: 12, borderWidth: 2, borderColor: '#B8DC8A', backgroundColor: '#285B3EED' },
  farmIcon: { fontSize: 29 }, farmTitle: { color: '#FFF2D1', fontSize: 16, fontWeight: '900' },
  farmDetail: { color: '#D7EDD1', fontSize: 11, marginTop: 3 },
  community: { backgroundColor: '#385E57ED', borderColor: '#F1D47E' },
  boss: { backgroundColor: '#233D42ED', borderColor: '#F0A66E' },
  unavailable: { opacity: 0.72 }, icon: { fontSize: 40 },
  title: { color: '#FFF2D1', fontSize: 21, fontWeight: '900' },
  detail: { color: '#D3E9D4', fontSize: 12, textAlign: 'center' },
  enter: { color: '#FFE291', fontSize: 13, fontWeight: '800', marginTop: 5 },
  path: { height: 58, alignItems: 'center', justifyContent: 'space-between' },
  pathLine: { height: 28, width: 4, borderRadius: 2, backgroundColor: '#E2CC81' },
  pathDot: { height: 8, width: 8, borderRadius: 4, backgroundColor: '#FFF1AC' },
});
