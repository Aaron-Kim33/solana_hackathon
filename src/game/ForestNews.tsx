import { StyleSheet, Text } from 'react-native';
import { SoundPressable } from '../audio/GameAudio';
import type { ForestNewsKind } from './forest-news';

const labels = {
  pet: ['🐿️ 다람쥐가 돌아왔어요!', '🐿️ Your squirrel is back!'],
  farm: ['🌱 묘목이 다 자랐어요!', '🌱 Your sapling is ready!'],
  boss: ['🌲 보스 보상을 받아요!', '🌲 Boss rewards are ready!'],
} as const;

export function ForestNews({ kind, language, onPress }: {
  kind: ForestNewsKind; language: 'ko' | 'en'; onPress: () => void;
}) {
  const label = labels[kind][language === 'ko' ? 0 : 1];
  return <SoundPressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityHint={language === 'ko' ? '눌러서 확인하기' : 'Open to collect'}
    onPress={onPress} style={({ pressed }) => [styles.news, pressed && { opacity: .8 }]}>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.8} style={styles.text}>{label}</Text>
    <Text pointerEvents="none" style={styles.arrow}>›</Text>
  </SoundPressable>;
}

const styles = StyleSheet.create({
  news: { position: 'absolute', top: 12, left: 78, right: 16, zIndex: 22,
    minHeight: 44, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#103B35EE', borderWidth: 1, borderColor: '#E3CA7BAA',
    flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { color: '#FFF1CA', fontSize: 13, fontWeight: '800', flex: 1 },
  arrow: { color: '#F4D16E', fontSize: 22, fontWeight: '800' },
});
