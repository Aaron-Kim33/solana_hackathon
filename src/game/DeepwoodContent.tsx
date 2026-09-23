import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { axeLevelFor, claimWardenReward, WARDEN_TARGETS, type Progress } from './progression';
import { GemArt } from './GemArt';
import { PRODUCT_CATALOG } from '../shared/catalog';

export function GemPackages({ progress }: { progress: Progress }) {
  const [expanded, setExpanded] = useState(false);
  const ko = progress.language === 'ko';
  return <View style={s.card}>
    <Pressable accessibilityRole="button" onPress={() => setExpanded(!expanded)} style={s.button}>
      <Text style={s.title}>{ko ? '보석 패키지 · 준비 중' : 'Gem packages · Coming soon'} {expanded ? '⌃' : '⌄'}</Text>
    </Pressable>
    {expanded && <>
      <Text style={s.text}>{ko ? '구성 미리보기 · 가격 미정 · 출시 후 계정당 각 1회 구매 예정. 현재 결제 및 보석 지급은 지원하지 않아요.' : 'Preview only · Price TBD · Planned limit: one of each per account after launch. Payments and grants are unavailable.'}</Text>
      {PRODUCT_CATALOG.map((product, index) => <View key={product.id} style={s.card}>
        <GemArt tier={index === 0 ? 'medium' : 'high'} size={52} />
        <Text style={s.title}>{ko ? (index === 0 ? '두 번째 숲 성장 패키지' : '심림 강화 패키지') : (index === 0 ? 'Second Forest Growth Pack' : 'Deepwood Enhancement Pack')}</Text>
        <Text style={s.text}>{[product.gems.medium > 0 ? (ko ? `중급 보석 ${product.gems.medium}개` : `${product.gems.medium} Medium gems`) : '', ko ? `고급 보석 ${product.gems.high}개` : `${product.gems.high} High gems`].filter(Boolean).join(' + ')}</Text>
        <Pressable accessibilityRole="button" disabled style={[s.button, { opacity: 0.5 }]}><Text style={s.text}>{ko ? '출시 준비 중' : 'Coming soon'}</Text></Pressable>
      </View>)}
      <Text style={s.text}>{ko ? '미개봉 보석으로 제공 예정이며 개봉 또는 합성을 선택할 수 있어요. 플레이 보상과 동일한 성능이며 치명타 확률은 최대 100%예요.' : 'Planned delivery: unopened gems for opening or fusion. Same effects as gameplay gems; critical chance is capped at 100%.'}</Text>
    </>}
  </View>;
}

export function WardenQuests({ progress, commit }: { progress: Progress; commit: (next: Progress) => boolean }) {
  const latest = useRef(progress); latest.current = progress;
  const ko = progress.language === 'ko';
  const claimed = progress.wardenRewardsClaimed ?? 0;
  const level = progress.treeLevel >= 101 ? axeLevelFor(progress, 'warden') : 0;
  const rewards = ko ? ['고급 보석 1개', '고급 보석 2개', '최고급 보석 1개 + 황금 심림 외형 + 모든 도끼 치명타 데미지 총 +30%p'] : ['1 High gem', '2 High gems', '1 Supreme gem + Golden Deepwood appearance + total +30pp critical damage for all axes'];
  return <View style={s.card}>
    <Text style={s.title}>{ko ? '심림의 주인 · 도끼 성장 퀘스트' : 'Master of Deepwood · Axe quests'}</Text>
    <Text style={s.text}>{ko ? '보상은 순서대로 한 번씩 수령해요. 200레벨 영구 효과는 기존 +10%p를 대체하며 외형은 심림의 도끼에 자동 적용돼요.' : 'Claim each reward once, in order. The level 200 permanent effect replaces +10pp; the appearance automatically applies to the Deepwood Axe.'}</Text>
    {WARDEN_TARGETS.map((target, index) => {
      const ready = index === claimed && level >= target;
      return <View key={target} style={s.card}>
        <Text style={s.title}>{(ko ? ['심림에 뿌리내리다', '심림을 다스리다', '심림의 주인'] : ['Roots in Deepwood', 'Rule the Deepwood', 'Master of Deepwood'])[index]} · Lv.{target}</Text>
        <Text style={s.text}>{Math.min(level, target)} / {target} · {rewards[index]}</Text>
        <Pressable accessibilityRole="button" disabled={!ready} style={[s.button, !ready && { opacity: 0.45 }]} onPress={() => {
          if ((latest.current.wardenRewardsClaimed ?? 0) !== index) return;
          const next = claimWardenReward(latest.current);
          if (next === latest.current) return;
          if (!commit(next)) { Alert.alert(ko ? '저장 실패' : 'Save failed'); return; }
          latest.current = next;
          Alert.alert(ko ? '보상 수령 완료' : 'Reward claimed', rewards[index]);
        }}><Text style={s.text}>{index < claimed ? (ko ? '수령 완료' : 'Claimed') : ready ? (ko ? '보상 받기' : 'Claim reward') : (ko ? '진행 중 · 이전 보상 수령 필요' : 'In progress · Claim previous rewards first')}</Text></Pressable>
      </View>;
    })}
  </View>;
}
const s = StyleSheet.create({
  card: { backgroundColor: '#183D3D', borderRadius: 14, padding: 12, gap: 10, marginTop: 8 },
  title: { color: '#E6EFDD', fontSize: 15, fontWeight: '800' },
  text: { color: '#B9D5CC', fontSize: 13, lineHeight: 20 },
  button: { backgroundColor: '#29524C', padding: 12, borderRadius: 10, minHeight: 44 },
});
