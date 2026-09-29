import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { translate, type Language, type TranslationKey } from '../i18n';
import type { TutorialStep } from './tutorial';

const messageKey: Record<TutorialStep, TranslationKey> = {
  chop: 'tutorialChop', storage: 'tutorialStorage', sweep: 'tutorialSweep', trolley: 'tutorialTrolley',
  tree: 'tutorialTree', axe: 'tutorialAxe', character: 'tutorialCharacter', fatigue: 'tutorialFatigue',
};
const placement: Record<TutorialStep, ViewStyle> = {
  chop: { top: 50, right: 12 },
  storage: { bottom: 110, left: 8 },
  sweep: { bottom: 118, right: 14 },
  trolley: { bottom: 108, right: 8 },
  tree: { bottom: 102, right: 8 },
  axe: { top: 12, left: 66 },
  character: { bottom: 164, left: 8 },
  fatigue: { top: 8, right: 12 },
};
const fingerPosition: Record<TutorialStep, ViewStyle> = {
  chop: { left: '66%', top: '50%' },
  storage: { left: '39%', bottom: 32 },
  sweep: { left: '31%', bottom: 30 },
  trolley: { right: 47, bottom: 37 },
  tree: { left: '49%', top: '48%' },
  axe: { left: 30, top: 55 },
  character: { left: '35%', bottom: 127 },
  fatigue: { left: 35, top: 3 },
};

export function TutorialNudge({ step, language, onDismiss }: { step: TutorialStep; language: Language; onDismiss: () => void }) {
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    phase.setValue(0);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(phase, { toValue: 1, duration: step === 'storage' || step === 'sweep' ? 1250 : 900, useNativeDriver: true }),
      Animated.delay(380),
    ]));
    loop.start();
    return () => loop.stop();
  }, [phase, step]);
  const dragging = step === 'storage' || step === 'sweep';
  const moveX = phase.interpolate({ inputRange: [0, 1], outputRange: [0, step === 'storage' ? -105 : step === 'sweep' ? 95 : 0] });
  const moveY = phase.interpolate({ inputRange: [0, 1], outputRange: [0, step === 'storage' ? 10 : 0] });
  const scale = phase.interpolate({ inputRange: [0, 0.55, 1], outputRange: dragging ? [1, 1, 1] : [1, 0.78, 1] });
  const opacity = phase.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0.45, 1, 1, 0.35] });
  return <>
    <View pointerEvents="box-none" style={[styles.position, placement[step]]}>
      <View pointerEvents="box-none" style={styles.bubble}>
        <Text pointerEvents="none" style={styles.leaf}>✦</Text>
        <Text pointerEvents="none" style={styles.message}>{translate(language, messageKey[step])}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={translate(language, 'tutorialDismiss')}
          onPress={onDismiss} hitSlop={8} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
      </View>
    </View>
    {step !== 'fatigue' && <Animated.View pointerEvents="none" style={[styles.finger, fingerPosition[step],
      { opacity, transform: [{ translateX: moveX }, { translateY: moveY }, { scale }] }]}>
      <Text style={styles.fingerIcon}>{dragging ? '☝️' : '👆'}</Text>
    </Animated.View>}
  </>;
}

const styles = StyleSheet.create({
  position: { position: 'absolute', zIndex: 22, maxWidth: '75%' },
  bubble: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 50, paddingVertical: 8,
    paddingLeft: 10, paddingRight: 6, backgroundColor: '#FFF2D6', borderColor: '#D6AA6A', borderWidth: 2,
    borderRadius: 18, shadowColor: '#17352E', shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  leaf: { color: '#5F9B70', fontSize: 19, fontWeight: '900' },
  message: { flexShrink: 1, color: '#4E3B2F', fontSize: 13, lineHeight: 18, fontWeight: '900' },
  close: { width: 24, height: 28, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#806D55', fontSize: 22, lineHeight: 25, fontWeight: '700' },
  finger: { position: 'absolute', zIndex: 23, width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: 22, backgroundColor: '#FFF2D6B8', borderWidth: 2, borderColor: '#FFDA8C' },
  fingerIcon: { fontSize: 27, textShadowColor: '#17352E', textShadowRadius: 4 },
});
