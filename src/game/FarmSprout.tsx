import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export function FarmSprout({ planted, watered, ready, celebrate }: { planted: boolean; watered: boolean; ready: boolean; celebrate: number }) {
  const bloom = useRef(new Animated.Value(watered ? 1 : 0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(bloom, { toValue: watered ? 1 : 0, duration: 380, useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [watered, bloom]);
  useEffect(() => {
    if (!celebrate) return;
    sparkle.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(sparkle, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(700), Animated.timing(sparkle, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]);
    animation.start(); return () => animation.stop();
  }, [celebrate, sparkle]);
  return <View pointerEvents="none" style={s.art}>
    <View style={s.shadow} /><View style={s.soil} />
    {planted && <><View style={[s.stem, ready && s.readyStem]} />
      <Animated.View style={[s.leaf, s.left, ready && s.readyLeaf, { transform: [{ rotate: bloom.interpolate({ inputRange: [0, 1], outputRange: ['35deg', '-15deg'] }) }, { scale: bloom.interpolate({ inputRange: [0, 1], outputRange: [.65, 1] }) }] }]} />
      <Animated.View style={[s.leaf, s.right, ready && s.readyLeaf, { transform: [{ rotate: bloom.interpolate({ inputRange: [0, 1], outputRange: ['-35deg', '15deg'] }) }, { scale: bloom.interpolate({ inputRange: [0, 1], outputRange: [.65, 1] }) }] }]} />
      {ready && <View style={s.newLeaf} />}
    </>}
    {[0, 1, 2].map(index => <Animated.View key={index} style={[s.sparkle, { left: 8 + index * 24, top: index === 1 ? 2 : 18, opacity: sparkle,
      transform: [{ scale: sparkle.interpolate({ inputRange: [0, 1], outputRange: [.4, 1] }) }, { rotate: '45deg' }] }]} />)}
  </View>;
}
const s = StyleSheet.create({
  art: { width: 84, height: 78, marginVertical: 5 }, shadow: { position: 'absolute', bottom: 2, left: 9, width: 66, height: 14, borderRadius: 33, backgroundColor: '#143A30' },
  soil: { position: 'absolute', bottom: 7, left: 17, width: 50, height: 17, borderRadius: 25, backgroundColor: '#9B754A', borderTopWidth: 3, borderColor: '#BE9560' },
  stem: { position: 'absolute', bottom: 18, left: 40, width: 5, height: 27, borderRadius: 3, backgroundColor: '#91BD67' }, readyStem: { height: 36 },
  leaf: { position: 'absolute', width: 28, height: 17, backgroundColor: '#A7D879', borderWidth: 1, borderColor: '#C7E99B' },
  left: { left: 15, top: 24, borderTopLeftRadius: 20, borderBottomRightRadius: 20 },
  right: { left: 43, top: 19, borderTopRightRadius: 20, borderBottomLeftRadius: 20, backgroundColor: '#7EB95F' },
  readyLeaf: { top: 16, height: 20 }, newLeaf: { position: 'absolute', top: 5, left: 38, width: 15, height: 23, borderTopLeftRadius: 18, borderBottomRightRadius: 18, backgroundColor: '#C2E18A' },
  sparkle: { position: 'absolute', width: 7, height: 7, borderRadius: 2, backgroundColor: '#FFE6A1' },
});
