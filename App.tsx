import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Linking,
  ScrollView,
  Platform,
  StatusBar as NativeStatusBar,
  PanResponder,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { connectWallet, ConnectedWallet } from './src/solana/wallet';
import { recordHarvest } from './src/solana/achievement';
import { GameMessage, Language, translate, TranslationKey } from './src/i18n';

type Log = {
  id: number;
  left: number;
  top: number;
  value: number;
  expiresAt: number;
};

type DamagePopup = {
  id: number;
  value: number;
  left: number;
  top: number;
};

const MAX_TREE_HP = 100;
const MAX_FATIGUE = 100;
const LOG_LIFETIME_MS = 5000;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export default function App() {
  const [treeHp, setTreeHp] = useState(MAX_TREE_HP);
  const [fatigue, setFatigue] = useState(8);
  const [wood, setWood] = useState(0);
  const [logs, setLogs] = useState<Log[]>([]);
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
  const [mode, setMode] = useState<'chop' | 'collect'>('chop');
  const [language, setLanguage] = useState<Language>(__DEV__ ? 'ko' : 'en');
  const t = (key: TranslationKey, value?: string | number) => translate(language, key, value);
  const [message, setMessage] = useState<GameMessage>({ key: 'intro' });
  const [recording, setRecording] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const recordLock = useRef(false);
  const shake = useRef(new Animated.Value(0)).current;
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const nextLogId = useRef(1);
  const nextEffectId = useRef(1);
  const lastHit = useRef(0);
  const activeLogs = useRef(new Map<number, Log>());
  const draggingLogs = useRef(new Set<number>());

  const syncDragMode = useCallback((id: number, dragging: boolean) => {
    if (dragging) draggingLogs.current.add(id);
    else draggingLogs.current.delete(id);
    setMode(draggingLogs.current.size > 0 ? 'collect' : 'chop');
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, log] of activeLogs.current) {
        if (now >= log.expiresAt) {
          activeLogs.current.delete(id);
          draggingLogs.current.delete(id);
          changed = true;
        }
      }
      if (changed) {
        setLogs([...activeLogs.current.values()]);
        setMode(draggingLogs.current.size > 0 ? 'collect' : 'chop');
      }
    }, 50);
    return () => clearInterval(timer);
  }, []);

  const axePower = useMemo(() => {
    if (fatigue >= 88) return 2;
    if (fatigue >= 65) return 4;
    return 7;
  }, [fatigue]);

  useEffect(() => {
    const timer = setInterval(() => {
      setFatigue((current) => Math.max(0, current - 1));
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  const chop = useCallback(() => {
    if (draggingLogs.current.size > 0) {
      setMessage({ key: 'dragging' });
      return;
    }
    if (fatigue >= MAX_FATIGUE) {
      setMessage({ key: 'tired' });
      return;
    }

    const now = Date.now();
    const rhythmBonus = now - lastHit.current > 160 && now - lastHit.current < 620 ? 2 : 0;
    lastHit.current = now;
    const damage = axePower + rhythmBonus;
    shake.stopAnimation();
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 7, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -5, duration: 55, useNativeDriver: true }),
      Animated.spring(shake, { toValue: 0, speed: 28, bounciness: 8, useNativeDriver: true }),
    ]).start();
    const remainingHp = treeHp - damage;
    const effectId = nextEffectId.current++;
    const droppedLog: Log = {
      id: nextLogId.current++,
      left: 10 + Math.floor(Math.random() * 70),
      top: 54 + Math.floor(Math.random() * 17),
      value: Math.max(1, Math.ceil(damage / 3)),
      expiresAt: now + LOG_LIFETIME_MS,
    };

    setTreeHp(remainingHp <= 0 ? MAX_TREE_HP : remainingHp);
    setFatigue((current) => clamp(current + 7, 0, MAX_FATIGUE));
    setDamagePopups((current) => [
      ...current.slice(-2),
      { id: effectId, value: damage, left: 67 + Math.floor(Math.random() * 9), top: 30 + Math.floor(Math.random() * 14) },
    ]);
    setTimeout(() => {
      setDamagePopups((current) => current.filter((popup) => popup.id !== effectId));
    }, 760);

    activeLogs.current.set(droppedLog.id, droppedLog);
    setLogs([...activeLogs.current.values()]);
    setMessage({ key: remainingHp <= 0 ? 'felled' : rhythmBonus ? 'rhythm' : 'dropped', value: droppedLog.value });
  }, [axePower, fatigue, treeHp, shake]);

  const collectLog = useCallback((id: number) => {
    const target = activeLogs.current.get(id);
    if (!target) return;
    activeLogs.current.delete(id);
    setLogs([...activeLogs.current.values()]);
    if (Date.now() < target.expiresAt) {
      setWood((total) => total + target.value);
      setMessage({ key: 'collected', value: target.value });
    }
  }, []);

  const rest = () => {
    setFatigue((current) => Math.max(0, current - 28));
    setMessage({ key: 'rested' });
  };

  const handleWalletConnect = async () => {
    if (isConnectingWallet) return;
    setIsConnectingWallet(true);
    try {
      const connectedWallet = await connectWallet();
      setWallet(connectedWallet);
      setSignature(null);
      setMessage({ key: 'connected', value: connectedWallet.shortAddress });
    } catch (error) {
      setMessage({ key: 'walletError' });
      Alert.alert(t('wallet'), t('walletError'));
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleRecord = () => {
    if (!wallet || wood < 20 || recordLock.current || signature) return;
    Alert.alert(t('achievement'), t('recordConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('approve'), onPress: async () => {
        if (recordLock.current) return;
        recordLock.current = true;
        setRecording(true);
        try {
          const result = await recordHarvest(wallet.publicKey, (submitted) => setSignature(submitted));
          setMessage({ key: result.confirmed ? 'recorded' : 'recordPending' });
        } catch {
          setMessage({ key: 'recordError' });
        } finally {
          setRecording(false);
          recordLock.current = false;
        }
      } },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.languageRow}>
        <Text style={styles.progressLabel}>{t('language')}</Text>
        {(['ko', 'en'] as const).map((locale) => (
          <Pressable key={locale} accessibilityRole="button" accessibilityState={{ selected: language === locale }}
            onPress={() => setLanguage(locale)} style={[styles.languageButton, language === locale && styles.languageSelected]}>
            <Text style={styles.walletText}>{locale === 'ko' ? '한국어' : 'English'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>SEEKER FOREST · DEVNET</Text>
          <Text style={styles.title}>LUMBER RUSH</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('wallet')}
          disabled={recording || isConnectingWallet}
          onPress={handleWalletConnect}
          style={({ pressed }) => [styles.walletChip, pressed && styles.walletChipPressed]}
        >
          <View style={[styles.walletDot, wallet && styles.walletDotConnected]} />
          <Text style={styles.walletText}>
            {isConnectingWallet ? t('connecting') : wallet ? wallet.shortAddress : t('wallet')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <StatCard label={t('wood')} value={wood.toLocaleString(language)} accent="#F5C76B" />
        <StatCard label={t('axe')} value={`Lv. 1 · ${axePower}`} accent="#91D3B1" />
      </View>

      <View style={styles.progressGroup}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>{t('durability')}</Text>
          <Text style={styles.progressValue}>{Math.max(0, treeHp)} / {MAX_TREE_HP}</Text>
        </View>
        <Meter value={treeHp} max={MAX_TREE_HP} color="#C87348" />
        <View style={[styles.progressLabelRow, styles.fatigueRow]}>
          <Text style={styles.progressLabel}>{t('fatigue')}</Text>
          <Text style={styles.progressValue}>{fatigue}%</Text>
        </View>
        <Meter value={fatigue} max={MAX_FATIGUE} color={fatigue > 65 ? '#EC7A67' : '#EFC75E'} />
      </View>

      <View style={styles.forest}>
        <View style={styles.moon} />
        <View style={styles.hillBack} />
        <View style={styles.hillFront} />
        <Animated.View style={[styles.treeButton, { transform: [{ translateX: shake }] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chop')}
          disabled={mode === 'collect'}
          onPress={chop}
          style={({ pressed }) => [styles.treeTouch, pressed && styles.treePressed, mode === 'collect' && styles.treeDisabled]}
        >
          <View pointerEvents="none" style={styles.canopy}>
            <View style={styles.leafLeft} />
            <View style={styles.leafRight} />
            <View style={styles.leafTop} />
            <View style={styles.leafGlint} />
          </View>
          <View style={styles.trunk}>
            <View style={styles.trunkLine} />
            <View style={styles.treeKnot} />
            <View style={styles.trunkLine} />
          </View>
          <Text style={styles.hitHint}>{t(mode === 'chop' ? 'tap' : 'collecting')}</Text>
        </Pressable>
        </Animated.View>
        {damagePopups.map((popup) => (
          <FloatingDamage key={popup.id} popup={popup} />
        ))}
        {logs.map((log) => (
          <DraggableLog key={log.id} log={log} label={t('pickup', log.value)} onCollected={collectLog} onDraggingChange={syncDragMode} />
        ))}
      </View>

      <View style={styles.messageBox}>
        <Text style={styles.message}>{t(message.key, message.value)}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={rest} style={styles.restButton}>
          <Text style={styles.restIcon}>♨</Text>
          <Text style={styles.restText}>{t('rest')}</Text>
        </Pressable>
        <View style={styles.cart}>
          <Text style={styles.cartIcon}>🪵</Text>
          <Text style={styles.cartText}>{t('cart')}</Text>
        </View>
      </View>
      <View style={styles.achievement}>
        <Text style={styles.statValue}>{t('achievement')}</Text>
        <Text style={styles.progressLabel}>{!wallet ? t('connectFirst') : wood < 20 ? t('recordHint') : `${Math.min(wood, 20)} / 20`}</Text>
        {signature ? <Pressable style={styles.languageButton} onPress={() => {
          Linking.openURL(`https://explorer.solana.com/tx/${signature}?cluster=devnet`).catch(() => setMessage({ key: 'explorerError' }));
        }}><Text style={styles.walletText}>{t('explorer')}</Text></Pressable> :
          <Pressable accessibilityRole="button" disabled={!wallet || wood < 20 || recording} onPress={handleRecord}
            style={[styles.languageButton, (!wallet || wood < 20 || recording) && styles.treeDisabled]}>
            <Text style={styles.walletText}>{t(recording ? 'recording' : 'record')}</Text>
          </Pressable>}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return <View style={[styles.statCard, { borderColor: accent }]}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}

function Meter({ value, max, color }: { value: number; max: number; color: string }) {
  return <View style={styles.meter}><View style={[styles.meterFill, { width: `${clamp((value / max) * 100, 0, 100)}%`, backgroundColor: color }]} /></View>;
}

function FloatingDamage({ popup }: { popup: DamagePopup }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: 740, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [progress]);
  return <Animated.Text pointerEvents="none" style={[styles.damagePopup, {
    left: `${popup.left}%`, top: `${popup.top}%`,
    opacity: progress.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 1, 0] }),
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -44] }) }],
  }]}>−{popup.value}</Animated.Text>;
}

function DraggableLog({ log, label, onCollected, onDraggingChange }: {
  log: Log;
  label: string;
  onCollected: (id: number) => void;
  onDraggingChange: (id: number, dragging: boolean) => void;
}) {
  const pan = useRef(new Animated.ValueXY()).current;
  const fall = useRef(new Animated.Value(-65)).current;
  const life = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const drop = Animated.spring(fall, { toValue: 0, speed: 16, bounciness: 9, useNativeDriver: true });
    const expiry = Animated.timing(life, { toValue: 0, duration: Math.max(0, log.expiresAt - Date.now()), useNativeDriver: true });
    drop.start();
    expiry.start();
    return () => { drop.stop(); expiry.stop(); };
  }, [fall, life, log.expiresAt]);
  useEffect(() => () => onDraggingChange(log.id, false), [log.id, onDraggingChange]);
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      pan.stopAnimation();
      pan.setValue({ x: 0, y: 0 });
      onDraggingChange(log.id, true);
    },
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => {
      onDraggingChange(log.id, false);
      if (Math.hypot(gesture.dx, gesture.dy) > 12) onCollected(log.id);
      else Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: () => {
      onDraggingChange(log.id, false);
      pan.setValue({ x: 0, y: 0 });
    },
  })).current;
  return <Animated.View {...responder.panHandlers} accessibilityLabel={label}
    style={[styles.log, { left: `${log.left}%`, top: `${log.top}%`, transform: pan.getTranslateTransform() }]}>
    <Animated.View pointerEvents="none" style={{ alignItems: 'center', transform: [{ translateY: fall }], opacity: life.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }) }}>
      <Text style={styles.logEmoji}>🪵</Text><Text style={styles.logValue}>+{log.value}</Text>
      <Animated.View style={[styles.logTimer, { transform: [{ scaleX: life }] }]} />
    </Animated.View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#102D32', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 24 : 0 },
  content: { flexGrow: 1, paddingBottom: 24 },
  languageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8, marginTop: 10 },
  languageButton: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#25484A', borderRadius: 12 },
  languageSelected: { backgroundColor: '#48736B' },
  achievement: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: '#18383B', marginTop: 8 },
  treeTouch: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  logTimer: { height: 3, width: 36, backgroundColor: '#F5C76B', marginTop: 10, borderRadius: 2 },
  header: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 },
  eyebrow: { color: '#88ACA5', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: '#F7E9C6', fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  walletChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C4145', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16 },
  walletChipPressed: { opacity: 0.72 },
  walletDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EFC75E', marginRight: 6 },
  walletDotConnected: { backgroundColor: '#91D3B1' },
  walletText: { color: '#D4E5DD', fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  statCard: { flex: 1, backgroundColor: '#18383B', borderWidth: 1, borderRadius: 14, padding: 12 },
  statLabel: { color: '#8EACA6', fontSize: 11, fontWeight: '700' },
  statValue: { color: '#F8EED6', marginTop: 4, fontSize: 16, fontWeight: '800' },
  progressGroup: { marginTop: 16 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  fatigueRow: { marginTop: 11 },
  progressLabel: { color: '#BCD0C9', fontSize: 12, fontWeight: '700' },
  progressValue: { color: '#E3DABD', fontSize: 12, fontWeight: '800' },
  meter: { height: 8, backgroundColor: '#25484A', borderRadius: 8, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 8 },
  forest: { flex: 1, marginTop: 20, backgroundColor: '#234D4C', borderRadius: 24, overflow: 'hidden', minHeight: 340, position: 'relative' },
  moon: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#F4DE9B', position: 'absolute', top: 33, right: 35, opacity: 0.95 },
  hillBack: { position: 'absolute', width: '130%', height: 230, bottom: -100, left: -50, borderRadius: 200, backgroundColor: '#1D4141' },
  hillFront: { position: 'absolute', width: '130%', height: 175, bottom: -105, right: -65, borderRadius: 200, backgroundColor: '#17393B' },
  treeButton: { position: 'absolute', left: '25%', top: '19%', width: '50%', height: '63%', alignItems: 'center', justifyContent: 'flex-end' },
  treePressed: { transform: [{ scale: 0.97 }] }, treeDisabled: { opacity: 0.8 },
  canopy: { position: 'absolute', bottom: 115, width: 172, height: 128, zIndex: 2 },
  leafLeft: { position: 'absolute', left: 0, bottom: 0, width: 106, height: 91, borderRadius: 48, backgroundColor: '#438875', borderBottomWidth: 10, borderBottomColor: '#306657' },
  leafRight: { position: 'absolute', right: 0, bottom: 0, width: 109, height: 100, borderRadius: 50, backgroundColor: '#64A381', borderBottomWidth: 10, borderBottomColor: '#438875' },
  leafTop: { position: 'absolute', left: 34, top: 0, width: 103, height: 98, borderRadius: 50, backgroundColor: '#84BC8D' },
  leafGlint: { position: 'absolute', left: 52, top: 15, width: 41, height: 13, borderRadius: 10, backgroundColor: '#ADD39C', transform: [{ rotate: '-25deg' }] },
  treeKnot: { width: 19, height: 28, borderRadius: 14, borderWidth: 4, borderColor: '#73442F', backgroundColor: '#B97B4E' },
  trunk: { width: 54, height: 126, borderRadius: 14, backgroundColor: '#9B603F', borderLeftWidth: 7, borderLeftColor: '#BE8558', borderRightWidth: 6, borderRightColor: '#75492F', justifyContent: 'space-evenly', alignItems: 'center' },
  trunkLine: { height: 5, width: 33, borderRadius: 6, backgroundColor: '#73442F', opacity: 0.75 },
  hitHint: { color: '#FFF1CC', fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },
  damagePopup: { position: 'absolute', zIndex: 20, color: '#FFF7D6', fontSize: 25, fontWeight: '900', textShadowColor: '#6F2D22', textShadowOffset: { width: 2, height: 3 }, textShadowRadius: 1 },
  log: { position: 'absolute', width: 62, height: 58, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  logEmoji: { fontSize: 36 }, logValue: { position: 'absolute', bottom: -2, color: '#FFF5D6', fontWeight: '900', fontSize: 11, backgroundColor: '#1B393A', borderRadius: 8, paddingHorizontal: 5, overflow: 'hidden' },
  messageBox: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginVertical: 8 },
  message: { color: '#D7E7DB', textAlign: 'center', fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, paddingBottom: 14 },
  restButton: { width: 78, borderRadius: 16, backgroundColor: '#355D59', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  restIcon: { fontSize: 21 }, restText: { color: '#E9E6CC', fontSize: 11, fontWeight: '800', marginTop: 1 },
  cart: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFC75E', borderRadius: 16, minHeight: 58 },
  cartIcon: { fontSize: 24, marginRight: 6 }, cartText: { color: '#5C3D26', fontWeight: '900', fontSize: 12 },
});
