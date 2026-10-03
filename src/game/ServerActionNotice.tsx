import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SoundPressable as Pressable } from '../audio/GameAudio';

export type ServerActionNoticeProps = { notice?: string; pending?: boolean; busy?: boolean; language: 'ko' | 'en'; onRetry?: () => void };
export function ServerActionNotice({ notice, pending, busy, language, onRetry }: ServerActionNoticeProps) {
  // Ordinary in-flight attacks must not insert/remove a notice row each hit.
  if (!notice && (!pending || busy)) return null;
  const ko = language === 'ko';
  return <View style={s.card}>
    <ScrollView style={s.message} nestedScrollEnabled><Text accessibilityLiveRegion="polite" style={s.text}>
      {notice || (ko ? '서버 응답을 확인하고 있어요…' : 'Checking the server response…')}
    </Text></ScrollView>
    {pending && onRetry && <Pressable accessibilityRole="button" disabled={busy} onPress={onRetry} style={[s.retry, busy && s.disabled]}>
      <Text style={s.retryText}>{busy ? ko ? '확인 중…' : 'Checking…' : ko ? '같은 요청 재확인' : 'Retry same request'}</Text>
    </Pressable>}
  </View>;
}
const s = StyleSheet.create({
  card: { marginHorizontal: 12, marginVertical: 5, padding: 10, gap: 6, borderRadius: 12, borderWidth: 1, borderColor: '#D6BA70', backgroundColor: '#173D35' },
  message: { maxHeight: 65 }, text: { color: '#FFE3A2', fontSize: 12, lineHeight: 18 },
  retry: { alignSelf: 'flex-end', minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 9, backgroundColor: '#E9C66B' },
  retryText: { color: '#303C2D', fontSize: 12, fontWeight: '800' }, disabled: { opacity: .5 },
});
