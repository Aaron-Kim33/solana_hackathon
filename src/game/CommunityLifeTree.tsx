import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { SoundPressable as Pressable } from '../audio/GameAudio';
import type { CommunityFacilityId, CommunitySnapshot } from '../shared/community';
import { communityLevelUps, confirmedContributions, lifeTreePlacement, lifeTreeStage } from './community-presentation';

/** Painted sprite; finite native animations, no timers or repeating particles. */
export function CommunityLifeTree({ state, language, onPress }: { state: CommunitySnapshot; language: 'ko' | 'en'; onPress: () => void }) {
  const stage = lifeTreeStage(state);
  const placement = lifeTreePlacement();
  const previous = useRef(state);
  const growth = useRef(new Animated.Value(0)).current;
  const flight = useRef(new Animated.Value(1)).current;
  const [source, setSource] = useState<CommunityFacilityId>('mine');
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    growth.stopAnimation(); flight.stopAnimation();
    growth.setValue(0); flight.setValue(1);
    if (before.weekStart !== state.weekStart) return;
    const donated = confirmedContributions(before, state);
    const leveled = communityLevelUps(before, state).length > 0;
    if (!donated.length && !leveled) return;
    if (donated.length) { setSource(donated[0]); flight.setValue(0); }
    const animations = [Animated.sequence([
      Animated.timing(growth, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(growth, { toValue: 0, duration: leveled ? 1100 : 650, useNativeDriver: true }),
    ])];
    if (donated.length) animations.push(Animated.timing(flight, { toValue: 1, duration: 750, useNativeDriver: true }));
    const animation = Animated.parallel(animations);
    animation.start();
    return () => animation.stop();
  }, [state, flight, growth]);
  const scale = stage === 0 ? 0.7 : stage === 1 ? 0.85 : 1;
  const centerX = size.width * placement.centerX;
  const groundY = size.height * placement.groundY;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={event => setSize(event.nativeEvent.layout)}>
    <Animated.View style={[s.tree, { left: centerX - 60, top: groundY - 140, transform: [{ scale: growth.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }]}>
      <View pointerEvents="none" style={s.shadow} />
      <Animated.View pointerEvents="none" style={[s.halo, { opacity: growth }]} />
      <Pressable accessibilityRole="button" accessibilityLabel={language === 'ko' ? '생명나무 설명 보기' : 'About the life tree'}
        onPress={onPress} hitSlop={{ bottom: 18 }} style={s.touch}>
      <Image source={require('../../assets/community/life-tree-v2.png')} resizeMode="contain"
        style={[s.art, { width: 120 * scale, height: 140 * scale }]} />
      <Text style={s.label}>{language === 'ko' ? '생명나무 ⓘ' : 'Life tree ⓘ'}</Text>
      </Pressable>
    </Animated.View>
    <Animated.View pointerEvents="none" style={[s.light, { left: centerX - 7, top: groundY - 60,
      opacity: flight.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
      transform: [
        { translateX: flight.interpolate({ inputRange: [0, 1], outputRange: [size.width * (source === 'mine' ? 0.25 : 0.75) - centerX, 0] }) },
        { translateY: flight.interpolate({ inputRange: [0, 0.5, 1], outputRange: [size.height * 0.55 - (groundY - 60), -55, 0] }) },
      ],
    }]} />
  </View>;
}

const s = StyleSheet.create({
  tree: { position: 'absolute', width: 120, height: 140, alignItems: 'center', justifyContent: 'flex-end' },
  touch: { width: 120, height: 140, alignItems: 'center', justifyContent: 'flex-end' },
  shadow: { position: 'absolute', bottom: 0, left: 32, width: 56, height: 10, borderRadius: 28, backgroundColor: '#264D3877' },
  halo: { position: 'absolute', left: 0, bottom: 0, width: 120, height: 120, borderRadius: 60, backgroundColor: '#FFE69E44' },
  art: { position: 'absolute', bottom: 0 },
  label: { position: 'absolute', bottom: -18, color: '#FFF2C6', backgroundColor: '#123B32E8', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, fontWeight: '900' },
  light: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFE79E', borderWidth: 3, borderColor: '#FFF8D9' },
});
