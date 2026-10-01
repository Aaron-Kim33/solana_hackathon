import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SoundPressable as Pressable, useGameAudio } from '../audio/GameAudio';
import { BLESSING_COST, FARM_PLANT_COST, FARM_QUICK_MS, farmBoard, farmConnections, farmOf, farmSolved, farmToday, blessingMultiplier } from './farm';
import type { Progress } from './progression';

type Props = { progress: Progress; now: number; locked: boolean;
  onSeed: (plot: 0 | 1) => void; onBless: () => void;
  onStart: (plot: 0 | 1) => void; onPlant: (rotations: number[]) => void; onClaim: (plot: 0 | 1) => void };
const remaining = (ms: number) => {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export function FarmWorld({ progress, now, locked, onSeed, onBless, onStart, onPlant, onClaim }: Props) {
  const { play: playSound } = useGameAudio();
  const ko = progress.language === 'ko';
  const farm = farmOf(progress), puzzle = farm.puzzle;
  const [rotations, setRotations] = useState<number[]>(() => puzzle ? farmBoard(puzzle.seed).rotations : Array(9).fill(0));
  useEffect(() => { setRotations(puzzle ? farmBoard(puzzle.seed).rotations : Array(9).fill(0)); }, [puzzle?.seed, puzzle?.startedAt]);
  const board = puzzle ? farmBoard(puzzle.seed) : null;
  const solved = puzzle ? farmSolved(puzzle.seed, rotations) : false;
  const quick = solved && !!puzzle && now - puzzle.startedAt <= FARM_QUICK_MS;
  const solvedRef = useRef(solved);
  useEffect(() => { if (solved && !solvedRef.current) playSound('water'); solvedRef.current = solved; }, [solved, playSound]);
  return <ScrollView contentContainerStyle={s.screen}>
    <View style={s.intro}>
      <Text style={s.eyebrow}>{ko ? '개인 숲 · 복원의 자리' : 'Personal forest · restoration'}</Text>
      <Text style={s.title}>{ko ? '🌱 묘목 농장' : '🌱 Sapling farm'}</Text>
      <Text style={s.copy}>{ko ? '베어 낸 만큼 다시 심어요. 물길을 잇고 묘목을 숲에 이식하면 카르마가 쌓여요.'
        : 'Plant as you chop. Guide roots to water, then transplant grown saplings to earn karma.'}</Text>
      <View style={s.counters}><Text style={s.counter}>{ko ? '카르마' : 'Karma'} {farm.karma}</Text>
        <Text style={s.counter}>{ko ? '오늘 심기' : 'Planted today'} {farmToday(farm, now)} · {ko ? '횟수 제한 없음' : 'Unlimited'}</Text></View>
    </View>
    <View style={s.intro}>
      <Text style={s.heading}>{ko ? '✨ 숲의 축복' : '✨ Forest blessing'}</Text>
      <Text style={s.copy}>{ko ? '20분 동안 벌목 목재·코인 2배\n퀘스트·펫 보상에는 적용되지 않아요.' : 'Double chopping wood and coins for 20 minutes.\nQuest and pet rewards are unchanged.'}</Text>
      <Pressable sound={false} accessibilityRole="button" disabled={locked || farm.karma < BLESSING_COST || blessingMultiplier(progress, now) === 2}
        onPress={onBless} style={[s.primary, (locked || farm.karma < BLESSING_COST || blessingMultiplier(progress, now) === 2) && s.disabled]}>
        <Text style={s.primaryText}>{blessingMultiplier(progress, now) === 2 ? `${ko ? '축복 중' : 'Active'} · ${remaining((farm.blessingUntil ?? 0) - now)}` : `${ko ? '축복 받기 · 카르마' : 'Activate · Karma'} ${BLESSING_COST}`}</Text>
      </Pressable>
    </View>
    {puzzle && board && <View style={s.puzzleCard}>
      <Text style={s.heading}>{ko ? `밭 ${puzzle.plot + 1} · 뿌리 물길 잇기` : `Plot ${puzzle.plot + 1} · Root waterway`}</Text>
      <Text style={s.copy}>{ko ? '흙 칸을 탭해 뿌리를 돌리고, 씨앗에서 물방울까지 이어 주세요.' : 'Tap soil tiles to rotate roots from the seed to the water.'}</Text>
      <View style={s.board}>{Array.from({ length: 9 }, (_, cell) => {
        const onPath = (board.path as readonly number[]).includes(cell);
        const interactive = onPath && cell !== 0 && cell !== 8;
        const dirs = onPath ? farmConnections(puzzle.seed, cell, rotations[cell]) : [];
        return <Pressable key={cell} accessibilityRole="button" accessibilityLabel={ko ? `흙 칸 ${cell + 1}${interactive ? ' 회전' : ''}` : `Soil tile ${cell + 1}${interactive ? ' rotate' : ''}`}
          disabled={!interactive} onPress={() => setRotations(current => current.map((value, index) => index === cell ? (value + 1) % 4 : value))}
          style={[s.tile, onPath ? s.soil : s.rock, solved && onPath && s.solvedTile]}>
          {dirs.map(dir => <View key={dir} style={[s.root, dir === 0 ? s.north : dir === 1 ? s.east : dir === 2 ? s.south : s.west]} />)}
          {onPath && <View style={s.rootCenter} />}
          <Text style={s.tileEmoji}>{cell === 0 ? '🌰' : cell === 8 ? '💧' : onPath ? '' : '🪨'}</Text>
        </Pressable>;
      })}</View>
      <Text style={s.result}>{solved ? quick ? ko ? '✨ 물길 완성 · 성장 시간 10% 단축' : '✨ Connected · grows 10% faster'
        : ko ? '🌿 물길 완성 · 물을 주세요' : '🌿 Connected · water your sapling'
        : ko ? '씨앗에서 물방울까지 물길을 이어 주세요.' : 'Connect the seed to the water.'}</Text>
      <Pressable accessibilityRole="button" disabled={locked || !solved || (!farm.plots[puzzle.plot] && progress.wood < FARM_PLANT_COST)} onPress={() => onPlant(rotations)}
        style={[s.primary, (locked || !solved) && s.disabled]}><Text style={s.primaryText}>{ko ? '물주기 완료 · 성장 시작' : 'Finish watering · start growing'}</Text></Pressable>
    </View>}
    <View style={s.plots}>{([0, 1] as const).map(index => {
      const plot = farm.plots[index], waiting = !!plot && plot.readyAt === 0, ready = !!plot && !waiting && now >= plot.readyAt;
      const canStart = !plot && !puzzle && progress.wood >= FARM_PLANT_COST;
      return <View key={index} style={s.plot}>
        <Text style={s.heading}>{ko ? `밭 ${index + 1}` : `Plot ${index + 1}`}</Text>
        <Text style={s.plotArt}>{plot ? ready ? '🌳' : '🌱' : '🟫'}</Text>
        <Text style={s.copy}>{plot ? waiting ? ko ? '심기 완료 · 물을 기다려요' : 'Planted · waiting for water' : ready ? ko ? '튼튼하게 자랐어요!' : 'Ready to transplant!' : `${ko ? '성장까지' : 'Growing'} ${remaining(plot.readyAt - now)}`
          : puzzle?.plot === index ? ko ? '물길을 잇는 중' : 'Connecting roots' : ko ? '비어 있는 밭' : 'Empty plot'}</Text>
        {ready ? <Pressable accessibilityRole="button" disabled={locked} onPress={() => onClaim(index)} style={[s.primary, locked && s.disabled]}>
          <Text style={s.primaryText}>{ko ? '숲에 이식 · 카르마 +1' : 'Transplant · Karma +1'}</Text></Pressable>
          : waiting ? <Pressable accessibilityRole="button" disabled={locked || !!puzzle} onPress={() => onStart(index)} style={[s.secondary, (locked || !!puzzle) && s.disabled]}>
            <Text style={s.secondaryText}>{puzzle?.plot === index ? ko ? '물길 잇는 중' : 'Connecting water' : ko ? '💧 물주기' : '💧 Water sapling'}</Text></Pressable>
          : !plot && <Pressable accessibilityRole="button" disabled={!canStart || locked} onPress={() => onSeed(index)} style={[s.secondary, (!canStart || locked) && s.disabled]}>
            <Text style={s.secondaryText}>{puzzle?.plot === index ? ko ? '물길 잇는 중' : 'Connecting water' : `${ko ? '묘목 심기 · 목재' : 'Plant · wood'} ${FARM_PLANT_COST}`}</Text></Pressable>}
      </View>;
    })}</View>
    <Text style={s.foot}>{ko ? `목재 ${progress.wood.toLocaleString()}개 · 심기 → 물주기 → 성장 → 이식\n첫 수확 전 30초, 이후 30분 성장 · 반복 제한 없음` :
      `${progress.wood.toLocaleString()} wood · Plant → water → grow → transplant\nBefore first harvest: 30 sec, then 30 min · unlimited repeats`}</Text>
  </ScrollView>;
}

const s = StyleSheet.create({
  screen: { flexGrow: 1, padding: 16, gap: 14, backgroundColor: '#153A32' },
  intro: { padding: 18, borderRadius: 22, backgroundColor: '#235440', gap: 8, borderWidth: 1, borderColor: '#95B981' },
  eyebrow: { color: '#C4E7AE', fontSize: 11, fontWeight: '800' },
  title: { color: '#FFF3CF', fontSize: 25, fontWeight: '900' },
  heading: { color: '#FFF0C8', fontSize: 16, fontWeight: '900' },
  copy: { color: '#D5E7D4', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  counters: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  counter: { color: '#FFE49B', fontSize: 13, fontWeight: '900' },
  plots: { flexDirection: 'row', gap: 10 },
  plot: { flex: 1, minHeight: 202, padding: 12, alignItems: 'center', justifyContent: 'space-between', borderRadius: 19, borderWidth: 1, borderColor: '#78946C', backgroundColor: '#284C3D', gap: 6 },
  plotArt: { fontSize: 44, marginVertical: 6 },
  primary: { minHeight: 44, borderRadius: 12, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0CB72' },
  primaryText: { color: '#3D3527', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  secondary: { minHeight: 44, borderRadius: 12, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#AAD7A2' },
  secondaryText: { color: '#24402E', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  disabled: { opacity: 0.45 },
  puzzleCard: { padding: 14, gap: 9, borderRadius: 20, backgroundColor: '#1D4B3B', borderWidth: 1, borderColor: '#D9BB70', alignItems: 'center' },
  board: { width: '100%', maxWidth: 306, flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' },
  tile: { width: '31%', aspectRatio: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2 },
  soil: { backgroundColor: '#6B5032', borderColor: '#AF8851' }, rock: { backgroundColor: '#435C4F', borderColor: '#6A8070' },
  solvedTile: { borderColor: '#B8E87D' }, tileEmoji: { fontSize: 27, zIndex: 2 },
  root: { position: 'absolute', backgroundColor: '#F6D58A' },
  north: { width: 9, height: '50%', top: 0 }, east: { height: 9, width: '50%', right: 0 },
  south: { width: 9, height: '50%', bottom: 0 }, west: { height: 9, width: '50%', left: 0 },
  rootCenter: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#F6D58A' },
  result: { color: '#DDF2C9', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  foot: { color: '#BDD5BF', fontSize: 11, textAlign: 'center', lineHeight: 17 },
});
