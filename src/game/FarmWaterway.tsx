import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { SoundPressable as Pressable } from '../audio/GameAudio';
import { farmBoard, farmConnections } from './farm';
import { farmWaterRoute, nextFarmAngle } from './farm-presentation';

export function FarmWaterway({ seed, rotations, locked, ko, onRotate }: {
  seed: number; rotations: number[]; locked: boolean; ko: boolean; onRotate: (cell: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const path: readonly number[] = farmBoard(seed).path;
  const water = farmWaterRoute(seed, rotations);
  return <View style={s.board}>{Array.from({ length: 9 }, (_, cell) => <WaterTile key={cell}
    cell={cell} seed={seed} rotation={rotations[cell]} onPath={path.includes(cell)}
    selected={selected === cell} waterOrder={water.indexOf(cell)} locked={locked} ko={ko}
    onRotate={() => { setSelected(cell); onRotate(cell); }} />)}</View>;
}

function WaterTile({ cell, seed, rotation, onPath, selected, waterOrder, locked, ko, onRotate }: {
  cell: number; seed: number; rotation: number; onPath: boolean; selected: boolean;
  waterOrder: number; locked: boolean; ko: boolean; onRotate: () => void;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const angle = useRef(new Animated.Value(rotation * 90)).current;
  const targetAngle = useRef(rotation * 90);
  const flow = useRef(new Animated.Value(0)).current;
  const interactive = onPath && cell !== 0 && cell !== 8;
  const dirs = onPath ? farmConnections(seed, cell, 0) : [];
  useEffect(() => {
    const animation = Animated.sequence([Animated.delay(cell * 30), Animated.timing(enter, { toValue: 1, duration: 180, useNativeDriver: true })]);
    animation.start(); return () => animation.stop();
  }, [cell, enter]);
  useEffect(() => {
    targetAngle.current = nextFarmAngle(targetAngle.current, rotation);
    const animation = Animated.timing(angle, { toValue: targetAngle.current, duration: 140, useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [rotation, angle]);
  useEffect(() => {
    flow.setValue(0);
    if (waterOrder < 0) return;
    const animation = Animated.sequence([Animated.delay(waterOrder * 140), Animated.timing(flow, { toValue: 1, duration: 180, useNativeDriver: true })]);
    animation.start(); return () => animation.stop();
  }, [waterOrder, flow]);
  const limb = (dir: number) => dir === 0 ? s.north : dir === 1 ? s.east : dir === 2 ? s.south : s.west;
  return <Animated.View style={[s.tileSlot, { opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [.88, 1] }) }] }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={ko ? `흙 칸 ${cell + 1}${interactive ? ' 회전' : ''}` : `Soil tile ${cell + 1}${interactive ? ' rotate' : ''}`}
      accessibilityState={{ selected, disabled: locked || !interactive }} disabled={locked || !interactive} onPress={onRotate}
      style={[s.tile, onPath ? s.soil : s.rock, waterOrder >= 0 && s.connected, selected && s.selected]}>
      <Animated.View pointerEvents="none" style={[s.channels, { transform: [{ rotate: angle.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'], extrapolate: 'extend' }) }] }]}>
        {dirs.map(dir => <View key={dir} style={[s.root, limb(dir)]} />)}
        {onPath && <View style={s.rootCenter} />}
        <Animated.View style={[s.channels, { opacity: flow }]}>
          {dirs.map(dir => <View key={dir} style={[s.root, limb(dir), s.water]} />)}
          {onPath && <View style={[s.rootCenter, s.water]} />}
        </Animated.View>
      </Animated.View>
      <Animated.Text pointerEvents="none" style={[s.emoji, cell === 0 && { opacity: flow.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>{cell === 0 ? '🌰' : cell === 8 ? '💧' : onPath ? '' : '🪨'}</Animated.Text>
      {cell === 0 && <Animated.Text pointerEvents="none" style={[s.seedBloom, { opacity: flow, transform: [{ scale: flow.interpolate({ inputRange: [0, 1], outputRange: [.55, 1] }) }] }]}>🌱</Animated.Text>}
    </Pressable>
  </Animated.View>;
}

const s = StyleSheet.create({
  board: { width: '100%', maxWidth: 306, flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' },
  tileSlot: { width: '31%', aspectRatio: 1 }, tile: { flex: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2 },
  soil: { backgroundColor: '#6B5032', borderColor: '#AF8851' }, rock: { backgroundColor: '#435C4F', borderColor: '#6A8070' },
  selected: { borderColor: '#FFE8A5' }, connected: { borderColor: '#B8E87D' },
  channels: { position: 'absolute', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  root: { position: 'absolute', backgroundColor: '#F6D58A' },
  north: { width: 9, height: '50%', top: 0 }, east: { height: 9, width: '50%', right: 0 },
  south: { width: 9, height: '50%', bottom: 0 }, west: { height: 9, width: '50%', left: 0 },
  rootCenter: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#F6D58A' },
  water: { backgroundColor: '#8CE5ED', borderColor: '#D0FAEB', borderWidth: 1 },
  emoji: { fontSize: 27, zIndex: 2 }, seedBloom: { position: 'absolute', fontSize: 32, zIndex: 3 },
});
