// @refresh reset
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  Platform,
  StatusBar as NativeStatusBar,
  PanResponder,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GameAudioProvider, AudioSettingsControls, SoundPressable as Pressable, useGameAudio } from './src/audio/GameAudio';
import { progressCues } from './src/audio/policy';
import { connectWallet, ConnectedWallet } from './src/solana/wallet';
import { checkHarvest } from './src/solana/achievement';
import { CharacterPanel } from './src/game/CharacterPanel';
import { GemArt } from './src/game/GemArt';
import { ForesterSprite } from './src/game/ForesterSprite';
import { WardenQuests } from './src/game/DeepwoodContent';
import { CommunityWorld } from './src/game/CommunityWorld';
import { SquirrelExpedition } from './src/game/SquirrelExpedition';
import { forestShortcutUnlocks } from './src/game/shortcut-unlocks';
import { ForestMap } from './src/game/ForestMap';
import { WorldBossWorld } from './src/game/WorldBossWorld';
import { PlayGuide } from './src/game/PlayGuide';
import { TutorialNudge } from './src/game/TutorialNudge';
import { nextTutorial, tutorialBit, type TutorialStep } from './src/game/tutorial';
import { loadTutorialSeen, saveTutorialSeen, type TutorialScope } from './src/game/tutorial-storage';
import { devQuestPreview } from './src/game/dev-quest-preview';
import { loadDevWalletSkip, saveDevWalletSkip } from './src/game/dev-wallet-skip-storage';
import { fitTrolleyLogs, sweptLogIds, type SweepBox, type SweepPoint } from './src/game/log-sweep';
import { questShortcut } from './src/game/quest-shortcut';
import { ServerLoginPanel, type ServerController } from './src/game/ServerLoginPanel';
import { activeBoss, encounterHealth, defeatCoins } from './src/game/progression';
import { questView } from './src/game/quest-view';
import { GameMessage, Language, translate, TranslationKey } from './src/i18n';
import { AXE_MAX, CHARACTER_MAX, TREE_MAX, RECOVERY_MS, initialProgress, recover, hit, collect, loadTrolley, dispatchTrolley, upgrade, testRest,
  combatStats, treeAppearance, equip, grantTestOptions, OPTION_ITEMS, OptionId,
  claimFirstRecord, claimGrowthReward, claimAdventure, adventureReady, nextForestTrail, claimForestTrail, fatiguePotionCount, useFatiguePotion, axeLevelFor, displayedHitXp, equipAxeSkin, skinQuestCollected, firstRecordBonusActive, attackIntervalMs,
  treeHealth, trolleyCapacity, axeCost, axeUpgradeReady, treeCost, characterLevel, xpFloor, xpRequired, hitXp, treeCoins, highestAxeLevel, walletUnlocked, questSteps, regrow, WOOD_GEM_COST, Progress } from './src/game/progression';
import { loadProgress, saveProgress } from './src/game/storage';
import { deployment } from './src/deployment';
import { squirrelAtHome, squirrelNeedsAttention, squirrelTimeLeft } from './src/shared/pets';
import { FarmWorld } from './src/game/FarmWorld';
import { FARM_UNLOCK_LEVEL, claimFarmTree, finishFarmPuzzle, startFarmPuzzle, plantFarmSeed, activateBlessing, blessingMultiplier } from './src/game/farm';
import { WOOD_DROP_VISIBLE_MS, visibleDropExpiry } from './src/shared/drop-lifetime';

type Log = {
  id: number;
  left: number;
  bottom: number;
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

const LOG_LIFETIME_MS = WOOD_DROP_VISIBLE_MS;
const HOLD_TO_CHOP_MS = 280;
const TROLLEY_SPRITES = [
  require('./assets/forest/trolley-v2-empty.png'),
  require('./assets/forest/trolley-v2-low.png'),
  require('./assets/forest/trolley-v2-medium.png'),
  require('./assets/forest/trolley-v2-full.png'),
];
const floorPosition = (id: number) => ({ left: [31, 40, 49, 35, 44][id % 5], bottom: [7, 17, 8, 22, 13][id % 5] });

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const hudAmount = (value: number) => {
  if (value < 10_000) return value.toLocaleString('en-US');
  const unit = value >= 1_000_000 ? 1_000_000 : 1_000;
  const scaled = value / unit;
  return `${scaled < 100 ? scaled.toFixed(1) : Math.floor(scaled)}${unit === 1_000_000 ? 'M' : 'K'}`;
};

const recoveryCountdown = (recoveryAt: number | null, time: number) => {
  const seconds = recoveryAt === null ? 0 : Math.max(0, Math.ceil((recoveryAt + RECOVERY_MS - time) / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
};

export default function App() {
  return <GameAudioProvider><GameApp /></GameAudioProvider>;
}

function GameApp() {
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
  const { play: playSound, scene: audioScene } = useGameAudio();
  const online = !!server?.snapshot;
  const [loaded] = useState(() => {
    if (server?.snapshot) return { state: server.snapshot.progress, error: false };
    try { return { state: recover(loadProgress(__DEV__ ? 'ko' : 'en'), Date.now()), error: false }; }
    catch { return { state: initialProgress(__DEV__ ? 'ko' : 'en'), error: true }; }
  });
  const [localProgress, setProgress] = useState(loaded.state);
  const progress = useMemo(() => online ? { ...server!.snapshot!.progress, language: uiLanguage } : localProgress, [online, server?.snapshot?.progress, uiLanguage, localProgress]);
  const [devWalletSkip, setDevWalletSkip] = useState(() => __DEV__ && !online && loadDevWalletSkip());
  const questProgress = useMemo(() => devQuestPreview(progress, __DEV__ && !online && devWalletSkip), [progress, online, devWalletSkip]);
  const tutorialScope: TutorialScope = online ? 'server' : 'local';
  const [tutorialSeenMask, setTutorialSeenMask] = useState(() => loadTutorialSeen(tutorialScope,
    progress.totalHits > 0 || progress.harvested > 0 || progress.treeLevel > 1));
  const tutorialSeenRef = useRef(tutorialSeenMask);
  const [tutorialCoolUntil, setTutorialCoolUntil] = useState(0);
  const completeTutorial = useCallback((step: TutorialStep) => {
    const next = tutorialSeenRef.current | tutorialBit(step);
    if (next === tutorialSeenRef.current) return;
    tutorialSeenRef.current = next;
    try { saveTutorialSeen(tutorialScope, next); } catch { /* Hints must never block play or game saves. */ }
    setTutorialSeenMask(next);
    setTutorialCoolUntil(Date.now() + 1400);
  }, [tutorialScope]);
  const replayTutorial = () => {
    tutorialSeenRef.current = 0;
    try { saveTutorialSeen(tutorialScope, 0); } catch { /* The current session can still replay. */ }
    setTutorialSeenMask(0);
    setTutorialCoolUntil(0);
    setPanel(null);
  };
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const serverRef = useRef(server); serverRef.current = server;
  const unavailable = () => Alert.alert(uiLanguage === 'ko' ? '서버 연결' : 'Server connection', uiLanguage === 'ko' ? '이 기능은 아직 서버 연결 중이에요. 로컬 재화로 대신 처리하지 않아요.' : 'This feature is not connected to the server yet. No local balances will be changed.');
  const [saveError, setSaveError] = useState(loaded.error);
  const [panel, setPanel] = useState<'menu' | 'guide' | 'quests' | 'map' | 'farm' | 'community' | 'worldBoss' | 'character' | 'axe' | 'gems' | 'pet' | 'tree' | null>(null);
  const previousPanel = useRef(panel);
  useEffect(() => {
    audioScene(panel === 'worldBoss' ? 'boss' : 'forest');
    if (panel !== previousPanel.current) {
      playSound(panel === null ? 'close' : panel === 'map' ? 'map' : 'open');
      previousPanel.current = panel;
    }
  }, [panel, audioScene, playSound]);
  const panelScroll = useRef<ScrollView>(null);
  const commit = useCallback((next: Progress) => {
    if (serverRef.current?.snapshot) { unavailable(); return false; }
    if (loaded.error) return false;
    try { saveProgress(next); setSaveError(false); }
    catch { setSaveError(true); return false; }
    for (const cue of progressCues(progressRef.current, next)) playSound(cue);
    progressRef.current = next;
    setProgress(next);
    return true;
  }, [loaded.error, playSound]);
  const { treeHp, fatigue, wood, language } = progress;
  const level = characterLevel(progress.xp);
  const boss = activeBoss(progress);
  const maxTreeHp = encounterHealth(progress);
  const stats = useMemo(() => combatStats(progress), [progress]);
  const axePower = `${stats.min}–${stats.max}`;
  const trolleyFill = progress.trolleyWood > 0
    ? Math.min(3, Math.max(1, Math.ceil(progress.trolleyWood * 3 / trolleyCapacity(progress)))) : 0;
  const stage = treeAppearance(progress.treeLevel);
  const xpValue = level === CHARACTER_MAX ? 1 : progress.xp - xpFloor(level);
  const xpMax = level === CHARACTER_MAX ? 1 : xpRequired(level);
  const unlocked = walletUnlocked(progress);
  const quests = useMemo(() => questSteps(questProgress), [questProgress]);
  const visibleQuests = useMemo(() => questView(quests), [quests]);
  const trailQuest = nextForestTrail(questProgress);
  const shortcut = questShortcut(questProgress, quests);
  useEffect(() => {
    if (panel === 'quests') panelScroll.current?.scrollTo({ y: 0, animated: false });
  }, [panel, visibleQuests.active, trailQuest?.index]);
  const [now, setNow] = useState(Date.now());
  const squirrel = online ? server!.snapshot?.squirrel : undefined;
  const shortcutUnlocks = forestShortcutUnlocks(progress, squirrel, online ? server!.snapshot?.community : undefined);
  const squirrelHome = squirrelAtHome(squirrel, online ? server!.now : now);
  const squirrelAttention = squirrelNeedsAttention(squirrel, online ? server!.now : now);
  const squirrelAway = !!squirrel?.owned && !!squirrel.trip && !squirrelHome;
  const countdown = recoveryCountdown(progress.recoveryAt, online ? server!.now : now);
  const [logs, setLogs] = useState<Log[]>([]);
  const tutorialStep = nextTutorial(progress, tutorialSeenMask, logs.length, panel !== null, now < tutorialCoolUntil, shortcutUnlocks);
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
  const [autoPickupNotice, setAutoPickupNotice] = useState<{ id: number; value: number } | null>(null);
  const [mode, setMode] = useState<'chop' | 'collect'>('chop');
  const setLanguage = (language: Language) => { onLanguage(language); if (!online) commit({ ...progressRef.current, language }); };
  const t = (key: TranslationKey, value?: string | number) => translate(language, key, value);
  const trailTitle = trailQuest ? t('qForestTrail', trailQuest.tree) : '';
  const trailReward = trailQuest ? `${t('forestTrailReward', trailQuest.coins)}${trailQuest.gem ? ` + ${t(trailQuest.gem)} ${t('gems')} ×1` : ''}` : '';
  const shortcutLabel = trailQuest ? t('nextQuest', trailTitle) : shortcut?.key === 'nextQuest' ? t('nextQuest', t(shortcut.quest))
    : shortcut ? t(shortcut.key, 'value' in shortcut ? shortcut.value : undefined) : null;
  const [message, setMessage] = useState<GameMessage>({ key: 'intro' });
  const [uiNotice, setUiNotice] = useState<GameMessage | null>(null);
  const notifyFatigue = useCallback(() => {
    playSound('unavailable');
    const connection = serverRef.current;
    const notice: GameMessage = { key: 'fatigueFull', value: recoveryCountdown(progressRef.current.recoveryAt, connection?.snapshot ? connection.now : Date.now()) };
    if (connection?.snapshot) setUiNotice(notice);
    else setMessage(notice);
  }, [playSound]);
  useEffect(() => {
    if (message.key === 'intro') return;
    const timer = setTimeout(() => setMessage(current => current === message ? { key: 'intro' } : current),
      message.key === 'coinsEarned' ? 1800 : 2800);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    if (!uiNotice) return;
    const timer = setTimeout(() => setUiNotice(current => current === uiNotice ? null : current), 2200);
    return () => clearTimeout(timer);
  }, [uiNotice]);
  const gameplayNotice = online
    ? (uiNotice ? t(uiNotice.key, uiNotice.value) : server!.notice) || (server!.pending && !server!.busy
      ? (language === 'ko' ? '메뉴에서 미확인 요청을 재확인해 주세요.' : 'Retry the pending request in the menu.')
      : null)
    : message.key === 'intro' ? null : t(message.key, message.value);
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
  const forestRef = useRef<View>(null);
  const storageRef = useRef<View>(null);
  const forestBounds = useRef<SweepBox | null>(null);
  const [forestWidth, setForestWidth] = useState(0);
  const trolleyOffset = useRef(new Animated.Value(0)).current;
  const sweptIds = useRef(new Set<number>());
  const [sweepHighlight, setSweepHighlight] = useState<number[]>([]);
  const draggingLogs = useRef(new Set<number>());
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdingTree = useRef(false);
  const [isHolding, setIsHolding] = useState(false);
  const holdPulse = useRef(new Animated.Value(0)).current;
  const holdAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const stopHoldingTree = useCallback(() => {
    holdingTree.current = false;
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
    holdAnimation.current?.stop();
    holdAnimation.current = null;
    holdPulse.setValue(0);
    setIsHolding(false);
  }, [holdPulse]);
  const seenServerHits = useRef(server?.snapshot?.progress.totalHits ?? 0);
  const seenServerFatigue = useRef(server?.snapshot?.progress.fatigue ?? 0);
  const damageTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => () => { for (const timer of damageTimers.current) clearTimeout(timer); }, []);
  const lastRecoveryCheck = useRef(0);

  const syncDragMode = useCallback((id: number, dragging: boolean) => {
    if (dragging) { stopHoldingTree(); draggingLogs.current.add(id); }
    else draggingLogs.current.delete(id);
    setMode(draggingLogs.current.size > 0 ? 'collect' : 'chop');
    serverRef.current?.dragging(draggingLogs.current.size > 0);
  }, [stopHoldingTree]);

  useEffect(() => {
    if (!server?.snapshot) return;
    const snapshot = server.snapshot;
    const prior = new Map([...activeLogs.current.values()].map(log => [log.serverId, log]));
    activeLogs.current.clear();
    for (const drop of snapshot.drops ?? []) {
      const visibleUntil = visibleDropExpiry(drop.expiresAt);
      if (visibleUntil <= server.now) continue;
      const existing = prior.get(drop.id);
      const id = existing?.id ?? nextLogId.current++;
      const log: Log = existing ?? { id, serverId: drop.id, ...floorPosition(id), value: drop.value, bonusWood: 0, expiresAt: Date.now() + visibleUntil - server.now };
      activeLogs.current.set(log.id, log);
    }
    const currentLogs = [...activeLogs.current.values()];
    setLogs(existing => existing.length === currentLogs.length && existing.every((log, i) => log === currentLogs[i]) ? existing : currentLogs);
    const previousHits = seenServerHits.current;
    const hadNewHits = snapshot.progress.totalHits > previousHits;
    if (hadNewHits && (snapshot.drops ?? []).some(drop => !prior.has(drop.id))) playSound('drop');
    seenServerHits.current = snapshot.progress.totalHits;
    if (seenServerFatigue.current < 100 && snapshot.progress.fatigue >= 100)
      setUiNotice({ key: 'fatigueFull', value: recoveryCountdown(snapshot.progress.recoveryAt, server.now) });
    seenServerFatigue.current = snapshot.progress.fatigue;
    if (hadNewHits && snapshot.lastDamage !== undefined) {
      const events = snapshot.hitEvents?.filter(event => event.hit > previousHits) ?? [{ damage: snapshot.lastDamage, critical: false }];
      const popups = events.map((event, i) => ({ id: nextEffectId.current++, value: event.damage, critical: event.critical, left: 62 + i * 2, top: 30 + i * 6 }));
      setDamagePopups(current => [...current, ...popups].slice(-8));
      const ids = new Set(popups.map(popup => popup.id));
      const timer = setTimeout(() => { damageTimers.current.delete(timer); setDamagePopups(current => current.filter(popup => !ids.has(popup.id))); }, 760);
      damageTimers.current.add(timer);
    }
  }, [server?.snapshot, playSound]);

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
    // Collection checks use expiresAt directly; visual cleanup can run less
    // often without extending the five-second pickup window.
    }, 200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const update = () => {
      const time = Date.now();
      setNow(time);
      const connection = serverRef.current;
      if (connection?.snapshot) {
        const recoveryAt = connection.snapshot.progress.recoveryAt;
        const trip = connection.snapshot.progress.trolleyTrip;
        const trolleyDue = !!trip && (connection.now >= trip.returnsAt || (connection.now >= trip.arrivesAt && connection.snapshot.progress.trolleyWood > 0));
        const fatigueDue = recoveryAt !== null && connection.now >= recoveryAt + RECOVERY_MS;
        if ((trolleyDue || fatigueDue) && !connection.busy && !connection.pending && connection.queued === 0 && time - lastRecoveryCheck.current >= (trolleyDue ? 1000 : 5000)) {
          lastRecoveryCheck.current = time; connection.command({ type: 'recover' });
        }
        return;
      }
      const beforeHarvested = progressRef.current.harvested;
      const next = recover(progressRef.current, time);
      if (next !== progressRef.current && commit(next) && next.harvested > beforeHarvested)
        setMessage(beforeHarvested < 20 && next.harvested >= 20 ? { key: 'firstHarvestReady' } : { key: 'collected', value: next.harvested - beforeHarvested });
    };
    const timer = setInterval(update, 1000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') update(); else stopHoldingTree(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [commit, stopHoldingTree]);

  useEffect(() => {
    trolleyOffset.stopAnimation();
    const trip = progress.trolleyTrip;
    const distance = Math.max(0, forestWidth - 144);
    if (!trip || !distance) { trolleyOffset.setValue(0); return; }
    const time = serverRef.current?.snapshot ? serverRef.current.now : Date.now();
    if (time < trip.arrivesAt) {
      const elapsed = Math.max(0, time - trip.departedAt);
      trolleyOffset.setValue(-distance * Math.min(1, elapsed / (trip.arrivesAt - trip.departedAt)));
      Animated.sequence([
        Animated.timing(trolleyOffset, { toValue: -distance, duration: trip.arrivesAt - time, useNativeDriver: true }),
        Animated.timing(trolleyOffset, { toValue: 0, duration: trip.returnsAt - trip.arrivesAt, useNativeDriver: true }),
      ]).start();
    } else if (time < trip.returnsAt) {
      trolleyOffset.setValue(-distance * (trip.returnsAt - time) / (trip.returnsAt - trip.arrivesAt));
      Animated.timing(trolleyOffset, { toValue: 0, duration: trip.returnsAt - time, useNativeDriver: true }).start();
    } else trolleyOffset.setValue(0);
    return () => trolleyOffset.stopAnimation();
  }, [progress.trolleyTrip?.departedAt, forestWidth, trolleyOffset]);

  useEffect(() => {
    const trip = progress.trolleyTrip;
    if (!trip) return;
    const settle = () => {
      const connection = serverRef.current;
      if (connection?.snapshot) {
        const current = connection.snapshot.progress.trolleyTrip;
        if (current && !connection.busy && !connection.pending && connection.queued === 0 &&
          (connection.now >= current.returnsAt || (connection.now >= current.arrivesAt && connection.snapshot.progress.trolleyWood > 0)))
          connection.command({ type: 'recover' });
        return;
      }
      const before = progressRef.current.harvested;
      const next = recover(progressRef.current, Date.now());
      if (next !== progressRef.current && commit(next) && next.harvested > before)
        setMessage(before < 20 && next.harvested >= 20 ? { key: 'firstHarvestReady' } : { key: 'collected', value: next.harvested - before });
    };
    const clock = serverRef.current?.snapshot ? serverRef.current.now : Date.now();
    const arrival = setTimeout(settle, Math.max(0, trip.arrivesAt - clock) + 30);
    const returned = setTimeout(settle, Math.max(0, trip.returnsAt - clock) + 30);
    return () => { clearTimeout(arrival); clearTimeout(returned); };
  }, [progress.trolleyTrip?.departedAt, commit]);

  const swing = useRef(new Animated.Value(0)).current;
  const impact = useRef(new Animated.Value(0)).current;
  const playChopMotion = useCallback(() => {
    const soundTimer = setTimeout(() => { damageTimers.current.delete(soundTimer); playSound('chop'); }, 210);
    damageTimers.current.add(soundTimer);
    swing.stopAnimation(); swing.setValue(0);
    Animated.sequence([
      Animated.timing(swing, { toValue: 0.25, duration: 140, useNativeDriver: true }),
      Animated.timing(swing, { toValue: 0.5, duration: 90, useNativeDriver: true }),
      Animated.timing(swing, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    shake.stopAnimation(); shake.setValue(0);
    Animated.sequence([
      Animated.delay(210),
      Animated.timing(shake, { toValue: 7, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -5, duration: 55, useNativeDriver: true }),
      Animated.spring(shake, { toValue: 0, speed: 28, bounciness: 8, useNativeDriver: true }),
    ]).start();
    impact.stopAnimation(); impact.setValue(0);
    Animated.sequence([
      Animated.delay(210),
      Animated.timing(impact, { toValue: 1, duration: 75, useNativeDriver: true }),
      Animated.timing(impact, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [impact, shake, swing, playSound]);

  const chop = useCallback(() => {
    if (panel || progressRef.current.treeHp === 0) return;
    if (draggingLogs.current.size > 0) {
      setMessage({ key: 'dragging' });
      return;
    }
    const connection = serverRef.current;
    if (connection?.snapshot) {
      if (progressRef.current.fatigue >= 100) { notifyFatigue(); return; }
      if (!connection.hit()) return;
      completeTutorial('chop');
      playChopMotion();
      return;
    }
    const now = Date.now();
    const result = hit(progressRef.current, now);
    if (!result) {
      notifyFatigue();
      return;
    }

    const leveledUp = characterLevel(result.state.xp) > characterLevel(progressRef.current.xp);
    if (!commit(result.state)) return;
    completeTutorial('chop');
    const damage = result.damage;
    playChopMotion();
    const effectId = nextEffectId.current++;
    const logId = nextLogId.current++;
    const droppedLog: Log = {
      id: logId,
      ...floorPosition(logId),
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
      const landingSound = setTimeout(() => { damageTimers.current.delete(landingSound); playSound('drop'); }, 430);
      damageTimers.current.add(landingSound);
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
    if (result.state.fatigue >= 100)
      setMessage({ key: 'fatigueFull', value: recoveryCountdown(result.state.recoveryAt, now) });
    if (result.bossDefeated) {
      const lang = result.state.language;
      Alert.alert(translate(lang, 'bossDefeated'), translate(lang, result.bossDefeated === 'first' ? 'bossFirstReward' : 'bossGateReward'));
    }
  }, [commit, completeTutorial, notifyFatigue, panel, playChopMotion, playSound]);

  const chopRef = useRef(chop);
  chopRef.current = chop;
  const startHoldingTree = () => {
    if (holdingTree.current || panel || progressRef.current.treeHp <= 0 || draggingLogs.current.size > 0) return;
    if (progressRef.current.fatigue >= 100) { notifyFatigue(); return; }
    holdingTree.current = true;
    setIsHolding(true);
    holdAnimation.current = Animated.loop(Animated.sequence([
      Animated.timing(holdPulse, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(holdPulse, { toValue: 0, duration: 480, useNativeDriver: true }),
    ]));
    holdAnimation.current.start();
    chopRef.current();
    holdTimer.current = setInterval(() => {
      if (holdingTree.current) chopRef.current();
    }, attackIntervalMs(progressRef.current));
  };
  useEffect(() => {
    if (panel || mode === 'collect' || treeHp <= 0 || fatigue >= 100) stopHoldingTree();
  }, [panel, mode, treeHp, fatigue, stopHoldingTree]);
  useEffect(() => () => stopHoldingTree(), [stopHoldingTree]);

  const loadLogs = useCallback((ids: number[]) => {
    if (progressRef.current.trolleyTrip) {
      if (serverRef.current?.snapshot) setUiNotice({ key: 'trolleyBusy' });
      else setMessage({ key: 'trolleyBusy' });
      return;
    }
    const now = Date.now();
    const candidates = ids.map(id => activeLogs.current.get(id)).filter((log): log is Log => !!log && log.expiresAt > now).slice(0, serverRef.current?.snapshot ? 8 : 16);
    if (!candidates.length) return;
    const targets = fitTrolleyLogs(candidates, trolleyCapacity(progressRef.current) - progressRef.current.trolleyWood);
    if (!targets.length) {
      if (serverRef.current?.snapshot) setUiNotice({ key: 'trolleyFull' });
      else setMessage({ key: 'trolleyFull' });
      return;
    }
    if (serverRef.current?.snapshot) {
      const dropIds = targets.map(log => log.serverId).filter((id): id is string => !!id);
      if (dropIds.length === targets.length) {
        setUiNotice(null);
        if (serverRef.current.command({ type: 'loadTrolleyBatch', dropIds })) completeTutorial('sweep');
      }
      return;
    }
    const total = targets.reduce((sum, log) => sum + log.value, 0);
    const next = loadTrolley(progressRef.current, total);
    if (next === progressRef.current || !commit(next)) return;
    completeTutorial('sweep');
    setMessage({ key: 'trolleyLoaded', value: total });
    for (const target of targets) activeLogs.current.delete(target.id);
    setLogs([...activeLogs.current.values()]);
  }, [commit, completeTutorial]);
  const collectDirect = useCallback((id: number) => {
    const target = activeLogs.current.get(id);
    if (!target || target.expiresAt <= Date.now()) return;
    if (serverRef.current?.snapshot) {
      if (target.serverId && serverRef.current.command({ type: 'collectDrop', dropId: target.serverId })) completeTutorial('storage');
      return;
    }
    const before = progressRef.current.harvested;
    const next = collect(progressRef.current, target.value);
    if (next === progressRef.current || !commit(next)) return;
    completeTutorial('storage');
    activeLogs.current.delete(id);
    setLogs([...activeLogs.current.values()]);
    setMessage(before < 20 && next.harvested >= 20 ? { key: 'firstHarvestReady' } : { key: 'collected', value: target.value });
  }, [commit, completeTutorial]);
  const beginSweep = useCallback(() => {
    sweptIds.current.clear();
    setSweepHighlight([]);
    forestRef.current?.measureInWindow((x, y, width, height) => { forestBounds.current = { x, y, width, height }; });
  }, []);
  const extendSweep = useCallback((sourceId: number, from: SweepPoint, to: SweepPoint) => {
    const box = forestBounds.current;
    const touched = box ? sweptLogIds([...activeLogs.current.values()], box, from, to, Date.now()) : [];
    if (activeLogs.current.has(sourceId)) touched.push(sourceId);
    let changed = false;
    for (const id of touched) if (!sweptIds.current.has(id)) { sweptIds.current.add(id); changed = true; }
    if (changed) setSweepHighlight([...sweptIds.current]);
  }, []);
  const finishSweep = useCallback((sourceId: number, from: SweepPoint, to: SweepPoint) => {
    extendSweep(sourceId, from, to);
    const ids = [...sweptIds.current];
    const storage = storageRef.current;
    if (!storage) loadLogs(ids);
    else storage.measureInWindow((x, y, width, height) => {
      if (to.x >= x - 10 && to.x <= x + width + 10 && to.y >= y - 10 && to.y <= y + height + 10) collectDirect(sourceId);
      else loadLogs(ids);
    });
    sweptIds.current.clear();
    setSweepHighlight([]);
  }, [collectDirect, extendSweep, loadLogs]);
  const cancelSweep = useCallback(() => {
    sweptIds.current.clear();
    setSweepHighlight([]);
  }, []);
  const bankTrolley = () => {
    if (draggingLogs.current.size > 0 || progressRef.current.trolleyWood <= 0 || progressRef.current.trolleyTrip) return;
    stopHoldingTree();
    if (serverRef.current?.snapshot) {
      if (serverRef.current.command({ type: 'collectTrolley' })) completeTutorial('trolley');
      return;
    }
    const next = dispatchTrolley(progressRef.current, Date.now());
    if (next === progressRef.current || !commit(next)) return;
    completeTutorial('trolley');
    setMessage({ key: 'trolleyDeparted' });
  };

  const rest = () => {
    if (__DEV__ && !online && commit(testRest(progressRef.current, Date.now()))) setMessage({ key: 'rested' });
  };
  const handleFatiguePotion = () => {
    if (fatiguePotionCount(progressRef.current) <= 0 || progressRef.current.fatigue <= 0) return;
    stopHoldingTree();
    completeTutorial('potion');
    Alert.alert(t('fatiguePotion'), t('fatiguePotionConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('fatiguePotionUse'), onPress: () => {
        if (serverRef.current?.snapshot) {
          serverRef.current.command({ type: 'useFatiguePotion' });
          return;
        }
        const next = useFatiguePotion(progressRef.current);
        if (next !== progressRef.current && commit(next)) setMessage({ key: 'fatiguePotionDone' });
      } },
    ]);
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
      void server!.record();
      return;
    }
    Alert.alert(t('achievement'), language === 'ko' ? '기념 기록은 서버 저장에서만 이용할 수 있어요. 로컬 연습과 무료 성장 보상은 계속 진행할 수 있어요.' : 'Records are available in server saves only. Local practice and free growth rewards remain available.');
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
      <Image source={require('./assets/forest/background.png')} style={styles.screenBackground} resizeMode="cover" />
      <View pointerEvents="none" style={styles.hudScrim} />
      <View pointerEvents="none" style={styles.hudScrimFadeOne} />
      <View pointerEvents="none" style={styles.hudScrimFadeTwo} />
      <View pointerEvents="none" style={styles.hudScrimFadeThree} />
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
        <ResourceHud label={t('wood')} icon="🪵" value={hudAmount(wood)} exact={wood.toLocaleString(language)} color="#A96842" />
        <ResourceHud label={t('coins')} icon="●" value={hudAmount(progress.coins)} exact={progress.coins.toLocaleString(language)} color="#F9DA3F" />
        <View accessible accessibilityLabel={`${t('axe')} Lv. ${progress.axeLevel}, ${axePower}`} style={styles.attackHud}>
          <View style={[styles.hudIcon, { backgroundColor: '#E74751' }]}><Text style={styles.attackHudIcon}>🪓</Text></View>
          <View style={styles.attackHudText}><Text style={styles.attackHudLevel}>Lv. {progress.axeLevel}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={styles.attackHudPower}>{axePower}</Text></View>
        </View>
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
        <View style={[styles.progressLabelRow, styles.fatigueRow, tutorialStep === 'fatigue' && styles.tutorialTargetGlow]}>
          <InfoLabel label={t('fatigue')} accessibilityLabel={t('infoAbout', t('fatigue'))}
            onPress={() => { if (tutorialStep === 'fatigue') completeTutorial('fatigue'); Alert.alert(t('fatigue'), t('fatigueInfo')); }} />
          <Text style={styles.progressValue}>{fatigue}%</Text>
        </View>
        <Meter value={fatigue} max={100} color={fatigue > 65 ? '#EC7A67' : '#EFC75E'} />
        <View style={styles.forestInfoPanel}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
            style={[styles.forestInfoText, fatigue >= 100 && styles.fatigueFullText]}>{fatigue >= 100 ? t('fatigueFull', countdown) : fatigue > 0 ? t('recoveryIn', countdown) : t('fullyRested')}</Text>
          <Text style={styles.forestInfoText}>{blessingMultiplier(progress, online ? server!.now : now) === 2
            ? `${language === 'ko' ? '✨ 숲의 축복 · 목재·코인 ×2' : '✨ Blessing · wood/coins ×2'} · ${Math.ceil(((progress.farm?.blessingUntil ?? 0) - (online ? server!.now : now)) / 60_000)}${language === 'ko' ? '분' : 'm'}`
            : t('treeBonus', progress.treeLevel)}</Text>
        </View>
      </View>

      <View ref={forestRef} collapsable={false} style={styles.forest}
        onLayout={event => {
          setForestWidth(event.nativeEvent.layout.width);
          forestRef.current?.measureInWindow((x, y, width, height) => { forestBounds.current = { x, y, width, height }; });
        }}>
        {progress.treeLevel >= 101 && <Text pointerEvents="none" style={{ position: 'absolute', top: 8, alignSelf: 'center', color: '#CFB6F2', fontWeight: '800' }}>{t('secondForest')}</Text>}
        <View style={styles.forestShortcutRail}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('openAxe')}
            onPress={() => { if (tutorialStep === 'axe') completeTutorial('axe'); setPanel('axe'); }} style={({ pressed }) => [styles.forestShortcut, tutorialStep === 'axe' && styles.tutorialTargetGlow, pressed && styles.forestShortcutPressed]}>
            <View pointerEvents="none" style={styles.forestAxeIcon}><View style={styles.forestAxeIconScaled}><AxeArt crowned={progress.wardenRewardsClaimed === 3} commemorative={progress.axeSkin === 'firstRecord'} pioneer={progress.axeSkin === 'pioneer'} warden={progress.axeSkin === 'warden'} recovery={progress.axeSkin === 'recovery'} /></View></View>
            {axeUpgradeReady(progress) && <View pointerEvents="none" style={styles.forestShortcutDot} />}
          </Pressable>
          {shortcutUnlocks.gems && <Pressable accessibilityRole="button" accessibilityLabel={t('gemFusion')}
            onPress={() => { if (tutorialStep === 'gem') completeTutorial('gem'); setPanel('gems'); }}
            style={({ pressed }) => [styles.forestShortcut, tutorialStep === 'gem' && styles.tutorialTargetGlow, pressed && styles.forestShortcutPressed]}>
            <GemArt tier="high" size={37} />
          </Pressable>}
          {shortcutUnlocks.map && <Pressable sound="map" accessibilityRole="button" accessibilityLabel={language === 'ko' ? '숲 지도 열기' : 'Open forest map'}
            onPress={() => { if (tutorialStep === 'map') completeTutorial('map'); setPanel('map'); }}
            style={({ pressed }) => [styles.forestShortcut, tutorialStep === 'map' && styles.tutorialTargetGlow, pressed && styles.forestShortcutPressed]}>
            <Text style={styles.forestMapIcon}>🗺️</Text>
          </Pressable>}
          {shortcutUnlocks.pet && <Pressable accessibilityRole="button" accessibilityLabel={language === 'ko' ? '다람쥐 펫 탐험 열기' : 'Open squirrel expeditions'}
            onPress={() => { if (tutorialStep === 'pet') completeTutorial('pet'); setPanel('pet'); }}
            style={({ pressed }) => [styles.forestShortcut, tutorialStep === 'pet' && styles.tutorialTargetGlow, pressed && styles.forestShortcutPressed]}>
            <Image source={require('./assets/pets/squirrel-v1.png')} style={styles.forestPetIcon} resizeMode="contain" />
            {squirrelAttention && <View pointerEvents="none" style={styles.forestPetDot} />}
            {squirrelAway && <Text pointerEvents="none" style={styles.forestPetTimer}>{squirrelTimeLeft(squirrel!.trip!.returnsAt, server!.now)}</Text>}
          </Pressable>}
        </View>
        <View pointerEvents="box-none" style={styles.forestCharacter}>
          <ForesterSprite motion={swing} skin={progress.axeSkin}
            crowned={progress.wardenRewardsClaimed === 3} size={155} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('tutorialCharacter')} hitSlop={3}
            onPress={() => { if (tutorialStep === 'character') completeTutorial('character'); setPanel('character'); }}
            style={[styles.characterFaceTarget, tutorialStep === 'character' && styles.characterFaceHint]} />
        </View>
        {treeHp > 0 && isHolding && <Animated.View pointerEvents="none" style={[styles.holdGlow, {
          opacity: holdPulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.48] }),
          transform: [{ scale: holdPulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.18] }) }],
        }]} />}
        {treeHp > 0 ? <>
          <Animated.View pointerEvents="none" style={[styles.treeVisual, { transform: [{ translateX: shake }] }]}>
            <Image source={require('./assets/forest/tree.png')} style={styles.treeSprite} resizeMode="contain" />
            {boss && <View style={styles.bossEyes}><View style={styles.bossEye} /><View style={styles.bossEye} /></View>}
            <Text style={styles.hitHint}>{t(mode === 'collect' ? 'collecting' : firstRecordBonusActive(progress) ? 'holdFast' : 'tap')}</Text>
          </Animated.View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('chop')}
            accessibilityHint={t(firstRecordBonusActive(progress) ? 'holdFast' : 'tap')}
            disabled={mode === 'collect'} delayLongPress={HOLD_TO_CHOP_MS}
            onLongPress={startHoldingTree} onPressOut={stopHoldingTree}
            style={styles.treeHitTarget} />
        </> : <View style={styles.felledTree}>
          <View style={styles.stump}><View style={styles.stumpRing} /></View>
          <Pressable accessibilityRole="button" onPress={() => { if (tutorialStep === 'tree') completeTutorial('tree'); setPanel('tree'); }} style={[styles.upgradeMarker, tutorialStep === 'tree' && styles.tutorialTargetGlow]}>
            <Text style={styles.markerText}>{t(progress.treeLevel >= TREE_MAX ? 'endingTitle' : 'treeUpgradeMarker')}</Text>
          </Pressable>
        </View>}
        {treeHp > 0 && <Animated.View pointerEvents="none" style={[styles.chopImpact, {
          opacity: impact,
          transform: [{ scale: impact.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1.2] }) }],
        }]}>
          <View style={styles.chopImpactCore} />
          <View style={[styles.chopImpactRay, { transform: [{ rotate: '20deg' }] }]} />
          <View style={[styles.chopImpactRay, { transform: [{ rotate: '75deg' }] }]} />
          <View style={[styles.chopImpactRay, { transform: [{ rotate: '135deg' }] }]} />
        </Animated.View>}
        {damagePopups.map((popup) => (
          <FloatingDamage key={popup.id} popup={popup} />
        ))}
        {squirrelHome && <Pressable accessibilityRole="button" accessibilityLabel={language === 'ko' ? '돌아온 다람쥐 · 펫 탐험 열기' : 'Returned squirrel · open expeditions'}
          onPress={() => { if (tutorialStep === 'pet') completeTutorial('pet'); setPanel('pet'); }} style={styles.forestReturnedPet}>
          {squirrel?.trip && <Text pointerEvents="none" style={styles.forestReturnedBubble}>{language === 'ko' ? '돌아왔어요!' : 'I’m back!'}</Text>}
          <Image source={require('./assets/pets/squirrel-v1.png')} style={styles.forestReturnedPetArt} resizeMode="contain" />
        </Pressable>}
        {autoPickupNotice && <Text pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', bottom: 12, alignSelf: 'center', color: '#FFE19C', backgroundColor: '#153936', borderRadius: 12, padding: 8, fontWeight: '800' }}>{t('autoCollected', autoPickupNotice.value)}</Text>}
        <View ref={storageRef} collapsable={false} style={[styles.storageTarget, tutorialStep === 'storage' && styles.tutorialTargetGlow]}>
          <Image source={require('./assets/forest/storage-v1.png')} style={styles.storageArt} resizeMode="contain" />
          <Text pointerEvents="none" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.storageLabel}>{t('storage')}</Text>
        </View>
        <Animated.View style={[styles.trolleyTarget, { transform: [{ translateX: trolleyOffset }] }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('trolleyCargo', `${progress.trolleyWood.toLocaleString(language)} / ${trolleyCapacity(progress).toLocaleString(language)}`)} · ${t('trolleyBank')}`}
            disabled={progress.trolleyWood <= 0 || !!progress.trolleyTrip || mode === 'collect' || (online && !server!.trolleySupported)} onPress={bankTrolley}
            style={({ pressed }) => [styles.trolleyButton, tutorialStep === 'trolley' && styles.tutorialTargetGlow, pressed && { opacity: 0.75 }]}>
            <View pointerEvents="none" style={styles.trolleyArt}>
              <View style={styles.trolleyGround} />
              <Image source={TROLLEY_SPRITES[trolleyFill]} style={styles.trolleySprite} resizeMode="contain" />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.trolleyCount}>{online && !server!.trolleySupported
              ? (language === 'ko' ? '서버 업데이트 필요' : 'Server update needed')
              : progress.trolleyTrip ? t('trolleyMoving') : t('trolleyCargo', `${hudAmount(progress.trolleyWood)} / ${hudAmount(trolleyCapacity(progress))}`)}</Text>
            {progress.trolleyWood > 0 && !progress.trolleyTrip && <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.trolleyHint}>{t('trolleyBank')}</Text>}
          </Pressable>
        </Animated.View>
        {logs.map((log) => (
          <DraggableLog key={log.id} log={log} label={t('pickup', log.value)} highlighted={sweepHighlight.includes(log.id)}
            onSweepStart={beginSweep} onSweepMove={extendSweep} onSweepEnd={finishSweep} onSweepCancel={cancelSweep} onDraggingChange={syncDragMode} />
        ))}
        {!!gameplayNotice && <Text pointerEvents="none" accessibilityLiveRegion="polite" style={styles.gameplayToast}>{gameplayNotice}</Text>}
        {tutorialStep && tutorialStep !== 'potion' && <TutorialNudge step={tutorialStep} language={language} onDismiss={() => completeTutorial(tutorialStep)} />}
      </View>

      <View style={styles.actions}>
        {__DEV__ && !online && <Pressable onPress={rest} style={styles.restButton}>
          <Text style={styles.restIcon}>♨</Text>
          <Text style={styles.restText}>{t('testRest')}</Text>
        </Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel={t('fatiguePotionCount', fatiguePotionCount(progress))}
          accessibilityState={{ disabled: loaded.error || fatiguePotionCount(progress) <= 0 || progress.fatigue <= 0 || (online && (server!.busy || server!.pending || server!.queued > 0)) }}
          disabled={loaded.error || fatiguePotionCount(progress) <= 0 || progress.fatigue <= 0 || (online && (server!.busy || server!.pending || server!.queued > 0))}
          onPress={handleFatiguePotion} style={[styles.potionButton, (fatiguePotionCount(progress) <= 0 || progress.fatigue <= 0 || (online && (server!.busy || server!.pending || server!.queued > 0))) && styles.potionButtonInactive, tutorialStep === 'potion' && styles.tutorialTargetGlow]}>
          <Text style={styles.potionIcon}>🧪</Text>
          <Text style={styles.potionLabel}>{t('fatiguePotionShort')}</Text>
          <View pointerEvents="none" style={[styles.potionCountBadge, fatiguePotionCount(progress) === 0 && styles.potionCountEmpty]}>
            <Text style={[styles.potionCountText, fatiguePotionCount(progress) === 0 && styles.potionCountEmptyText]}>{fatiguePotionCount(progress)}</Text>
          </View>
        </Pressable>
        {shortcutLabel ? <Pressable accessibilityRole="button" accessibilityLabel={shortcutLabel} onPress={() => setPanel('quests')} style={styles.cart}>
          <Text style={styles.cartIcon}>{shortcut?.key === 'nextQuest' ? '📜' : '🪵'}</Text>
          <Text numberOfLines={2} style={[styles.cartText, { flexShrink: 1 }]}>{shortcutLabel}</Text>
        </Pressable> : <View style={styles.cart}>
          <Text style={styles.cartIcon}>🪵</Text>
          <Text style={styles.cartText}>{t('cart')}</Text>
        </View>}
        {tutorialStep === 'potion' && <TutorialNudge step="potion" language={language} targetLeft={__DEV__ && !online ? 88 : 0} onDismiss={() => completeTutorial('potion')} />}
      </View>
      </View>
      <Modal visible={panel !== null && panel !== 'map' && panel !== 'farm' && panel !== 'community' && panel !== 'worldBoss'} transparent animationType="fade" onRequestClose={() => setPanel(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={t('close')} onPress={() => setPanel(null)} />
          <View style={styles.modalCard} accessibilityViewIsModal>
            <View style={styles.panelHeader}>
              <Text style={styles.statValue}>{panel === 'pet' ? language === 'ko' ? '다람쥐 탐험' : 'Squirrel expedition' : t(panel === 'quests' ? 'questTitle' : panel === 'gems' ? 'gemFusion' : panel === 'character' || panel === 'axe' ? 'character' : panel === 'tree' ? 'tree' : 'menu')}</Text>
              <Pressable accessibilityRole="button" onPress={() => setPanel(null)} style={styles.languageButton}><Text style={styles.walletText}>{t('close')}</Text></Pressable>
            </View>
            <ScrollView key={panel} ref={panelScroll} contentContainerStyle={styles.panelContent}>
      {online && !!server!.notice && (panel === 'quests' || panel === 'gems' || panel === 'character' || panel === 'axe' || (panel === 'pet' && /다람쥐|squirrel/i.test(server!.notice))) &&
        <Text accessibilityLiveRegion="polite" style={styles.progressLabel}>{server!.notice}</Text>}
      {panel === 'menu' && <View style={styles.achievement}>
        <AudioSettingsControls language={language} />
        {server?.controls}
        <Pressable accessibilityRole="button" onPress={() => setPanel('guide')} style={styles.languageButton}><Text style={styles.statValue}>{language === 'ko' ? '플레이 가이드' : 'How to play'}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={replayTutorial} style={styles.languageButton}><Text style={styles.statValue}>{t('tutorialReplay')}</Text></Pressable>
        {__DEV__ && !online && devWalletSkip && <Pressable accessibilityRole="button" onPress={() => {
          try { saveDevWalletSkip(false); setDevWalletSkip(false); }
          catch { Alert.alert(language === 'ko' ? '저장 실패' : 'Save failed'); }
        }} style={styles.languageButton}><Text style={styles.statValue}>{language === 'ko' ? '개발용 지갑 퀘스트 건너뛰기 해제' : 'Undo development wallet quest skip'}</Text></Pressable>}
        <Pressable onPress={() => setPanel('quests')} style={styles.languageButton}><Text style={styles.statValue}>{t('questTitle')}</Text></Pressable>
        <Pressable onPress={() => setPanel('character')} style={styles.languageButton}><Text style={styles.statValue}>{t('character')}</Text></Pressable>
        <View style={styles.languageRow}>
          <Text style={styles.progressLabel}>{t('language')}</Text>
          {(['ko', 'en'] as const).map((locale) => <Pressable key={locale} onPress={() => setLanguage(locale)}
            style={[styles.languageButton, language === locale && styles.languageSelected]}><Text style={styles.walletText}>{locale === 'ko' ? '한국어' : 'English'}</Text></Pressable>)}
        </View>
      </View>}
      {panel === 'guide' && <PlayGuide progress={progress} saveMode={online ? 'server' : server ? 'practice' : 'local'} onQuests={() => setPanel('quests')} onGems={() => setPanel('gems')} />}
      {panel === 'pet' && <SquirrelExpedition pet={squirrel} community={online ? server!.snapshot?.community : undefined}
        now={online ? server!.now : now} treeLevel={progress.treeLevel} language={language}
        command={online ? server!.command : () => false} locked={!online || server!.busy || server!.pending || server!.queued > 0} />}
      {panel === 'quests' && <View>
      <View style={styles.achievement}>
        <Text accessibilityLiveRegion="polite" style={styles.statValue}>{t(visibleQuests.chapter)}</Text>
        {visibleQuests.active < 0 && <Text style={styles.progressLabel}>{t('questsFinishedHint')}</Text>}
        {trailQuest && <View style={[styles.questRow, styles.questActive]}>
          <Text style={styles.walletText}>{trailTitle}</Text>
          <Text style={styles.progressLabel}>{t('tree')} {Math.min(progress.treeLevel, trailQuest.tree)}/{trailQuest.tree}</Text>
          <Text style={styles.progressLabel}>{trailReward}</Text>
          {trailQuest.ready && <Text style={styles.progressLabel}>{t('claimReady')}</Text>}
          <Pressable accessibilityRole="button" disabled={loaded.error || !trailQuest.ready || (online && (server!.busy || server!.pending || server!.queued > 0))}
            style={[styles.languageButton, (!trailQuest.ready || (online && (server!.busy || server!.pending || server!.queued > 0))) && styles.disabledButton]}
            onPress={() => {
              if (online) { server!.command({ type: 'claimForestTrail', stage: trailQuest.index }); return; }
              const next = claimForestTrail(progressRef.current, trailQuest.index);
              if (next !== progressRef.current && commit(next)) Alert.alert(t('rewardClaimed'), trailReward);
            }}><Text style={styles.walletText}>{t('claimReward')}</Text></Pressable>
        </View>}
        {!trailQuest && visibleQuests.entries.filter(({ index }) => index !== 5).map(({ key, index }) => (
          <View key={key} style={[styles.questRow, quests[index] === 'active' && styles.questActive]}>
            <Text style={styles.walletText}>{index >= 6 ? index : index + 1}. {t(key)}</Text>
            <Text style={styles.progressLabel}>{t(quests[index])}{index === 0 ? ` · ${Math.min(progress.harvested, 20)}/20` : ''}</Text>
            {index >= 13 && <>
              <Text style={styles.progressLabel}>{t((['rewardLowGem', 'rewardCoins300', 'rewardMediumGem', 'rewardPioneer', 'rewardCoins1000', 'rewardHighGem'] as const)[index - 13])}</Text>
              <Text style={styles.progressLabel}>{index === 13 ? `${t('tree')} ${Math.min(progress.treeLevel, 15)}/15` :
                index === 14 ? `${t('slot', 2)} · ${t(progress.slots[1] ? 'skinEquipped' : 'emptySlot')}` :
                index === 15 ? `${t('tree')} ${Math.min(progress.treeLevel, 20)}/20 · ${t('axe')} ${Math.min(highestAxeLevel(progress), 25)}/25` :
                index === 16 ? `${t('tree')} ${Math.min(progress.treeLevel, 50)}/50 · ${t('character')} ${Math.min(level, 10)}/10` :
                index === 17 ? `${t('pioneerAxe')} ${Math.min(axeLevelFor(progress, 'pioneer'), 10)}/10 · ${t(progress.axeSkin === 'pioneer' ? 'skinEquipped' : 'equipSkin')}` :
                `${t('tree')} ${Math.min(progress.treeLevel, 100)}/100 · ${t('character')} ${Math.min(level, 20)}/20`}</Text>
              {adventureReady(progress) && <Text style={styles.progressLabel}>{t('claimReady')}</Text>}
              <Pressable accessibilityRole="button" disabled={loaded.error || !adventureReady(progress) || (online && (server!.busy || server!.pending || server!.queued > 0))} style={[styles.languageButton, (!adventureReady(progress) || (online && (server!.busy || server!.pending || server!.queued > 0))) && styles.disabledButton]} onPress={() => {
                if (progressRef.current.adventureClaimed !== index - 13) return;
                if (online) { server!.command({ type: 'claimAdventure', stage: index - 13 }); return; }
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
            {index === 10 && quests[index] === 'active' && <Pressable accessibilityRole="button" disabled={loaded.error || (online && (server!.busy || server!.pending || server!.queued > 0))} style={styles.languageButton} onPress={() => {
              if (online) { server!.command({ type: 'claimGrowthReward' }); return; }
              const next = claimGrowthReward(progressRef.current);
              if (next !== progressRef.current && commit(next)) Alert.alert(t('rewardClaimed'), t('gemReceived'));
            }}><Text style={styles.walletText}>{t('claimReward')}</Text></Pressable>}
            {(index === 11 || index === 12) && quests[index] === 'active' && <>
              <Text style={styles.progressLabel}>{t('gemQuestHint')}</Text>
              <Pressable accessibilityRole="button" style={styles.languageButton} onPress={() => setPanel('character')}><Text style={styles.walletText}>{t('character')} ›</Text></Pressable>
            </>}
            {quests[index] === 'active' && index === 1 && <Pressable onPress={handleWalletConnect} disabled={isConnectingWallet || (server?.busy ?? false)} style={styles.languageButton}><Text style={styles.walletText}>{t(server && !online ? 'connectServerSave' : isConnectingWallet ? 'connecting' : 'wallet')}</Text></Pressable>}
            {__DEV__ && !online && quests[index] === 'active' && index === 1 && <Pressable accessibilityRole="button"
              onPress={() => {
                try { saveDevWalletSkip(true); setDevWalletSkip(true); }
                catch { Alert.alert(language === 'ko' ? '저장 실패' : 'Save failed', language === 'ko' ? '개발용 건너뛰기를 저장하지 못했어요.' : 'Could not save the development-only skip.'); }
              }} style={styles.languageButton}>
              <Text style={styles.walletText}>{language === 'ko' ? '개발 테스트: 지갑 퀘스트만 건너뛰기' : 'Development test: skip wallet quest only'}</Text>
            </Pressable>}
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
        {quests[4] === 'complete' && <View style={styles.questRow}>
          <Text style={styles.walletText}>{language === 'ko' ? '첫 성장 기념 기록 · 선택' : 'First growth record · Optional'}</Text>
          <Text style={styles.progressLabel}>{language === 'ko' ? '지갑 연결·성장 보상은 무료예요. 원할 때만 Mainnet에 공개 Memo를 남길 수 있어요. 실제 SOL 수수료가 들며, 기록해도 추가 능력치나 재화는 지급하지 않아요.' : 'Wallet login and growth rewards are free. Optionally publish a public Memo on Mainnet. A real SOL network fee applies; recording grants no extra stats or currency.'}</Text>
          {progress.mainnetReceipt?.status === 'confirmed' ? <>
            <Text style={styles.walletText}>{language === 'ko' ? '✦ Mainnet 기념 기록 완료' : '✦ Mainnet milestone recorded'}</Text>
            <Pressable accessibilityRole="button" style={styles.languageButton} onPress={() => Linking.openURL(`https://explorer.solana.com/tx/${progress.mainnetReceipt!.signature}`).catch(() => setMessage({ key: 'explorerError' }))}><Text style={styles.walletText}>{t('explorer')}</Text></Pressable>
          </> : <>
            <Pressable accessibilityRole="button" disabled={!online || server!.busy || !!server!.pending || server!.queued > 0} onPress={handleRecord} style={[styles.languageButton, !online && styles.disabledButton]}><Text style={styles.walletText}>{language === 'ko' ? 'Mainnet 기록 확인 / 남기기' : 'Review / record on Mainnet'}</Text></Pressable>
            {!online && <Text style={styles.progressLabel}>{language === 'ko' ? '서버 저장에 연결하면 이용할 수 있어요. 연습 진행은 업로드되지 않아요.' : 'Connect a server save to record. Practice progress is not uploaded.'}</Text>}
            <Pressable accessibilityRole="button" style={styles.languageButton} onPress={() => setPanel(null)}><Text style={styles.walletText}>{language === 'ko' ? '나중에 · 계속 플레이' : 'Not now · Keep playing'}</Text></Pressable>
          </>}
        </View>}
        {quests[12] === 'complete' && !progress.woodGemDraws && <View style={[styles.questRow, styles.questActive]}>
          <Text style={styles.walletText}>{t('qWoodGemDraw')}</Text>
          <Text style={styles.progressLabel}>0/1 · {t('woodGemCost', WOOD_GEM_COST.toLocaleString())}</Text>
          <Text style={styles.progressLabel}>{t('qWoodGemDrawHint')}</Text>
          <Pressable accessibilityRole="button" onPress={() => setPanel('gems')} style={styles.languageButton}>
            <Text style={styles.walletText}>{t('gems')} ›</Text>
          </Pressable>
        </View>}
        {signature && <Pressable style={styles.languageButton} onPress={() => {
          Linking.openURL(`https://explorer.solana.com/tx/${signature}?cluster=devnet`).catch(() => setMessage({ key: 'explorerError' }));
        }}><Text style={styles.walletText}>{language === 'ko' ? '이전 Devnet 기록 보기' : 'View previous Devnet record'}</Text></Pressable>}
        {progress.receipt?.status === 'pending' && <Pressable disabled={recording} onPress={handleCheck} style={styles.languageButton}><Text style={styles.walletText}>{t(recording ? 'recording' : 'checkRecord')}</Text></Pressable>}
      </View>
      {__DEV__ && !online && devWalletSkip && <Text style={styles.progressLabel}>
        {language === 'ko' ? '개발 테스트: 지갑 퀘스트 화면만 건너뜀 · 실제 연결/서버 저장/기록은 미완료' : 'Development test: wallet quest display skipped only · wallet, server save and record are incomplete'}
      </Text>}
      {progress.treeLevel >= 101 && <WardenQuests progress={progress} commit={commit}
        serverCommand={online ? server!.command : undefined} serverLocked={online && (server!.busy || server!.pending || server!.queued > 0)} />}
      {online && progress.walletCompleted && server!.snapshot?.walletCoinRewardClaimed === false && <View style={[styles.questRow, styles.questActive]}>
        <Text style={styles.walletText}>{t('walletCoinLegacy')}</Text>
        <Text style={styles.progressLabel}>{t('walletCoinReward')}</Text>
        <Pressable accessibilityRole="button" disabled={server!.busy || server!.pending || server!.queued > 0}
          onPress={() => server!.command({ type: 'acknowledgeWallet' })}
          style={[styles.languageButton, (server!.busy || server!.pending || server!.queued > 0) && styles.disabledButton]}>
          <Text style={styles.walletText}>{t('walletCoinClaim')}</Text>
        </Pressable>
      </View>}
      </View>}
      {(panel === 'character' || panel === 'axe' || panel === 'gems') && <CharacterPanel key={panel} initialPage={panel === 'gems' ? 'gems' : panel === 'axe' ? 'axe' : 'overview'} progress={progress} commit={commit} onSkin={handleSkin}
        serverCommand={online ? server!.command : undefined} serverLocked={online && (server!.busy || server!.pending || server!.queued > 0)}
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
      <Modal visible={panel === 'map' || panel === 'farm' || panel === 'community' || panel === 'worldBoss'} animationType="slide"
        onRequestClose={() => setPanel(panel === 'map' ? null : 'map')}>
        <SafeAreaView style={styles.mapSurface}>
          <StatusBar style="light" />
          {panel === 'map' && <Image source={require('./assets/forest/background.png')} resizeMode="cover" style={StyleSheet.absoluteFill} />}
          {panel === 'map' && <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.mapShade]} />}
          <View style={styles.mapHeader}>
            <Pressable accessibilityRole="button" onPress={() => setPanel(panel === 'map' ? null : 'map')} style={styles.mapBack}>
              <Text style={styles.mapBackText}>{panel !== 'map' ? language === 'ko' ? '‹ 지도' : '‹ Map' : language === 'ko' ? '‹ 숲' : '‹ Forest'}</Text>
            </Pressable>
            <Text style={styles.mapTitle}>{panel === 'farm' ? language === 'ko' ? '묘목 농장' : 'Sapling farm' : panel === 'community' ? language === 'ko' ? '공동 숲' : 'Community forest' : panel === 'worldBoss' ? language === 'ko' ? '월드보스 숲' : 'World boss forest' : language === 'ko' ? '숲 지도' : 'Forest map'}</Text>
            <View style={{ width: 64 }} />
          </View>
          {panel === 'map' ? <ScrollView contentContainerStyle={styles.mapContent}>
            <ForestMap language={language} farmReady={progress.treeLevel >= FARM_UNLOCK_LEVEL} communityReady={online && !!server!.snapshot?.community} bossReady={online && !!server!.snapshot?.worldBoss}
              onPersonal={() => setPanel(null)} onFarm={() => setPanel('farm')} onCommunity={() => { setPanel('community'); server!.refresh(); }}
              onWorldBoss={() => { setPanel('worldBoss'); server!.refresh(); }} />
          </ScrollView> : panel === 'farm' ? <FarmWorld progress={progress} now={online ? server!.now : now}
            locked={online && (server!.busy || server!.pending || server!.queued > 0)}
            onSeed={plot => {
              if (online) { server!.command({ type: 'plantFarmSeed', plot }); return; }
              commit(plantFarmSeed(progressRef.current, Date.now(), plot));
            }} onBless={() => {
              if (online) { server!.command({ type: 'activateBlessing' }); return; }
              commit(activateBlessing(progressRef.current, Date.now()));
            }}
            onStart={plot => {
              if (online) { server!.command({ type: 'startFarmPuzzle', plot }); return; }
              commit(startFarmPuzzle(progressRef.current, Date.now(), Math.floor(Math.random() * 2_147_483_648), plot));
            }} onPlant={rotations => {
              if (online) { server!.command({ type: 'finishFarmPuzzle', rotations }); return; }
              commit(finishFarmPuzzle(progressRef.current, Date.now(), rotations));
            }} onClaim={plot => {
              if (online) { server!.command({ type: 'claimFarmTree', plot }); return; }
              commit(claimFarmTree(progressRef.current, Date.now(), plot));
            }} /> : panel === 'community' && online && server!.snapshot?.community ? <CommunityWorld state={server!.snapshot.community}
            pet={server!.snapshot.squirrel} now={server!.now} treeLevel={progress.treeLevel} language={language}
            command={server!.command} locked={server!.busy || server!.pending || server!.queued > 0} />
            : panel === 'worldBoss' && online && server!.snapshot?.worldBoss ? <WorldBossWorld state={server!.snapshot.worldBoss}
              progress={progress} language={language} command={server!.command} locked={server!.busy || server!.pending || server!.queued > 0}
              lastDamage={server!.snapshot.lastBossDamage} /> : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function AxeArt({ commemorative, pioneer = false, warden = false, recovery = false, crowned = false, mirror = false }: { commemorative: boolean; pioneer?: boolean; warden?: boolean; recovery?: boolean; crowned?: boolean; mirror?: boolean }) {
  return <View style={[styles.axeArt, mirror && { transform: [{ scaleX: -1 }] }]}>
    <View style={[styles.axeHandle, commemorative && { backgroundColor: '#6A49A8' }, pioneer && { backgroundColor: '#377C85' }, warden && { backgroundColor: '#234A63' }]}>
      <View style={[styles.axeBlade, mirror && { left: -40 }, commemorative && { backgroundColor: '#9945FF', borderLeftColor: '#14F195' }, pioneer && { backgroundColor: '#DCAA54', borderLeftColor: '#FFF0BC' }, warden && { backgroundColor: '#69C9ED', borderLeftColor: '#DBF7FF', width: 52 }, recovery && { backgroundColor: '#80BC78', borderLeftColor: '#E5F9B1' }]}>
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

function ResourceHud({ label, icon, value, exact, color }: { label: string; icon: string; value: string; exact: string; color: string }) {
  return <View accessible accessibilityLabel={`${label} ${exact}`} style={styles.resourceHud}>
    <View style={[styles.hudIcon, { backgroundColor: color }]}><Text style={icon === '●' ? styles.coinHudIcon : styles.woodHudIcon}>{icon}</Text></View>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.hudAmount}>{value}</Text>
  </View>;
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

const DraggableLog = memo(function DraggableLog({ log, label, highlighted, onSweepStart, onSweepMove, onSweepEnd, onSweepCancel, onDraggingChange }: {
  log: Log;
  label: string;
  highlighted: boolean;
  onSweepStart: () => void;
  onSweepMove: (id: number, from: SweepPoint, to: SweepPoint) => void;
  onSweepEnd: (id: number, from: SweepPoint, to: SweepPoint) => void;
  onSweepCancel: () => void;
  onDraggingChange: (id: number, dragging: boolean) => void;
}) {
  const pan = useRef(new Animated.ValueXY()).current;
  const fall = useRef(new Animated.Value(-65)).current;
  const life = useRef(new Animated.Value(1)).current;
  const lastPoint = useRef<SweepPoint>({ x: 0, y: 0 });
  const handlers = useRef({ onSweepStart, onSweepMove, onSweepEnd, onSweepCancel, onDraggingChange });
  handlers.current = { onSweepStart, onSweepMove, onSweepEnd, onSweepCancel, onDraggingChange };
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
    onPanResponderGrant: (event, gesture) => {
      pan.stopAnimation();
      pan.setValue({ x: 0, y: 0 });
      lastPoint.current = { x: event.nativeEvent.pageX ?? gesture.x0, y: event.nativeEvent.pageY ?? gesture.y0 };
      handlers.current.onSweepStart();
      handlers.current.onDraggingChange(log.id, true);
    },
    onPanResponderMove: (_, gesture) => {
      pan.setValue({ x: gesture.dx, y: gesture.dy });
      const next = { x: gesture.moveX, y: gesture.moveY };
      if (Math.hypot(gesture.dx, gesture.dy) > 12) handlers.current.onSweepMove(log.id, lastPoint.current, next);
      lastPoint.current = next;
    },
    onPanResponderRelease: (_, gesture) => {
      handlers.current.onDraggingChange(log.id, false);
      if (Math.hypot(gesture.dx, gesture.dy) > 12) handlers.current.onSweepEnd(log.id, lastPoint.current, { x: gesture.moveX, y: gesture.moveY });
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: () => {
      handlers.current.onDraggingChange(log.id, false);
      handlers.current.onSweepCancel();
      pan.setValue({ x: 0, y: 0 });
    },
  })).current;
  return <Animated.View {...responder.panHandlers} accessibilityLabel={label}
    style={[styles.log, highlighted && styles.logSwept, { left: `${log.left}%`, bottom: log.bottom, transform: pan.getTranslateTransform() }]}>
    <Animated.View pointerEvents="none" style={{ alignItems: 'center', transform: [{ translateY: fall }], opacity: life.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }) }}>
      <Text style={styles.logEmoji}>🪵</Text><Text style={[styles.logValue, log.bonusWood > 0 && { backgroundColor: '#735521', color: '#FFF0A0' }]}>{log.bonusWood > 0 ? '✦ ' : ''}+{log.value}</Text>
      <Animated.View style={[styles.logTimer, { transform: [{ scaleX: life }] }]} />
    </Animated.View>
  </Animated.View>;
});

const styles = StyleSheet.create({
  tutorialTargetGlow: { borderColor: '#FFE494', borderWidth: 2, borderRadius: 16, backgroundColor: '#FFE4941A' },
  axeArt: { width: 60, height: 95, alignItems: 'center', justifyContent: 'flex-end' },
  axeHandle: { width: 10, height: 80, borderRadius: 5, backgroundColor: '#BE8558', transform: [{ rotate: '20deg' }], marginBottom: 4 },
  axeBlade: { position: 'absolute', top: 0, left: -20, width: 44, height: 30, borderRadius: 7, backgroundColor: '#C3D9D3', borderLeftWidth: 7, borderLeftColor: '#F0F4E5' },
  axeRune: { position: 'absolute', top: 8, left: 12, width: 9, height: 13, borderRadius: 2, backgroundColor: '#C1FFEF', transform: [{ rotate: '30deg' }] },
  axeBand: { position: 'absolute', top: 48, width: 10, height: 12, backgroundColor: '#14F195' },
  forestShortcutRail: { position: 'absolute', top: 12, left: 18, zIndex: 12, gap: 8 },
  forestShortcut: { width: 52, height: 52, borderRadius: 15, borderWidth: 1, borderColor: '#B8D3A7',
    backgroundColor: '#1D4744DE', alignItems: 'center', justifyContent: 'center' },
  forestShortcutPressed: { opacity: 0.65 }, forestShortcutUnowned: { opacity: 0.78 },
  forestShortcutDot: { position: 'absolute', top: -3, right: -3, width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#FFD54F', borderWidth: 2, borderColor: '#604A14' },
  forestPetDot: { position: 'absolute', top: 19, right: -7, width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#FFD54F', borderWidth: 2, borderColor: '#604A14' },
  forestPetTimer: { position: 'absolute', top: 53, width: 52, color: '#FFF0BB', backgroundColor: '#123A34E8',
    borderRadius: 7, overflow: 'hidden', textAlign: 'center', fontSize: 11, fontWeight: '900' },
  forestAxeIcon: { width: 50, height: 50, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  forestAxeIconScaled: { width: 60, height: 95, transform: [{ scale: 0.5 }] },
  forestPetIcon: { width: 43, height: 43 },
  forestReturnedPet: { position: 'absolute', left: 31, bottom: 89, width: 82, height: 85, zIndex: 7 },
  forestReturnedBubble: { position: 'absolute', bottom: 95, left: 45, width: 80, color: '#4D3929', backgroundColor: '#FFE6A3',
    borderRadius: 9, overflow: 'hidden', textAlign: 'center', paddingVertical: 3, fontSize: 10, fontWeight: '900' },
  forestReturnedPetArt: { width: 82, height: 85 },
  forestCharacter: { position: 'absolute', left: '25%', bottom: 18, width: 155, height: 155, zIndex: 5 },
  characterFaceTarget: { position: 'absolute', left: 46, top: 26, width: 67, height: 59, borderRadius: 30 },
  characterFaceHint: { borderWidth: 2, borderColor: '#FFE494', backgroundColor: '#FFE4941A' },
  holdGlow: { position: 'absolute', left: '49%', bottom: '25%', width: 92, height: 92, borderRadius: 46, backgroundColor: '#FFF4A3', zIndex: 4 },
  forestMapIcon: { fontSize: 25 },
  storageTarget: { position: 'absolute', left: 10, bottom: 3, zIndex: 8, width: 116, height: 95, alignItems: 'center', justifyContent: 'flex-end' },
  storageArt: { width: 96, height: 62 },
  storageLabel: { color: '#FFF2D1', fontSize: 12, fontWeight: '900', backgroundColor: '#17352EC9', borderRadius: 7, overflow: 'hidden', paddingHorizontal: 6, marginTop: 2 },
  trolleyTarget: { position: 'absolute', right: 15, bottom: 3, zIndex: 9, width: 126, height: 110 },
  trolleyButton: { flex: 1, alignItems: 'center' },
  trolleyArt: { position: 'absolute', bottom: 18, width: 116, height: 78 },
  trolleyGround: { position: 'absolute', bottom: 4, left: 25, width: 86, height: 5, borderRadius: 50, backgroundColor: '#163E2B45' },
  trolleySprite: { width: 116, height: 78 },
  trolleyCount: { position: 'absolute', bottom: 1, maxWidth: 126, color: '#FFF2D1', fontSize: 11, fontWeight: '900', textAlign: 'center', backgroundColor: '#17352EC9', borderRadius: 7, overflow: 'hidden', paddingHorizontal: 5 },
  trolleyHint: { position: 'absolute', top: 0, maxWidth: 126, color: '#FFE59A', fontSize: 10, fontWeight: '800', textAlign: 'center', backgroundColor: '#17352EB8', borderRadius: 5, overflow: 'hidden', paddingHorizontal: 4, paddingVertical: 2 },
  rewardPreview: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarAxePosition: { position: 'absolute', top: 72, marginLeft: 125 },
  container: { flex: 1, backgroundColor: '#102D32', paddingTop: Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 24 : 0 },
  screenBackground: { position: 'absolute', left: 0, top: 0, width: '100%', height: '117%' },
  hudScrim: { position: 'absolute', left: 0, right: 0, top: 0, height: 285, backgroundColor: '#092A2E99' },
  hudScrimFadeOne: { position: 'absolute', left: 0, right: 0, top: 285, height: 20, backgroundColor: '#092A2E70' },
  hudScrimFadeTwo: { position: 'absolute', left: 0, right: 0, top: 305, height: 20, backgroundColor: '#092A2E46' },
  hudScrimFadeThree: { position: 'absolute', left: 0, right: 0, top: 325, height: 20, backgroundColor: '#092A2E20' },
  gameScreen: { flex: 1, paddingHorizontal: 20, paddingBottom: 24 },
  menuButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#25484A', alignItems: 'center', justifyContent: 'center', gap: 5 },
  menuLine: { width: 20, height: 2, borderRadius: 1, backgroundColor: '#F8EED6' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#061A20CC' },
  modalCard: { maxHeight: '88%', backgroundColor: '#102D32', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#48736B' },
  mapSurface: { flex: 1, backgroundColor: '#143A36', paddingTop: Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 24 : 0 },
  mapShade: { backgroundColor: '#082D2BB8' },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#0A302EDB', borderBottomWidth: 1, borderBottomColor: '#739B7B' },
  mapBack: { minWidth: 64, minHeight: 44, justifyContent: 'center' },
  mapBackText: { color: '#F7E9C6', fontSize: 14, fontWeight: '800' },
  mapTitle: { color: '#FFF1C8', fontSize: 19, fontWeight: '900' },
  mapContent: { paddingHorizontal: 18, paddingVertical: 18, flexGrow: 1 },
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
  forestInfoPanel: { marginTop: 9, paddingHorizontal: 11, paddingVertical: 7, gap: 2, borderRadius: 10, backgroundColor: '#0A292CEB', borderWidth: 1, borderColor: '#769B894D' },
  forestInfoText: { color: '#FFF2D3', fontSize: 12, fontWeight: '800' },
  fatigueFullText: { color: '#FFB7A7' },
  questRow: { gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#355D59' },
  questActive: { borderColor: '#EFC75E', backgroundColor: '#25484A' },
  languageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8, marginTop: 10 },
  languageButton: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#25484A', borderRadius: 12 },
  languageSelected: { backgroundColor: '#48736B' },
  achievement: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: '#18383B', marginTop: 8 },
  logTimer: { height: 3, width: 36, backgroundColor: '#F5C76B', marginTop: 10, borderRadius: 2 },
  header: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 },
  eyebrow: { color: '#88ACA5', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: '#F7E9C6', fontSize: 23, fontWeight: '900', letterSpacing: 1 },
  walletChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C4145', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16 },
  walletChipPressed: { opacity: 0.72 },
  walletDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EFC75E', marginRight: 6 },
  walletDotConnected: { backgroundColor: '#91D3B1' },
  walletText: { color: '#D4E5DD', fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 9, paddingHorizontal: 5, paddingVertical: 7, borderRadius: 14, backgroundColor: '#0B3032B0' },
  resourceHud: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  hudIcon: { width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  woodHudIcon: { fontSize: 21, lineHeight: 27 },
  coinHudIcon: { color: '#FFF29E', fontSize: 20, lineHeight: 26 },
  hudAmount: { flexShrink: 1, color: '#FFF8E8', fontSize: 17, fontWeight: '900', textShadowColor: '#17312B', textShadowRadius: 3 },
  attackHud: { flex: 1.25, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  attackHudIcon: { fontSize: 20, lineHeight: 27 },
  attackHudText: { flex: 1, minWidth: 0 },
  attackHudLevel: { color: '#FFF5DA', fontSize: 12, fontWeight: '900' },
  attackHudPower: { color: '#FF7981', fontSize: 15, fontWeight: '900' },
  statValue: { color: '#F8EED6', marginTop: 4, fontSize: 16, fontWeight: '800' },
  progressGroup: { marginTop: 16 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  fatigueRow: { marginTop: 11 },
  progressLabel: { color: '#BCD0C9', fontSize: 12, fontWeight: '700' },
  progressValue: { color: '#E3DABD', fontSize: 12, fontWeight: '800' },
  meter: { height: 8, backgroundColor: '#25484A', borderRadius: 8, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 8 },
  forest: { flex: 1, marginTop: 2, marginHorizontal: -20, overflow: 'hidden', minHeight: 0, position: 'relative' },
  treeVisual: { position: 'absolute', left: '21%', top: 0, width: '79%', height: '100%', zIndex: 3 },
  treeHitTarget: { position: 'absolute', left: '51%', top: '9%', width: '47%', height: '84%', zIndex: 4 },
  treeSprite: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
  bossEyes: { position: 'absolute', left: '46%', bottom: '29%', flexDirection: 'row', gap: 12 },
  bossEye: { width: 8, height: 6, backgroundColor: '#FFEAA5', borderRadius: 3, shadowColor: '#FFE259', shadowRadius: 8, shadowOpacity: 1 },
  chopImpact: { position: 'absolute', left: '58%', bottom: '29%', width: 70, height: 70, alignItems: 'center', justifyContent: 'center', zIndex: 7 },
  chopImpactCore: { width: 23, height: 23, borderRadius: 12, backgroundColor: '#FFF4B7', borderWidth: 5, borderColor: '#FFC45B', elevation: 6 },
  chopImpactRay: { position: 'absolute', width: 66, height: 5, borderRadius: 3, backgroundColor: '#FFE18A' },
  canopy: { position: 'absolute', bottom: 115, width: 172, height: 128, zIndex: 2 },
  leafLeft: { position: 'absolute', left: 0, bottom: 0, width: 106, height: 91, borderRadius: 48, backgroundColor: '#438875', borderBottomWidth: 10, borderBottomColor: '#306657' },
  leafRight: { position: 'absolute', right: 0, bottom: 0, width: 109, height: 100, borderRadius: 50, backgroundColor: '#64A381', borderBottomWidth: 10, borderBottomColor: '#438875' },
  leafTop: { position: 'absolute', left: 34, top: 0, width: 103, height: 98, borderRadius: 50, backgroundColor: '#84BC8D' },
  leafGlint: { position: 'absolute', left: 52, top: 15, width: 41, height: 13, borderRadius: 10, backgroundColor: '#ADD39C', transform: [{ rotate: '-25deg' }] },
  treeKnot: { width: 19, height: 28, borderRadius: 14, borderWidth: 4, borderColor: '#73442F', backgroundColor: '#B97B4E' },
  trunk: { width: 54, height: 126, borderRadius: 14, backgroundColor: '#9B603F', borderLeftWidth: 7, borderLeftColor: '#BE8558', borderRightWidth: 6, borderRightColor: '#75492F', justifyContent: 'space-evenly', alignItems: 'center' },
  trunkLine: { height: 5, width: 33, borderRadius: 6, backgroundColor: '#73442F', opacity: 0.75 },
  hitHint: { position: 'absolute', bottom: 12, left: '14%', color: '#FFF7D8', fontSize: 12, fontWeight: '900', letterSpacing: 2, backgroundColor: '#112E2CA8', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden', textShadowColor: '#1B352C', textShadowRadius: 3 },
  damagePopup: { position: 'absolute', zIndex: 20, color: '#FFF7D6', fontSize: 25, fontWeight: '900', textShadowColor: '#6F2D22', textShadowOffset: { width: 2, height: 3 }, textShadowRadius: 1 },
  log: { position: 'absolute', width: 62, height: 58, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  logSwept: { opacity: 0.4 },
  logEmoji: { fontSize: 36 }, logValue: { position: 'absolute', bottom: -2, color: '#FFF5D6', fontWeight: '900', fontSize: 11, backgroundColor: '#1B393A', borderRadius: 8, paddingHorizontal: 5, overflow: 'hidden' },
  gameplayToast: { position: 'absolute', top: 10, alignSelf: 'center', maxWidth: '86%', zIndex: 21,
    color: '#FFF7D8', textAlign: 'center', fontSize: 14, fontWeight: '900',
    textShadowColor: '#102D27', textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 5 },
  actions: { flexDirection: 'row', gap: 10, paddingBottom: 14 },
  potionButton: { width: 52, minHeight: 52, flexShrink: 0, borderRadius: 14, borderWidth: 2, borderColor: '#F2CB68', backgroundColor: '#315E53', alignItems: 'center', justifyContent: 'center', paddingVertical: 5 },
  potionButtonInactive: { backgroundColor: '#213D3B', borderColor: '#90A79C' },
  potionIcon: { fontSize: 27, lineHeight: 30, marginRight: 5 },
  potionLabel: { color: '#FFF1CD', fontSize: 11, fontWeight: '800', lineHeight: 14 },
  potionCountBadge: { position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, paddingHorizontal: 3, borderRadius: 9, backgroundColor: '#F3CD65', alignItems: 'center', justifyContent: 'center' },
  potionCountText: { color: '#233D35', fontSize: 11, fontWeight: '900', lineHeight: 14 },
  potionCountEmpty: { backgroundColor: '#506B64' },
  potionCountEmptyText: { color: '#F2F0DE' },
  restButton: { width: 78, borderRadius: 16, backgroundColor: '#355D59', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  restIcon: { fontSize: 21 }, restText: { color: '#E9E6CC', fontSize: 11, fontWeight: '800', marginTop: 1 },
  cart: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFC75E', borderRadius: 16, minHeight: 58 },
  cartIcon: { fontSize: 24, marginRight: 6 }, cartText: { color: '#5C3D26', fontWeight: '900', fontSize: 12 },
});
