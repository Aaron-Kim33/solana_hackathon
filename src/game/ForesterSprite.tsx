import { memo, useRef } from 'react';
import { Animated, Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Progress } from './progression';

const BODY = require('../../assets/forester/mascot-body.png');
const ARM = require('../../assets/forester/mascot-forearm.png');
const ELBOW = { x: 130, y: 133 };
const PALETTES = {
  default: { metal: '#B5CFCD', edge: '#F0F7EA', shaft: '#92613C' },
  firstRecord: { metal: '#9555E8', edge: '#55F0BA', shaft: '#67439C' },
  pioneer: { metal: '#C79143', edge: '#FFE4A0', shaft: '#386C68' },
  warden: { metal: '#58B3D2', edge: '#C6F6FF', shaft: '#284E63' },
  recovery: { metal: '#74A878', edge: '#D8F5B4', shaft: '#71553B' },
};

/** Body, elbow and grip share one coordinate space; no independently drifting hand. */
export const ForesterSprite = memo(function ForesterSprite({ motion, skin, crowned = false, size = 240, style }: {
  motion?: Animated.Value; skin: Progress['axeSkin']; crowned?: boolean; size?: number; style?: StyleProp<ViewStyle>;
}) {
  const idle = useRef(new Animated.Value(0)).current;
  const phase = motion ?? idle;
  const palette = PALETTES[skin];
  const poses = [0, 0.25, 0.5, 1];
  return <View pointerEvents="none" style={[{ width: size, height: size }, style]}><Animated.View style={[s.root, { transform: [
    { translateX: (size - 240) / 2 }, { translateY: (size - 240) / 2 }, { scale: size / 240 },
    { translateX: phase.interpolate({ inputRange: poses, outputRange: [0, -3, 14, 0], extrapolate: 'clamp' }) },
    { rotate: phase.interpolate({ inputRange: poses, outputRange: ['0deg', '-2deg', '4deg', '0deg'], extrapolate: 'clamp' }) },
  ] }]}>
    <Image source={BODY} style={s.body} resizeMode="contain" resizeMethod="resize" />
    <Animated.View style={[s.elbow, { transform: [{ rotate: phase.interpolate({
      inputRange: poses, outputRange: ['0deg', '-50deg', '35deg', '0deg'], extrapolate: 'clamp',
    }) }] }]}>
      <View style={s.axe}>
        <View style={[s.shaft, { backgroundColor: palette.shaft }]} />
        <View style={[s.blade, { backgroundColor: crowned ? '#CEA247' : palette.metal, borderRightColor: palette.edge }]} />
        <View style={s.axeCollar} />
      </View>
      <Image source={ARM} style={s.forearm} resizeMode="contain" resizeMethod="resize" />
    </Animated.View>
    {/* Original sleeve cuff covers the round elbow joint throughout the rotation. */}
    <View style={s.cuff}><Image source={BODY} style={s.cuffImage} resizeMode="contain" resizeMethod="resize" /></View>
  </Animated.View></View>;
});

const s = StyleSheet.create({
  root: { width: 240, height: 240 },
  body: { width: 240, height: 240 },
  elbow: { position: 'absolute', left: ELBOW.x, top: ELBOW.y, width: 0, height: 0, overflow: 'visible' },
  // The extracted art has a different transparent margin; align its round elbow to (0, 0).
  forearm: { position: 'absolute', left: -31, top: -45, width: 88, height: 88, zIndex: 2 },
  axe: { position: 'absolute', left: 27, top: -1, width: 0, height: 0, zIndex: 1 },
  shaft: { position: 'absolute', left: -4, top: -33, width: 7, height: 58, borderRadius: 4, borderLeftWidth: 1, borderLeftColor: '#D8AF73' },
  blade: { position: 'absolute', left: -5, top: -34, width: 32, height: 21, borderTopRightRadius: 10, borderBottomRightRadius: 7, borderTopLeftRadius: 3, borderBottomLeftRadius: 3, borderRightWidth: 5, borderBottomWidth: 3, borderBottomColor: '#24464366' },
  axeCollar: { position: 'absolute', left: -5, top: -14, width: 9, height: 5, backgroundColor: '#5C5447', borderRadius: 1 },
  cuff: { position: 'absolute', left: 116, top: 117, width: 14, height: 27, overflow: 'hidden' },
  cuffImage: { position: 'absolute', left: -116, top: -117, width: 240, height: 240 },
});
