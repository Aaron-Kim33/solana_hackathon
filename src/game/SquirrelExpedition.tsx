import { Image, StyleSheet, Text, View } from 'react-native';
import { SoundPressable as Pressable } from '../audio/GameAudio';
import type { CommunitySnapshot } from '../shared/community';
import type { GameCommand } from '../shared/server-contract';
import type { SquirrelSnapshot } from '../shared/pets';
import { squirrelReward } from '../shared/pets';

export function SquirrelExpedition({ pet, community, now, treeLevel, language, command, locked }: {
  pet?: SquirrelSnapshot; community?: CommunitySnapshot; now: number; treeLevel: number; language: 'ko' | 'en';
  command: (command: GameCommand) => boolean; locked: boolean;
}) {
  const ko = language === 'ko';
  const trip = pet?.trip;
  const ready = !!trip && now >= trip.returnsAt;
  const remaining = trip ? Math.max(0, trip.returnsAt - now) : 0;
  const timeLeft = `${Math.floor(remaining / 3_600_000)}:${Math.floor(remaining % 3_600_000 / 60_000).toString().padStart(2, '0')}`;
  const name = (destination: 'mine' | 'saplings') => destination === 'mine' ? ko ? '광산' : 'Mine' : ko ? '묘목길' : 'Sapling path';
  return <View style={s.content}>
    <View style={s.intro}><Image source={require('../../assets/pets/squirrel-v1.png')} style={s.portrait} resizeMode="contain" />
      <View style={s.description}><Text style={s.title}>{pet?.owned ? ko ? '탐험 친구 · 다람쥐' : 'Your squirrel companion' : ko ? '첫 공동 퀘스트 보상' : 'First community quest reward'}</Text>
        <Text style={s.body}>{!pet || !community ? ko ? '탐험 정보를 불러오지 못했어요. 서버 저장에 다시 연결해 주세요.' : 'Expedition data is unavailable. Reconnect to server save.'
          : pet.owned ? ko ? '한 번에 한 곳만 탐험해요. 돌아오면 직접 수령해 주세요.' : 'One route at a time. Collect when it returns.'
            : ko ? '공동 자재 퀘스트를 하나 수령하면 영구 해금해요.' : 'Claim one material quest to unlock it permanently.'}</Text></View></View>
    {pet && community && (!pet.owned ? <Pressable accessibilityRole="button" disabled={!pet.questReady || locked}
      onPress={() => command({ type: 'claimSquirrel' })} style={[s.primary, (!pet.questReady || locked) && s.disabled]}>
      <Text style={s.primaryText}>{pet.questReady ? ko ? '퀘스트 보상 · 다람쥐 받기' : 'Claim squirrel quest reward' : ko ? '자재 퀘스트 1개 수령 필요' : 'Claim one material quest first'}</Text></Pressable>
      : trip ? <><Text style={s.title}>{name(trip.destination)} · {trip.reward.toLocaleString()} {trip.destination === 'mine' ? ko ? '코인' : 'coins' : ko ? '목재' : 'wood'}</Text>
        <Text style={s.body}>{ready ? ko ? '다람쥐가 돌아와 기다리고 있어요!' : 'The squirrel is back and waiting!' : ko ? `${timeLeft} 후 귀환` : `Returns in ${timeLeft}`}</Text>
        <Pressable accessibilityRole="button" disabled={!ready || locked} onPress={() => command({ type: 'collectSquirrel' })}
          style={[s.primary, (!ready || locked) && s.disabled]}><Text style={s.primaryText}>{ko ? '가져온 재화 수령' : 'Collect expedition reward'}</Text></Pressable></>
        : <><Text style={s.body}>{ko ? '4시간 탐험 · 출발 시 보상 확정 · 시설 레벨 반영' : '4-hour trip · Reward locked at dispatch · Facility level applies'}</Text>
          <View style={s.routes}>{community.facilities.map(item => <Pressable key={item.id} accessibilityRole="button" disabled={locked}
            onPress={() => command({ type: 'dispatchSquirrel', destination: item.id })} style={[s.route, locked && s.disabled]}>
            <Text style={s.routeName}>{item.id === 'mine' ? '⛏' : '🌱'} {name(item.id)}</Text>
            <Text style={s.body}>Lv.{item.level} · {ko ? '시설 보너스' : 'Facility bonus'} +{(item.level - 1) * 10}%</Text>
            <Text style={s.routeAmount}>+{squirrelReward(item.id, treeLevel, item.level).toLocaleString()} {item.id === 'mine' ? ko ? '코인' : 'coins' : ko ? '목재' : 'wood'}</Text></Pressable>)}</View></>)}
  </View>;
}

const s = StyleSheet.create({
  content: { gap: 12 }, intro: { flexDirection: 'row', alignItems: 'center', gap: 10 }, portrait: { width: 82, height: 90 },
  description: { flex: 1, gap: 5 }, title: { color: '#FFE091', fontSize: 14, fontWeight: '800' }, body: { color: '#D4E3D3', fontSize: 12, lineHeight: 18 },
  primary: { minHeight: 52, width: '100%', borderRadius: 15, backgroundColor: '#EEC65E', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  primaryText: { color: '#3B3524', fontSize: 14, fontWeight: '900', textAlign: 'center' }, disabled: { opacity: 0.43 },
  routes: { flexDirection: 'row', gap: 8 }, route: { flex: 1, minHeight: 68, borderRadius: 12, borderWidth: 1, borderColor: '#E4C477', backgroundColor: '#315B4A', alignItems: 'center', justifyContent: 'center', gap: 4 },
  routeName: { color: '#FFF0C7', fontWeight: '900', fontSize: 13 }, routeAmount: { color: '#FFE08D', fontWeight: '800', fontSize: 12 },
});
