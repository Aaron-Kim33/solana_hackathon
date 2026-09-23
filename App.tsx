// @refresh reset
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Alert,
  Linking,
  Modal,
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
import { recordHarvest, checkHarvest } from './src/solana/achievement';
import { recordErrorKey } from './src/solana/record-errors';
import { CharacterPanel } from './src/game/CharacterPanel';
import { GemArt } from './src/game/GemArt';
import { WardenQuests } from './src/game/DeepwoodContent';
import { PlayGuide } from './src/game/PlayGuide';
import { questShortcut } from './src/game/quest-shortcut';
import { ServerLoginPanel, type ServerController } from './src/game/ServerLoginPanel';
import { autoPickupUnlocked, autoPickupAvailable, autoPickupRemaining, startAutoPickup } from './src/game/auto-pickup';
import { activeBoss, encounterHealth, defeatCoins } from './src/game/progression';
import { questView } from './src/game/quest-view';
import { GameMessage, Language, translate, TranslationKey } from './src/i18n';
import { AXE_MAX, CHARACTER_MAX, TREE_MAX, RECOVERY_MS, initialProgress, recover, hit, collect, upgrade, testRest,
  combatStats, treeAppearance, equip, grantTestOptions, OPTION_ITEMS, OptionId,
  claimFirstRecord, claimGrowthReward, claimAdventure, adventureReady, axeLevelFor, displayedHitXp, equipAxeSkin, skinQuestCollected, firstRecordBonusActive,
  treeHealth, axeCost, treeCost, characterLevel, xpFloor, xpRequired, hitXp, treeCoins, highestAxeLevel, walletUnlocked, questSteps, regrow, Progress } from './src/game/progression';
import { loadProgress, saveProgress } from './src/game/storage';
import { deployment } from './src/deployment';

type Log = {
  id: number;
  left: number;
  top: number;
  value: number;
  expiresAt: number;
  bonusWood: number;
  serverId?: string;
};

type DamagePopup = {
  id: number;
  value: number;
  critical: boolean;
  left: number;
  top: number;
};

const LOG_LIFETIME_MS = 5000;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export default function App() {
  const [language, setLanguage] = useState<Language>(__DEV__ ? 'ko' : 'en');
  if (!deployment.config) return <SafeAreaView style={{ flex: 1, backgroundColor: '#102D32', justifyContent: 'center', padding: 24 }}>
    <Text style={{ color: '#FFE2A0', fontSize: 18 }}>Test build configuration missing / 테스트 빌드 설정 오류</Text>
    <Text style={{ color: '#FFFFFF', marginTop: 12 }}>API URL and wallet identity must be configured with HTTPS before building. No local fallback is started.</Text>
  </SafeAreaView>;
  return deployment.config.serverEnabled ? <ServerLoginPanel language={language} renderMain={server =>
    <LocalGame key={server.snapshot ? 'server' : 'local'} server={server} uiLanguage={language} onLanguage={setLanguage} />
  } /> : <LocalGame uiLanguage={language} onLanguage={setLanguage} />;
}

function LocalGame({ server, uiLanguage, onLanguage }: { server?: ServerController; uiLanguage: Language; onLanguage: (language: Language) => void }) {
  const online = !!server?.snapshot;
  const [loaded] = useState(() => {
    if (server?.snapshot) return { state: server.snapshot.progress, error: false };
    try { return { state: recover(loadProgress(__DEV__ ? 'ko' : 'en'), Date.now()), error: false }; }
    catch { return { state: initialProgress(__DEV__ ? 'ko' : 'en'), error: true }; }
  });
  const [localProgress, setProgress] = useState(loaded.state);
  const progress = useMemo(() => online ? { ...server!.snapshot!.progress, language: uiLanguage } : localProgress, [online, server?.snapshot?.progress, uiLanguage, localProgress]);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const serverRef = useRef(server); serverRef.current = server;
  const unavailable = () => Alert.alert(uiLanguage === 'ko' ? '서버 연결' : 'Server connection', uiLanguage === 'ko' ? '이 기능은 아직 서버 연결 중이에요. 로컬 재화로 대신 처리하지 않아요.' : 'This feature is not connected to the server yet. No local balances will be changed.');
  const [saveError, setSaveError] = useState(loaded.error);
  const [panel, setPanel] = useState<'menu' | 'guide' | 'quests' | 'character' | 'axe' | 'gems' | 'tree' | null>(null);
  const panelScroll = useRef<ScrollView>(null);
  const commit = useCallback((next: Progress) => {
    if (serverRef.current?.snapshot) { unavailable(); return false; }
    if (loaded.error) return false;
    try { saveProgress(next); setSaveError(false); }
    catch { setSaveError(true); return false; }
    progressRef.current = next;
    setProgress(next);
    return true;
  }, [loaded.error]);
  const { treeHp, fatigue, wood, language } = progress;
  const level = characterLevel(progress.xp);
  const boss = activeBoss(progress);
  const maxTreeHp = encounterHealth(progress);
  const stats = useMemo(() => combatStats(progress), [progress]);
  const axePower = `${stats.min}–${stats.max}`;
  const stage = treeAppearance(progress.treeLevel);
  // Twenty prototype palettes, one per 50 levels; final art can replace these independently.
  const leafHue = boss === 'gate' ? 280 : boss === 'first' ? 25 : (145 + stage * 29) % 360;
  const xpValue = level === CHARACTER_MAX ? 1 : progress.xp - xpFloor(level);
  const xpMax = level === CHARACTER_MAX ? 1 : xpRequired(level);
  const unlocked = walletUnlocked(progress);
  const quests = useMemo(() => questSteps(progress), [progress]);
  const visibleQuests = useMemo(() => questView(quests), [quests]);
  const shortcut = questShortcut(progress, quests);
  useEffect(() => {
    if (panel === 'quests') panelScroll.current?.scrollTo({ y: 0, animated: false });
  }, [panel, visibleQuests.active]);
  const [now, setNow] = useState(Date.now());
  const pickupSeconds = Math.ceil(autoPickupRemaining(progress, now) / 1000);
  const pickupCountdown = `${Math.floor(pickupSeconds / 60).toString().padStart(2, '0')}:${(pickupSeconds % 60).toString().padStart(2, '0')}`;
  const seconds = progress.recoveryAt === null ? 0 : Math.max(0, Math.ceil((progress.recoveryAt + RECOVERY_MS - now) / 1000));
  const countdown = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const [logs, setLogs] = useState<Log[]>([]);
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
  const [autoPickupNotice, setAutoPickupNotice] = useState<{ id: number; value: number } | null>(null);
  const [mode, setMode] = useState<'chop' | 'collect'>('chop');
  const setLanguage = (language: Language) => { onLanguage(language); if (!online) commit({ ...progressRef.current, language }); };
  const t = (key: TranslationKey, value?: string | number) => translate(language, key, value);
  const shortcutLabel = shortcut?.key === 'nextQuest' ? t('nextQuest', t(shortcut.quest))
    : shortcut ? t(shortcut.key, 'value' in shortcut ? shortcut.value : undefined) : null;
  const showAutoPickup = () => {
    if (online) { unavailable(); return; }
    const time = Date.now();
    const current = recover(progressRef.current, time);
    if (autoPickupRemaining(current, time) > 0) {
      Alert.alert(t('autoPickup'), t('autoPickupInfo')); return;
    }
    if (!autoPickupAvailable(current, time)) {
      Alert.alert(t('autoPickup'), t('autoPickupShop')); return;
    }
    if (current.fatigue >= 100) {
      Alert.alert(t('autoPickup'), t('autoPickupRest')); return;
    }
    Alert.alert(t('autoPickup'), `${t('autoPickupInfo')}\n\n${t('fatigue')}: ${current.fatigue}%`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('autoPickupStart'), onPress: () => {
        const time = Date.now();
        const current = recover(progressRef.current, time);
        const next = startAutoPickup(current, time);
        if (next === current) { showAutoPickup(); return; }
        if (commit(next)) setNow(time);
        else Alert.alert(t('autoPickup'), t('saveError'));
      } },
    ]);
  };
  const [message, setMessage] = useState<GameMessage>({ key: 'intro' });
  const [recording, setRecording] = useState(false);
  const [recordNotice, setRecordNotice] = useState<GameMessage | null>(null);
  const signature = progress.receipt?.signature;
  const recordLock = useRef(false);
  const shake = useRef(new Animated.Value(0)).current;
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const nextLogId = useRef(1);
  const nextEffectId = useRef(1);
  const activeLogs = useRef(new Map<number, Log>());
  const draggingLogs = useRef(new Set<number>());
  const seenServerHits = useRef(server?.snapshot?.progress.totalHits ?? 0);
  const damageTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => () => { for (const timer of damageTimers.current) clearTimeout(timer); }, []);
  const lastRecoveryCheck = useRef(0);

  const syncDragMode = useCallback((id: number, dragging: boolean) => {
    if (dragging) draggingLogs.current.add(id);
    else draggingLogs.current.delete(id);
    setMode(draggingLogs.current.size > 0 ? 'collect' : 'chop');
    serverRef.current?.dragging(draggingLogs.current.size > 0);
  }, []);

  useEffect(() => {
    if (!server?.snapshot) return;
    const snapshot = server.snapshot;
    const prior = new Map([...activeLogs.current.values()].map(log => [log.serverId, log]));
    activeLogs.current.clear();
    for (const drop of snapshot.drops ?? []) {
      if (drop.expiresAt <= server.now) continue;
      const existing = prior.get(drop.id);
      const log: Log = existing ?? { id: nextLogId.current++, serverId: drop.id, left: 10 + Math.floor(Math.random() * 70), top: 54 + Math.floor(Math.random() * 17), value: drop.value, bonusWood: 0, expiresAt: Date.now() + drop.expiresAt - server.now };
      activeLogs.current.set(log.id, log);
    }
    const currentLogs = [...activeLogs.current.values()];
    setLogs(existing => existing.length === currentLogs.length && existing.every((log, i) => log === currentLogs[i]) ? existing : currentLogs);
    const previousHits = seenServerHits.current;
    const hadNewHits = snapshot.progress.totalHits > previousHits;
    seenServerHits.current = snapshot.progress.totalHits;
    if (hadNewHits && snapshot.lastDamage !== undefined) {
      const events = snapshot.hitEvents?.filter(event => event.hit > previousHits) ?? [{ damage: snapshot.lastDamage, critical: false }];
      const popups = events.map((event, i) => ({ id: nextEffectId.current++, value: event.damage, critical: event.critical, left: 62 + i * 2, top: 30 + i * 6 }));
      setDamagePopups(current => [...current, ...popups].slice(-8));
      const ids = new Set(popups.map(popup => popup.id));
      const timer = setTimeout(() => { damageTimers.current.delete(timer); setDamagePopups(current => current.filter(popup => !ids.has(popup.id))); }, 760);
      damageTimers.current.add(timer);
    }
  }, [server?.snapshot]);

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

  useEffect(() => {
    const update = () => {
      const time = Date.now();
      setNow(time);
      const connection = serverRef.current;
      if (connection?.snapshot) {
        const recoveryAt = connection.snapshot.progress.recoveryAt;
        if (recoveryAt !== null && connection.now >= recoveryAt + RECOVERY_MS && !connection.busy && !connection.pending && connection.queued === 0 && time - lastRecoveryCheck.current >= 5000) {
          lastRecoveryCheck.current = time; connection.command({ type: 'recover' });
        }
        return;
      }
      const next = recover(progressRef.current, time);
      if (next !== progressRef.current) commit(next);
    };
    const timer = setInterval(update, 1000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') update(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [commit]);

  const chop = useCallback(() => {
    if (panel || progressRef.current.treeHp === 0) return;
    if (draggingLogs.current.size > 0) {
      setMessage({ key: 'dragging' });
      return;
    }
    const connection = serverRef.current;
    if (connection?.snapshot) {
      if (progressRef.current.fatigue >= 100 || !connection.hit()) return;
      shake.stopAnimation(); shake.setValue(5);
      Animated.spring(shake, { toValue: 0, speed: 28, bounciness: 8, useNativeDriver: true }).start();
      return;
    }
    const now = Date.now();
    const result = hit(progressRef.current, now, Math.random, autoPickupRemaining(progressRef.current, now) > 0);
    if (!result) {
      setMessage({ key: 'tired' });
      return;
    }

    const leveledUp = characterLevel(result.state.xp) > characterLevel(progressRef.current.xp);
    if (!commit(result.state)) return;
    const damage = result.damage;
    shake.stopAnimation();
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 7, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -5, duration: 55, useNativeDriver: true }),
      Animated.spring(shake, { toValue: 0, speed: 28, bounciness: 8, useNativeDriver: true }),
    ]).start();
    const effectId = nextEffectId.current++;
    const droppedLog: Log = {
      id: nextLogId.current++,
      left: 10 + Math.floor(Math.random() * 70),
      top: 54 + Math.floor(Math.random() * 17),
      value: result.value,
      bonusWood: result.bonusWood,
      expiresAt: now + LOG_LIFETIME_MS,
    };

    setDamagePopups((current) => [
      ...current.slice(-2),
      { id: effectId, value: damage, critical: result.critical, left: 62 + Math.floor(Math.random() * 7), top: 30 + Math.floor(Math.random() * 14) },
    ]);
    setTimeout(() => {
      setDamagePopups((current) => current.filter((popup) => popup.id !== effectId));
    }, 760);

    if (result.manualWood > 0) {
      activeLogs.current.set(droppedLog.id, droppedLog);
      setLogs([...activeLogs.current.values()]);
    }
    if (result.autoCollected) {
      setAutoPickupNotice({ id: effectId, value: result.value });
      setTimeout(() => setAutoPickupNotice(current => current?.id === effectId ? null : current), 900);
    }
    setMessage({ key: result.felled ? (result.state.treeLevel === TREE_MAX ? 'ending' : 'felled') : result.bonusWood > 0 ? 'bountifulDrop' : result.value === 0 ? 'noWood' : 'dropped', value: result.bonusWood || result.value });
    if (result.coins > 0) setMessage({ key: 'coinsEarned', value: result.coins });
    if (result.autoCollected) setMessage({ key: 'autoCollected', value: result.value });
    if (leveledUp) setMessage({ key: 'levelUp', value: characterLevel(result.state.xp) });
    if (result.fatigueSaved) setMessage({ key: 'fatigueSaved' });
    if (result.bossDefeated) {
      const lang = result.state.language;
      Alert.alert(translate(lang, 'bossDefeated'), translate(lang, result.bossDefeated === 'first' ? 'bossFirstReward' : 'bossGateReward'));
    }
  }, [commit, shake, panel]);

  const collectLog = useCallback((id: number) => {
    const target = activeLogs.current.get(id);
    if (!target) return;
    if (serverRef.current?.snapshot) {
      if (target.serverId) serverRef.current.command({ type: 'collectDrop', dropId: target.serverId });
      return;
    }
    if (Date.now() < target.expiresAt) {
      const wasUnlocked = walletUnlocked(progressRef.current);
      const next = collect(progressRef.current, target.value);
      if (!commit(next)) return;
      setMessage(wasUnlocked || !walletUnlocked(next) ? { key: 'collected', value: target.value } : { key: 'firstHarvestReady' });
    }
    activeLogs.current.delete(id);
    setLogs([...activeLogs.current.values()]);
  }, [commit]);

  const rest = () => {
    if (__DEV__ && commit(testRest(progressRef.current, Date.now()))) setMessage({ key: 'rested' });
  };

  const handleUpgrade = (kind: 'axe' | 'tree') => {
    if (online) {
      const accepted = server!.command({ type: kind === 'axe' ? 'upgradeAxe' : 'upgradeTree' });
      if (kind === 'tree' && accepted) setPanel(null);
      return;
    }
    const beforeLevel = characterLevel(progressRef.current.xp);
    const next = upgrade(progressRef.current, kind);
    if (next !== progressRef.current && commit(next)) {
      setMessage({ key: kind === 'axe' ? 'axeUpgraded' : 'treeUpgraded' });
      if (characterLevel(next.xp) > beforeLevel) setMessage({ key: 'levelUp', value: characterLevel(next.xp) });
      if (kind === 'tree') setPanel(null);
      if (kind === 'tree' && next.treeLevel === 101) Alert.alert(t('rewardClaimed'), t('wardenReceived'), [
        { text: t('close') }, { text: t('changeEquipment'), onPress: () => setPanel('axe') },
      ]);
    }
  };

  const handleClaimReward = () => {
    if (online) { server!.command({ type: 'claimFirstRecord' }); return; }
    const next = claimFirstRecord(progressRef.current);
    if (next !== progressRef.current && commit(next)) {
      setMessage({ key: 'firstRecordRewardReceived' });
      Alert.alert(t('rewardClaimed'), t('firstRecordRewardReceived'), [
        { text: t('goSkins'), onPress: () => setPanel('character') },
      ]);
    }
  };
  const handleSkin = (skin: Progress['axeSkin']) => {
    if (online) { server!.command({ type: 'equipAxe', skin }); return; }
    const wasActive = firstRecordBonusActive(progressRef.current);
    const next = equipAxeSkin(progressRef.current, skin);
    if (next !== progressRef.current && commit(next)) {
      const unlocked = !wasActive && firstRecordBonusActive(next);
      setMessage({ key: unlocked ? 'firstRecordBonusUnlocked' : 'skinChanged' });
      if (unlocked) Alert.alert(t('firstRecordPower'), t('firstRecordBonusUnlocked'), [
        { text: t('goQuests'), onPress: () => setPanel('quests') },
      ]);
    }
  };

  const handleWalletConnect = async () => {
    if (server && !online) {
      if (progressRef.current.harvested > 0 || progressRef.current.xp > 0) {
        Alert.alert(t('connectServerSave'), t('practiceSwitchConfirm'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('connectServerSave'), onPress: server.connect },
        ]);
      } else server.connect();
      return;
    }
    if (online) { server!.command({ type: 'acknowledgeWallet' }); return; }
    if (isConnectingWallet || !walletUnlocked(progressRef.current) || recording || loaded.error) return;
    setIsConnectingWallet(true);
    try {
      const connectedWallet = await connectWallet();
      setWallet(connectedWallet);
      commit({ ...progressRef.current, walletCompleted: true });
      setMessage({ key: 'connected', value: connectedWallet.shortAddress });
    } catch (error) {
      setMessage({ key: 'walletError' });
      Alert.alert(t('wallet'), t('walletError'));
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleRecord = () => {
    if (online) {
      Alert.alert(t('achievement'), t('recordConfirm'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('approve'), onPress: () => { void server!.record(); } },
      ]);
      return;
    }
    if (!wallet || questSteps(progressRef.current)[5] !== 'active' || recordLock.current || (signature && progress.receipt?.status !== 'failed')) return;
    Alert.alert(t('achievement'), t('recordConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('approve'), onPress: async () => {
        if (recordLock.current) return;
        recordLock.current = true;
        setRecording(true);
        setRecordNotice({ key: 'recording' });
        try {
          const result = await recordHarvest(wallet.publicKey, (submitted) => {
            if (!commit({ ...progressRef.current, receipt: { address: wallet.publicKey, signature: submitted, status: 'pending' } })) throw new Error('RECORD_SAVE_FAILED');
          });
          if (!progressRef.current.receipt || !commit({ ...progressRef.current, receipt: { ...progressRef.current.receipt, status: result.confirmed ? 'confirmed' : 'pending' } })) throw new Error('RECORD_SAVE_FAILED');
          const key = result.confirmed ? 'recorded' : 'recordPending';
          setMessage({ key });
          setRecordNotice({ key });
          Alert.alert(t('achievement'), t(key));
        } catch (error) {
          const key = recordErrorKey(error);
          setMessage({ key });
          setRecordNotice({ key });
          Alert.alert(t('achievement'), t(key));
        } finally {
          setRecording(false);
          recordLock.current = false;
        }
      } },
    ]);
  };

  const handleCheck = async () => {
    if (online) { unavailable(); return; }
    if (!signature || recordLock.current) return;
    recordLock.current = true;
    setRecording(true);
    setRecordNotice({ key: 'recording' });
    try {
      const status = await checkHarvest(signature);
      if (!progressRef.current.receipt || !commit({ ...progressRef.current, receipt: { ...progressRef.current.receipt, status } })) throw new Error('RECORD_SAVE_FAILED');
      const key = status === 'confirmed' ? 'recorded' : status === 'failed' ? 'recordError' : 'recordPending';
      setMessage({ key });
      setRecordNotice({ key });
      Alert.alert(t('achievement'), t(key));
    } catch (error) {
      const key = error instanceof Error && error.message === 'RECORD_SAVE_FAILED' ? 'saveError' : 'recordPending';
      setMessage({ key }); setRecordNotice({ key });
      Alert.alert(t('achievement'), t(key));
    }
    finally { recordLock.current = false; setRecording(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.gameScreen}>
      {saveError && <Text style={styles.saveError}>{t('saveError')}</Text>}
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('openMenu')} onPress={() => setPanel('menu')} style={styles.menuButton}>
          <View style={styles.menuLine} /><View style={styles.menuLine} /><View style={styles.menuLine} />
        </Pressable>
        <View>
          <Text style={styles.eyebrow}>{online ? t('serverSaveLabel') : server ? t('localPracticeLabel') : 'SEEKER FOREST · DEVNET'}</Text>
          <Text style={styles.title}>LUMBER RUSH</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(server && !online ? 'connectServerSave' : 'wallet')}
          disabled={(!unlocked && (!server || online)) || recording || isConnectingWallet || (server?.busy ?? false) || (!server && loaded.error)}
          onPress={handleWalletConnect}
          style={({ pressed }) => [styles.walletChip, pressed && styles.walletChipPressed]}
        >
          <View style={[styles.walletDot, (wallet || (online && progress.walletCompleted)) && styles.walletDotConnected]} />
          <Text style={styles.walletText}>
            {server && !online ? t('connectServerSave') : !unlocked ? t('walletLocked') : isConnectingWallet ? t('connecting') : online && progress.walletCompleted ? (language === 'ko' ? '연결됨' : 'Connected') : wallet ? wallet.shortAddress : t('wallet')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <StatCard label={t('wood')} value={wood.toLocaleString(language)} accent="#F5C76B" />
        <StatCard label={t('coins')} value={progress.coins.toLocaleString(language)} accent="#FFE38D" />
        <StatCard label={t('axe')} value={`Lv. ${progress.axeLevel} · ${axePower}`} accent="#91D3B1" />
      </View>

      <View style={styles.progressGroup}>
        <View style={styles.progressLabelRow}>
          <InfoLabel label={`${t('character')} Lv. ${level}`} accessibilityLabel={t('infoAbout', t('character'))}
            onPress={() => Alert.alert(t('character'), `${t('characterInfo')}\n\n${t('hitXpInfo', displayedHitXp(progress))}\n${t('critChance')} ${stats.critChance}% · ${t('critDamage')} ${stats.critDamage}%`)} />
          <Text style={styles.progressValue}>{level === CHARACTER_MAX ? t('maxLevel') : `${xpValue} / ${xpMax} XP`}</Text>
        </View>
        <Meter value={xpValue} max={xpMax} color="#91D3B1" />
        <View style={[styles.progressLabelRow, styles.fatigueRow]}>
          <InfoLabel label={`${boss ? 'BOSS' : t('tree')} · Lv. ${progress.treeLevel}`} accessibilityLabel={t('infoAbout', t('tree'))}
            onPress={() => Alert.alert(t('tree'), `${t('treeInfo')}\n\n${t('treeBonus', progress.treeLevel)}\n${t('treeCoinInfo', defeatCoins(progress))}`)} />
          <Text style={styles.progressValue}>{treeHp} / {maxTreeHp}</Text>
        </View>
        <Meter value={treeHp} max={maxTreeHp} color={boss ? '#E46B81' : '#C87348'} />
        {boss && <Text style={styles.recoveryText}>{t(boss === 'first' ? 'bossFirst' : 'bossGate')} · {t('bossHint')}</Text>}
        <View style={[styles.progressLabelRow, styles.fatigueRow]}>
          <InfoLabel label={t('fatigue')} accessibilityLabel={t('infoAbout', t('fatigue'))}
            onPress={() => Alert.alert(t('fatigue'), t('fatigueInfo'))} />
          <Text style={styles.progressValue}>{fatigue}%</Text>
        </View>
        <Meter value={fatigue} max={100} color={fatigue > 65 ? '#EC7A67' : '#EFC75E'} />
        <Text style={styles.recoveryText}>{fatigue > 0 ? t('recoveryIn', countdown) : t('fullyRested')}</Text>
        <Text style={styles.recoveryText}>{t('treeBonus', progress.treeLevel)}</Text>
      </View>

      <View style={styles.forest}>
        {progress.treeLevel >= 101 && <Text pointerEvents="none" style={{ position: 'absolute', top: 8, alignSelf: 'center', color: '#CFB6F2', fontWeight: '800' }}>{t('secondForest')}</Text>}
        {autoPickupUnlocked(progress) && <Pressable accessibilityRole="button"
          accessibilityLabel={t('autoPickup')} onPress={showAutoPickup}
          style={({ pressed }) => [styles.autoPickupButton, pickupSeconds > 0 && { borderColor: '#FFE19C' }, pressed && { opacity: 0.7 }]}>
          <Text style={styles.walletText}>{t('autoPickup')}</Text>
          {pickupSeconds > 0 && <Text style={styles.walletText}>{pickupCountdown}</Text>}
        </Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel={t('openAxe')} hitSlop={8}
          onPress={() => setPanel('axe')} style={({ pressed }) => [styles.forestAxe, pressed && { opacity: 0.65 }]}>
          <AxeArt crowned={progress.wardenRewardsClaimed === 3} commemorative={progress.axeSkin === 'firstRecord'} pioneer={progress.axeSkin === 'pioneer'} warden={progress.axeSkin === 'warden'} recovery={progress.axeSkin === 'recovery'} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('gemFusion')}
          onPress={() => setPanel('gems')} style={({ pressed }) => [styles.forestGem, pressed && { opacity: 0.65 }]}>
          <GemArt tier="high" size={44} />
        </Pressable>
        <View style={styles.moon} />
        <View style={styles.hillBack} />
        <View style={styles.hillFront} />
        {treeHp > 0 ? <Animated.View style={[styles.treeButton, { transform: [{ translateX: shake }] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chop')}
          disabled={mode === 'collect'}
          onPress={chop}
          style={({ pressed }) => [styles.treeTouch, pressed && styles.treePressed, mode === 'collect' && styles.treeDisabled]}
        >
          <View pointerEvents="none" style={styles.canopy}>
            <View style={[styles.leafLeft, { backgroundColor: `hsl(${leafHue}, 34%, 40%)` }]} />
            <View style={[styles.leafRight, { backgroundColor: `hsl(${leafHue}, 32%, 52%)` }]} />
            <View style={[styles.leafTop, { backgroundColor: `hsl(${leafHue}, 36%, 64%)`, borderRadius: 50 - (stage % 4) * 8 }]} />
            <View style={[styles.leafGlint, { backgroundColor: `hsl(${leafHue}, 42%, 78%)` }]} />
          </View>
          <View style={[styles.trunk, boss && { backgroundColor: boss === 'gate' ? '#59415F' : '#754335', borderColor: '#E3AA6B', borderWidth: 3 }]}>
            {boss && <View pointerEvents="none" style={{ position: 'absolute', top: 20, flexDirection: 'row', gap: 16, alignSelf: 'center' }}>
              <View style={{ width: 9, height: 6, backgroundColor: '#FFE59C' }} /><View style={{ width: 9, height: 6, backgroundColor: '#FFE59C' }} />
            </View>}
            <View style={styles.trunkLine} />
            <View style={styles.treeKnot} />
            <View style={styles.trunkLine} />
          </View>
          <Text style={styles.hitHint}>{t(mode === 'chop' ? 'tap' : 'collecting')}</Text>
        </Pressable>
        </Animated.View> : <View style={styles.felledTree}>
          <View style={styles.stump}><View style={styles.stumpRing} /></View>
          <Pressable accessibilityRole="button" onPress={() => setPanel('tree')} style={styles.upgradeMarker}>
            <Text style={styles.markerText}>{t(progress.treeLevel >= TREE_MAX ? 'endingTitle' : 'treeUpgradeMarker')}</Text>
          </Pressable>
        </View>}
        {damagePopups.map((popup) => (
          <FloatingDamage key={popup.id} popup={popup} />
        ))}
        {autoPickupNotice && <Text pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', bottom: 12, alignSelf: 'center', color: '#FFE19C', backgroundColor: '#153936', borderRadius: 12, padding: 8, fontWeight: '800' }}>{t('autoCollected', autoPickupNotice.value)}</Text>}
        {logs.map((log) => (
          <DraggableLog key={log.id} log={log} label={t('pickup', log.value)} onCollected={collectLog} onDraggingChange={syncDragMode} />
        ))}
      </View>

      <View style={styles.messageBox}>
        {server && !online && <Text style={[styles.message, { color: '#FFD18E', fontWeight: '800' }]}>{t('localPracticeNotice')}</Text>}
        <Text style={styles.message}>{online ? server!.notice || (server!.pending && !server!.busy ? (language === 'ko' ? '메뉴에서 미확인 요청을 재확인해 주세요.' : 'Retry the pending request in the menu.') : server!.busy || server!.queued ? (language === 'ko' ? '동기화 중…' : 'Syncing…') : (language === 'ko' ? '서버에 저장됨 · 탭하여 벌목, 드래그하여 회수' : 'Saved on server · Tap to chop, drag to collect')) : t(message.key, message.value)}</Text>
      </View>

      <View style={styles.actions}>
        {__DEV__ && <Pressable onPress={rest} style={styles.restButton}>
          <Text style={styles.restIcon}>♨</Text>
          <Text style={styles.restText}>{t('testRest')}</Text>
        </Pressable>}
        {shortcutLabel ? <Pressable accessibilityRole="button" accessibilityLabel={shortcutLabel} onPress={() => setPanel('quests')} style={styles.cart}>
          <Text style={styles.cartIcon}>{shortcut?.key === 'nextQuest' ? '📜' : '🪵'}</Text>
          <Text numberOfLines={2} style={[styles.cartText, { flexShrink: 1 }]}>{shortcutLabel}</Text>
        </Pressable> : <View style={styles.cart}>
          <Text style={styles.cartIcon}>🪵</Text>
          <Text style={styles.cartText}>{t('cart')}</Text>
        </View>}
      </View>
      </View>
      <Modal visible={panel !== null} transparent animationType="fade" onRequestClose={() => setPanel(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={t('close')} onPress={() => setPanel(null)} />
          <View style={styles.modalCard} accessibilityViewIsModal>
            <View style={styles.panelHeader}>
              <Text style={styles.statValue}>{t(panel === 'quests' ? 'questTitle' : panel === 'gems' ? 'gemFusion' : panel === 'character' || panel === 'axe' ? 'character' : panel === 'tree' ? 'tree' : 'menu')}</Text>
              <Pressable accessibilityRole="button" onPress={() => setPanel(null)} style={styles.languageButton}><Text style={styles.walletText}>{t('close')}</Text></Pressable>
            </View>
            <ScrollView key={panel} ref={panelScroll} contentContainerStyle={styles.panelContent}>
      {online && (panel === 'quests' || panel === 'gems' || panel === 'character' || panel === 'axe') && <Text style={{ color: '#FFD18E', paddingVertical: 10 }}>
        {language === 'ko' ? '서버 연결 적용 중: 첫 기록·첫 기록 보상·도끼 강화와 장착은 사용 가능해요. 이후 보상·보석·특성은 아직 연결 전이에요.' : 'Server integration in progress: First Record, its reward, axe upgrades and equipping are available. Later rewards, gems and talents are not connected yet.'}
      </Text>}
      {panel === 'menu' && <View style={styles.achievement}>
        {server?.controls}
        <Pressable accessibilityRole="button" onPress={() => setPanel('guide')} style={styles.languageButton}><Text style={styles.statValue}>{language === 'ko' ? '플레이 가이드' : 'How to play'}</Text></Pressable>
        <Pressable onPress={() => setPanel('quests')} style={styles.languageButton}><Text style={styles.statValue}>{t('questTitle')}</Text></Pressable>
        <Pressable onPress={() => setPanel('character')} style={styles.languageButton}><Text style={styles.statValue}>{t('character')}</Text></Pressable>
        <View style={styles.languageRow}>
          <Text style={styles.progressLabel}>{t('language')}</Text>
          {(['ko', 'en'] as const).map((locale) => <Pressable key={locale} onPress={() => setLanguage(locale)}
            style={[styles.languageButton, language === locale && styles.languageSelected]}><Text style={styles.walletText}>{locale === 'ko' ? '한국어' : 'English'}</Text></Pressable>)}
        </View>
      </View>}
      {panel === 'guide' && <PlayGuide progress={progress} saveMode={online ? 'server' : server ? 'practice' : 'local'} onQuests={() => setPanel('quests')} onGems={() => setPanel('gems')} />}
      {panel === 'quests' && <View>
        {progress.treeLevel >= 101 && <WardenQuests progress={progress} commit={commit} />}
      {online && progress.walletCompleted && server!.snapshot?.walletCoinRewardClaimed === false && <View style={[styles.questRow, styles.questActive]}>
        <Text style={styles.walletText}>{t('walletCoinLegacy')}</Text>
        <Text style={styles.progressLabel}>{t('walletCoinReward')}</Text>
        <Pressable accessibilityRole="button" disabled={server!.busy || server!.pending || server!.queued > 0}
          onPress={() => server!.command({ type: 'acknowledgeWallet' })}
          style={[styles.languageButton, (server!.busy || server!.pending || server!.queued > 0) && styles.disabledButton]}>
          <Text style={styles.walletText}>{t('walletCoinClaim')}</Text>
        </Pressable>
      </View>}
      <View style={styles.achievement}>
        <Text accessibilityLiveRegion="polite" style={styles.statValue}>{t(visibleQuests.chapter)}</Text>
        {visibleQuests.active < 0 && <Text style={styles.progressLabel}>{t('questsFinishedHint')}</Text>}
        {visibleQuests.entries.map(({ key, index }) => (
          <View key={key} style={[styles.questRow, quests[index] === 'active' && styles.questActive]}>
            <Text style={styles.walletText}>{index + 1}. {t(key)}</Text>
            <Text style={styles.progressLabel}>{t(quests[index])}{index === 0 ? ` · ${Math.min(progress.harvested, 20)}/20` : ''}</Text>
            {index >= 13 && <>
              <Text style={styles.progressLabel}>{t((['rewardLowGem', 'rewardCoins300', 'rewardMediumGem', 'rewardPioneer', 'rewardCoins1000', 'rewardHighGem'] as const)[index - 13])}</Text>
              <Text style={styles.progressLabel}>{index === 13 ? `${t('tree')} ${Math.min(progress.treeLevel, 15)}/15` :
                index === 14 ? `${t('slot', 2)} · ${t(progress.slots[1] ? 'skinEquipped' : 'emptySlot')}` :
                index === 15 ? `${t('tree')} ${Math.min(progress.treeLevel, 25)}/25 · ${t('axe')} ${Math.min(highestAxeLevel(progress), 20)}/20` :
                index === 16 ? `${t('tree')} ${Math.min(progress.treeLevel, 50)}/50 · ${t('character')} ${Math.min(level, 10)}/10` :
                index === 17 ? `${t('pioneerAxe')} ${Math.min(axeLevelFor(progress, 'pioneer'), 10)}/10 · ${t(progress.axeSkin === 'pioneer' ? 'skinEquipped' : 'equipSkin')}` :
                `${t('tree')} ${Math.min(progress.treeLevel, 100)}/100 · ${t('character')} ${Math.min(level, 20)}/20`}</Text>
              {adventureReady(progress) && <Text style={styles.progressLabel}>{t('claimReady')}</Text>}
              <Pressable accessibilityRole="button" disabled={loaded.error || !adventureReady(progress)} style={[styles.languageButton, !adventureReady(progress) && styles.disabledButton]} onPress={() => {
                if (progressRef.current.adventureClaimed !== index - 13) return;
                const next = claimAdventure(progressRef.current);
                if (next !== progressRef.current && commit(next)) Alert.alert(t('rewardClaimed'), t((['rewardLowGem', 'rewardCoins300', 'rewardMediumGem', 'rewardPioneer', 'rewardCoins1000', 'rewardHighGem'] as const)[index - 13]));
              }}><Text style={styles.walletText}>{t('claimReward')}</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => setPanel('character')} style={styles.languageButton}><Text style={styles.walletText}>{t('character')} ›</Text></Pressable>
            </>}
            {index === 6 && <View style={styles.rewardPreview}>
              <AxeArt commemorative />
              <Text style={[styles.progressLabel, { flex: 1 }]}>{t('firstRecordRewardDescription')}</Text>
            </View>}
            {index === 6 && quests[index] === 'active' && <Pressable accessibilityRole="button"
              disabled={loaded.error || recording || (online && (server!.busy || server!.pending || server!.queued > 0))}
              onPress={handleClaimReward}
              style={[styles.languageButton, (loaded.error || recording || (online && (server!.busy || server!.pending || server!.queued > 0))) && styles.disabledButton]}>
              <Text style={styles.walletText}>{t('claimReward')}</Text>
            </Pressable>}
            {index === 6 && quests[index] === 'complete' && <Text style={styles.progressLabel}>{t('rewardClaimed')}</Text>}
            {index === 7 && quests[index] === 'active' && <Pressable accessibilityRole="button" onPress={() => setPanel('character')} style={styles.languageButton}>
              <Text style={styles.walletText}>{t('goSkins')}</Text>
            </Pressable>}
            {index === 8 && <Text style={styles.progressLabel}>{skinQuestCollected(progress)} / 100 · {t('harvestMoreHint')}</Text>}
            {index === 9 && <Text style={styles.progressLabel}>{t('tree')} {Math.min(progress.treeLevel, 10)}/10 · {t('character')} {Math.min(level, 5)}/5 · {t('axe')} {Math.min(highestAxeLevel(progress), 15)}/15</Text>}
            {index === 10 && quests[index] === 'active' && <Pressable accessibilityRole="button" disabled={loaded.error} style={styles.languageButton} onPress={() => {
              const next = claimGrowthReward(progressRef.current);
              if (next !== progressRef.current && commit(next)) Alert.alert(t('rewardClaimed'), t('gemReceived'));
            }}><Text style={styles.walletText}>{t('claimReward')}</Text></Pressable>}
            {(index === 11 || index === 12) && quests[index] === 'active' && <>
              <Text style={styles.progressLabel}>{t('gemQuestHint')}</Text>
              <Pressable accessibilityRole="button" style={styles.languageButton} onPress={() => setPanel('character')}><Text style={styles.walletText}>{t('character')} ›</Text></Pressable>
            </>}
            {quests[index] === 'active' && index === 1 && <Pressable onPress={handleWalletConnect} disabled={isConnectingWallet || (server?.busy ?? false)} style={styles.languageButton}><Text style={styles.walletText}>{t(server && !online ? 'connectServerSave' : isConnectingWallet ? 'connecting' : 'wallet')}</Text></Pressable>}
            {quests[index] === 'active' && index === 1 && online && <Text style={styles.progressLabel}>{t('walletCoinReward')}</Text>}
            {quests[index] === 'active' && index === 2 && <Pressable
              onPress={() => setPanel('character')} style={styles.languageButton}>
              <Text style={styles.walletText}>{t('goCharacter')}</Text>
            </Pressable>}
            {quests[index] === 'active' && index === 4 && <Text style={styles.progressLabel}>{t('treeQuestHint')}</Text>}
            {quests[index] === 'active' && index === 3 && <Text style={styles.progressLabel}>{progress.xp}/{xpFloor(2)} XP · {t('xpHint')}</Text>}
            {quests[index] === 'active' && index === 5 && (!signature || progress.receipt?.status === 'failed') && <Pressable
              disabled={recording || isConnectingWallet || (online && server!.busy)} onPress={online || wallet ? handleRecord : handleWalletConnect} style={styles.languageButton}>
              <Text style={styles.walletText}>{t(recording || (online && server!.busy) ? 'recording' : online || wallet ? 'record' : 'wallet')}</Text></Pressable>}
            {index === 5 && online && !!server!.notice && <Text accessibilityLiveRegion="polite" style={styles.progressLabel}>{server!.notice}</Text>}
            {index === 5 && recordNotice && <Text accessibilityLiveRegion="polite" style={styles.progressLabel}>{t(recordNotice.key, recordNotice.value)}</Text>}
          </View>
        ))}
        {signature && <Pressable style={styles.languageButton} onPress={() => {
          Linking.openURL(`https://explorer.solana.com/tx/${signature}?cluster=devnet`).catch(() => setMessage({ key: 'explorerError' }));
        }}><Text style={styles.walletText}>{t('explorer')}</Text></Pressable>}
        {progress.receipt?.status === 'pending' && <Pressable disabled={recording} onPress={handleCheck} style={styles.languageButton}><Text style={styles.walletText}>{t(recording ? 'recording' : 'checkRecord')}</Text></Pressable>}
      </View>
      </View>}
      {(panel === 'character' || panel === 'axe' || panel === 'gems') && <CharacterPanel key={panel} initialPage={panel === 'gems' ? 'gems' : panel === 'axe' ? 'axe' : 'overview'} progress={progress} commit={commit} onSkin={handleSkin}
        onUpgrade={() => handleUpgrade('axe')} onNavigate={() => panelScroll.current?.scrollTo({ y: 0, animated: false })} />}
      {panel === 'tree' && <View style={styles.achievement}>
        {progress.treeLevel === TREE_MAX && treeHp === 0 && <Text style={styles.statValue}>{t('ending')}</Text>}
        <Text style={styles.walletText}>{t('tree')} Lv. {progress.treeLevel} / {TREE_MAX} · HP {maxTreeHp}</Text>
        <Text style={styles.progressLabel}>{t('treeStage', stage + 1)}</Text>
        <Text style={styles.progressLabel}>{t('treeBonus', progress.treeLevel)}</Text>
        {progress.treeLevel < TREE_MAX && <Text style={styles.progressLabel}>{t('nextTreeBonus', progress.treeLevel + 1)}</Text>}
        <Text style={styles.progressLabel}>{t('ownedWood', wood)}</Text>
        {progress.treeLevel < TREE_MAX && <Text style={styles.progressLabel}>{t('nextTreeStats', `HP ${encounterHealth({ ...progress, treeLevel: progress.treeLevel + 1 })}`)}</Text>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: treeHp !== 0 || progress.treeLevel >= TREE_MAX || wood < treeCost(progress.treeLevel) }}
          disabled={treeHp !== 0 || progress.treeLevel >= TREE_MAX || wood < treeCost(progress.treeLevel)} onPress={() => handleUpgrade('tree')}
          style={[styles.languageButton, (treeHp !== 0 || progress.treeLevel >= TREE_MAX || wood < treeCost(progress.treeLevel)) && styles.disabledButton]}>
          <Text style={styles.walletText}>{t(progress.treeLevel >= TREE_MAX ? 'maxLevel' : 'upgradeCost', treeCost(progress.treeLevel))}</Text>
        </Pressable>
        {wood < treeCost(progress.treeLevel) && progress.treeLevel < TREE_MAX && <Text style={styles.progressLabel}>{t('insufficientWood')}</Text>}
        <Pressable onPress={() => { if (online) { if (server!.command({ type: 'regrow' })) setPanel(null); return; } if (commit(regrow(progressRef.current))) setPanel(null); }} style={styles.languageButton}>
          <Text style={styles.walletText}>{t('continueSameTree')}</Text>
        </Pressable>
      </View>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function AxeArt({ commemorative, pioneer = false, warden = false, recovery = false, crowned = false }: { commemorative: boolean; pioneer?: boolean; warden?: boolean; recovery?: boolean; crowned?: boolean }) {
  return <View style={styles.axeArt}>
    <View style={[styles.axeHandle, commemorative && { backgroundColor: '#6A49A8' }, pioneer && { backgroundColor: '#377C85' }, warden && { backgroundColor: '#234A63' }]}>
      <View style={[styles.axeBlade, commemorative && { backgroundColor: '#9945FF', borderLeftColor: '#14F195' }, pioneer && { backgroundColor: '#DCAA54', borderLeftColor: '#FFF0BC' }, warden && { backgroundColor: '#69C9ED', borderLeftColor: '#DBF7FF', width: 52 }, recovery && { backgroundColor: '#80BC78', borderLeftColor: '#E5F9B1' }]}>
        {commemorative && <View style={styles.axeRune} />}
        {crowned && warden && <View style={[StyleSheet.absoluteFill, { backgroundColor: '#D5A12A', borderWidth: 3, borderColor: '#FFD56A', borderRadius: 5 }]}><Text style={{ color: '#FFF5C4', textAlign: 'center' }}>◆</Text></View>}
      </View>
      {commemorative && <View style={styles.axeBand} />}
    </View>
  </View>;
}

function InfoLabel({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <Text style={styles.progressLabel}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
      hitSlop={10} style={{ width: 24, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#A6CDBD', fontSize: 15 }}>ⓘ</Text>
    </Pressable>
  </View>;
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return <View style={[styles.statCard, { borderColor: accent }]}><Text style={styles.statLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={styles.statValue}>{value}</Text></View>;
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
  return <Animated.Text pointerEvents="none" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[styles.damagePopup, popup.critical && { color: '#FFD45E' }, {
    left: `${popup.left}%`, right: '3%', top: `${popup.top}%`,
    opacity: progress.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 1, 0] }),
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -44] }) }],
  }]}>{popup.critical ? '✦ ' : ''}−{popup.value}</Animated.Text>;
}

const DraggableLog = memo(function DraggableLog({ log, label, onCollected, onDraggingChange }: {
  log: Log;
  label: string;
  onCollected: (id: number) => void;
  onDraggingChange: (id: number, dragging: boolean) => void;
}) {
  const pan = useRef(new Animated.ValueXY()).current;
  const fall = useRef(new Animated.Value(-65)).current;
  const life = useRef(new Animated.Value(1)).current;
  const handlers = useRef({ onCollected, onDraggingChange });
  handlers.current = { onCollected, onDraggingChange };
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
      handlers.current.onDraggingChange(log.id, true);
    },
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => {
      handlers.current.onDraggingChange(log.id, false);
      if (Math.hypot(gesture.dx, gesture.dy) > 12) {
        handlers.current.onCollected(log.id);
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      }
      else Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: () => {
      handlers.current.onDraggingChange(log.id, false);
      pan.setValue({ x: 0, y: 0 });
    },
  })).current;
  return <Animated.View {...responder.panHandlers} accessibilityLabel={label}
    style={[styles.log, { left: `${log.left}%`, top: `${log.top}%`, transform: pan.getTranslateTransform() }]}>
    <Animated.View pointerEvents="none" style={{ alignItems: 'center', transform: [{ translateY: fall }], opacity: life.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }) }}>
      <Text style={styles.logEmoji}>🪵</Text><Text style={[styles.logValue, log.bonusWood > 0 && { backgroundColor: '#735521', color: '#FFF0A0' }]}>{log.bonusWood > 0 ? '✦ ' : ''}+{log.value}</Text>
      <Animated.View style={[styles.logTimer, { transform: [{ scaleX: life }] }]} />
    </Animated.View>
  </Animated.View>;
});

const styles = StyleSheet.create({
  axeArt: { width: 60, height: 95, alignItems: 'center', justifyContent: 'flex-end' },
  axeHandle: { width: 10, height: 80, borderRadius: 5, backgroundColor: '#BE8558', transform: [{ rotate: '20deg' }], marginBottom: 4 },
  axeBlade: { position: 'absolute', top: 0, left: -20, width: 44, height: 30, borderRadius: 7, backgroundColor: '#C3D9D3', borderLeftWidth: 7, borderLeftColor: '#F0F4E5' },
  axeRune: { position: 'absolute', top: 8, left: 12, width: 9, height: 13, borderRadius: 2, backgroundColor: '#C1FFEF', transform: [{ rotate: '30deg' }] },
  axeBand: { position: 'absolute', top: 48, width: 10, height: 12, backgroundColor: '#14F195' },
  forestAxe: { position: 'absolute', top: 12, left: 10, zIndex: 3, transform: [{ scale: 0.7 }] },
  forestGem: { position: 'absolute', top: 104, left: 16, zIndex: 4, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  autoPickupButton: { position: 'absolute', bottom: 42, left: 8, zIndex: 4, minHeight: 44,
    paddingHorizontal: 8, paddingVertical: 4, gap: 2, borderRadius: 10, backgroundColor: '#214743', borderWidth: 1, borderColor: '#91D3B1', alignItems: 'center', justifyContent: 'center' },
  rewardPreview: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarAxePosition: { position: 'absolute', top: 72, marginLeft: 125 },
  container: { flex: 1, backgroundColor: '#102D32', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 24 : 0 },
  gameScreen: { flex: 1, paddingBottom: 24 },
  menuButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#25484A', alignItems: 'center', justifyContent: 'center', gap: 5 },
  menuLine: { width: 20, height: 2, borderRadius: 1, backgroundColor: '#F8EED6' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#061A20CC' },
  modalCard: { maxHeight: '88%', backgroundColor: '#102D32', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#48736B' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 12 },
  panelContent: { paddingBottom: 20 },
  disabledButton: { opacity: 0.38 },
  felledTree: { position: 'absolute', left: '15%', right: '15%', top: '23%', alignItems: 'center', gap: 16 },
  stump: { height: 75, width: 88, borderRadius: 22, backgroundColor: '#9B603F', borderBottomWidth: 12, borderBottomColor: '#75492F' },
  stumpRing: { height: 24, borderRadius: 20, borderWidth: 6, borderColor: '#BE8558', backgroundColor: '#E6BF80' },
  upgradeMarker: { paddingHorizontal: 20, paddingVertical: 15, borderRadius: 16, backgroundColor: '#EFC75E' },
  markerText: { color: '#4E3825', fontSize: 15, fontWeight: '900' },
  portrait: { height: 218, alignItems: 'center', backgroundColor: '#234D4C', borderRadius: 20, marginBottom: 8 },
  avatarHead: { position: 'absolute', top: 37, width: 52, height: 52, borderRadius: 20, backgroundColor: '#EBC292', zIndex: 2 },
  avatarHat: { position: 'absolute', top: -9, left: -6, width: 64, height: 26, borderRadius: 10, backgroundColor: '#C87348' },
  avatarEye: { position: 'absolute', right: 10, top: 25, width: 5, height: 5, borderRadius: 3, backgroundColor: '#203637' },
  avatarBody: { position: 'absolute', top: 85, width: 74, height: 72, borderRadius: 18, backgroundColor: '#729D7C' },
  avatarBelt: { position: 'absolute', bottom: 7, height: 10, width: 74, backgroundColor: '#EFC75E' },
  avatarLegLeft: { position: 'absolute', top: 152, marginLeft: -35, width: 26, height: 40, borderRadius: 7, backgroundColor: '#28403F' },
  avatarLegRight: { position: 'absolute', top: 152, marginLeft: 35, width: 26, height: 40, borderRadius: 7, backgroundColor: '#28403F' },
  avatarAxeHandle: { position: 'absolute', top: 87, marginLeft: 125, width: 10, height: 86, borderRadius: 5, backgroundColor: '#BE8558', transform: [{ rotate: '20deg' }] },
  avatarAxeBlade: { position: 'absolute', top: -5, left: -20, width: 44, height: 30, borderRadius: 7, backgroundColor: '#C3D9D3', borderLeftWidth: 7, borderLeftColor: '#F0F4E5' },
  saveError: { color: '#FFB8A8', padding: 12 },
  recoveryText: { color: '#EFC75E', fontSize: 12, marginTop: 8 },
  questRow: { gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#355D59' },
  questActive: { borderColor: '#EFC75E', backgroundColor: '#25484A' },
  languageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8, marginTop: 10 },
  languageButton: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#25484A', borderRadius: 12 },
  languageSelected: { backgroundColor: '#48736B' },
  achievement: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: '#18383B', marginTop: 8 },
  treeTouch: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  logTimer: { height: 3, width: 36, backgroundColor: '#F5C76B', marginTop: 10, borderRadius: 2 },
  header: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 },
  eyebrow: { color: '#88ACA5', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: '#F7E9C6', fontSize: 23, fontWeight: '900', letterSpacing: 1 },
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
  forest: { flex: 1, marginTop: 12, backgroundColor: '#234D4C', borderRadius: 24, overflow: 'hidden', minHeight: 0, position: 'relative' },
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
