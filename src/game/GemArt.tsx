import { View } from 'react-native';
import type { GemTier } from './progression';

export const GEM_COLORS: Record<GemTier, string> = {
  low: '#88BD9F', medium: '#58C9F0', high: '#B78AFF', supreme: '#FFAE65', legendary: '#FFE37A',
};
// Code-native faceted icons stay crisp without adding raster assets or dependencies.
export function GemArt({ tier, size = 76 }: { tier: GemTier; size?: number }) {
  const color = GEM_COLORS[tier];
  const crystal = (width: number, height: number, angle: string, left: number, top: number) => <View style={{
    position: 'absolute', width, height, left, top, transform: [{ rotate: angle }],
    borderRadius: tier === 'low' ? 9 : 3, backgroundColor: color, borderWidth: 2, borderColor: '#E6FFF5', overflow: 'hidden',
  }}>
    <View style={{ position: 'absolute', width: '50%', height: '100%', backgroundColor: '#FFFFFF', opacity: 0.24 }} />
    <View style={{ position: 'absolute', right: -8, bottom: -7, width: 34, height: 24, transform: [{ rotate: '35deg' }], backgroundColor: '#142E48', opacity: 0.35 }} />
  </View>;
  return <View pointerEvents="none" accessible={false} style={{ width: size, height: size }}><View style={{ position: 'absolute', left: (size - 76) / 2, top: (size - 76) / 2, width: 76, height: 76, transform: [{ scale: size / 76 }] }}>
    <View style={{ position: 'absolute', left: 8, top: 8, width: 60, height: 60, borderRadius: 30, backgroundColor: color, opacity: 0.1 }} />
    {tier === 'low' && crystal(30, 30, '30deg', 23, 23)}
    {tier === 'medium' && crystal(24, 46, '30deg', 26, 15)}
    {tier === 'high' && <>{crystal(34, 34, '45deg', 21, 22)}{crystal(14, 14, '45deg', 31, 32)}</>}
    {tier === 'supreme' && <>{crystal(17, 31, '-25deg', 11, 30)}{crystal(17, 31, '25deg', 48, 30)}{crystal(23, 44, '0deg', 26, 13)}</>}
    {tier === 'legendary' && <>
      <View style={{ position: 'absolute', width: 58, height: 58, left: 9, top: 9, borderRadius: 29, borderWidth: 2, borderColor: color }} />
      {crystal(31, 31, '45deg', 22, 23)}
      {[10, 35, 60].map((left, i) => <View key={left} style={{ position: 'absolute', left, top: i === 1 ? 2 : 15, width: 7, height: 7, backgroundColor: '#FFF6C0', transform: [{ rotate: '45deg' }] }} />)}
    </>}
  </View></View>;
}
