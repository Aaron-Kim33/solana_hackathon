import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, AppState, Text, View } from 'react-native';
import { SoundPressable as Pressable, useGameAudio } from '../audio/GameAudio';
import { serverCues } from '../audio/policy';
import { Buffer } from 'buffer';
import { PublicKey } from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { APP_IDENTITY } from '../solana/wallet';
import { extractLoginSignature } from '../solana/login-signature';
import { recordHarvest } from '../solana/achievement';
import { pendingServerRecord, savePendingServerRecord } from '../solana/pending-server-record';
import { recoverServerRecord, recordRecoveryNotice } from '../solana/server-record-recovery';
import { recordErrorKey } from '../solana/record-errors';
import { translate } from '../i18n';
import { firstRecordBonusActive, optionInfo, GEM_TIERS, GEM_FUSION_COST } from './progression';
import { deployment } from '../deployment';
import { createLiveInputQueue } from './live-input-queue';
import { canLeaveServer, canQueueServerHit } from './server-input-policy';
import { clearServerSession, readServerSession, writeServerSession } from './server-session';
import { parseServerSnapshot } from './server-snapshot';
import { confirmedCollectionTutorial } from './confirmed-tutorial';
import type { PlayerSnapshot, GameCommand, CommandRequest } from '../shared/server-contract';
import type { LoadWeeklyRanking } from '../shared/weekly-ranking';

// Survives menu navigation, not app reload. Never written to the ordinary save file.
const sessionCache: { token: string | null; state: PlayerSnapshot | null; pending: CommandRequest | null } = { token: null, state: null, pending: null };
let sequence = 0;
let serverClockOffset = 0;

// Development-only loopback via adb reverse; never used in release or to upload local saves.
const BASE = deployment.config?.apiUrl;
async function api(path: string, payload?: unknown, token?: string) {
  if (!BASE) throw new Error('PREVIEW_CONFIG_REQUIRED');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(BASE + path, { method: payload === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), signal: controller.signal });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      const allowed = ['RECORD_RPC_UNAVAILABLE', 'RECORD_CHECK_BUSY', 'RECORD_MISMATCH', 'RECORD_ALREADY_SUBMITTED', 'INVALID_COMMAND', 'INVALID_SIGNATURE', 'CHALLENGE_UNAVAILABLE', 'UNAUTHENTICATED', 'RATE_LIMITED', 'INVALID_BODY', 'INVALID_WALLET', 'INTERNAL_ERROR', 'ACTION_TOO_FAST', 'DROP_UNAVAILABLE', 'ACTION_UNAVAILABLE', 'REVISION_CONFLICT', 'REQUEST_ID_REUSED'];
      throw new Error(allowed.includes(result.error) ? result.error : 'SERVER_REQUEST_FAILED');
    }
    return await response.json();
  } finally { clearTimeout(timer); }
}
export type ServerController = {
  snapshot: PlayerSnapshot | null; busy: boolean; queued: number; pending: boolean; now: number; trolleySupported: boolean;
  canChop: boolean; controls: ReactNode; notice: string; confirmedTutorialMask: number; retryPending: () => void;
  resetTutorialConfirmations: () => void;
  connect: () => void; refresh: () => void;
  loadRanking: LoadWeeklyRanking;
  hit: () => boolean; command: (command: GameCommand) => boolean; dragging: (value: boolean) => void;
  record: () => Promise<void>; checkRecord: () => Promise<void>;
};
export function ServerLoginPanel({ language, renderMain }: { language: 'ko' | 'en'; renderMain: (controller: ServerController) => ReactNode }) {
  const { play: playSound } = useGameAudio();
  const ko = language === 'ko', token = useRef<string | null>(sessionCache.token), lock = useRef(false);
  const [busy, setBusy] = useState(false), [restoring, setRestoring] = useState(true);
  const [state, setState] = useState<PlayerSnapshot | null>(() => {
    try { return sessionCache.state ? parseServerSnapshot(sessionCache.state) : null; }
    catch { sessionCache.state = null; return null; }
  }), [notice, setNotice] = useState('');
  const [trolleySupported, setTrolleySupported] = useState(true);
  const [confirmedTutorialMask, setConfirmedTutorialMask] = useState(0);
  const inputQueue = useRef(createLiveInputQueue());
  const readyAt = useRef(0), foreground = useRef(true);
  const pump = useRef<() => void>(() => {});
  const queueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [queued, setQueued] = useState(0);
  const collecting = useRef(false);
  const [dragging, setDragging] = useState(false);
  const setCollecting = (value: boolean) => {
    collecting.current = value;
    setDragging(value);
    // Dragging wins over taps that have not reached the server yet. An in-flight
    // or uncertain request is never discarded, and the server remains authoritative.
    if (value && inputQueue.current.discardHits()) setQueued(inputQueue.current.size);
  };
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      foreground.current = next === 'active';
      if (next !== 'active') {
        if (queueTimer.current) clearTimeout(queueTimer.current);
        queueTimer.current = null; inputQueue.current.clear(); setQueued(0);
        setCollecting(false);
      }
    });
    return () => sub.remove();
  }, []);
  useEffect(() => () => { if (queueTimer.current) clearTimeout(queueTimer.current); }, []);
  const updateState = (value: PlayerSnapshot | null) => {
    const normalized = value ? parseServerSnapshot(value) : null;
    if (value?.serverTime !== undefined) serverClockOffset = value.serverTime - Date.now();
    if (value) setTrolleySupported(Object.hasOwn(value.progress, 'trolleyWood'));
    sessionCache.state = normalized;
    setState(normalized);
    return normalized;
  };
  // Expiry must not silently switch a server player into the local economy.
  const expireSession = async () => {
    token.current = null; sessionCache.token = null; sessionCache.pending = null;
    setConfirmedTutorialMask(0);
    try { await clearServerSession(); return true; } catch { return false; }
  };
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!token.current && BASE) {
          const saved = await readServerSession(BASE);
          if (!active) return;
          token.current = saved; sessionCache.token = saved;
        }
        if (token.current) await run(false);
      } catch {
        if (active) setNotice(ko ? '저장된 로그인을 읽지 못했어요. 지갑으로 다시 연결해 주세요.' : 'Could not read the saved login. Reconnect with your wallet.');
      } finally { if (active) setRestoring(false); }
    })();
    return () => { active = false; };
  }, []);
  const run = async (logout: boolean) => {
    if (lock.current || inputQueue.current.size > 0 || sessionCache.pending || collecting.current) return;
    lock.current = true; setBusy(true); setNotice('');
    let stage = 'CONNECT';
    let storageWarning = '';
    try {
      if (logout) {
        stage = 'LOGOUT';
        let remoteFailed = false;
        try { if (token.current) await api('/auth/logout', {}, token.current); }
        catch { remoteFailed = true; }
        const cleared = await expireSession();
        updateState(null);
        if (remoteFailed || !cleared) setNotice(ko
          ? '기기에서는 로그아웃했어요. 서버 세션 폐기 또는 보안 저장소 삭제를 확인하지 못했으니, 공유 기기라면 네트워크와 저장 공간을 확인해 주세요.'
          : 'Signed out on this device, but server revocation or secure storage removal could not be confirmed. Check the network and storage on a shared device.');
        return;
      }
      if (!token.current) {
        // Check reachability before opening the wallet.
        await api('/health');
        const session = await transact(async wallet => {
          stage = 'AUTHORIZE';
          const authorization = await wallet.authorize({ chain: 'solana:mainnet', identity: APP_IDENTITY });
          const account = authorization.accounts[0];
          if (!account) throw new Error('NO_ACCOUNT');
          const address = new PublicKey(Buffer.from(account.address, 'base64')).toBase58();
          stage = 'CHALLENGE';
          const challenge = await api('/auth/challenge', { wallet: address });
          if (typeof challenge.message !== 'string' || challenge.message.length > 2048 ||
            !challenge.message.startsWith(`${new URL(APP_IDENTITY.uri).host} requests a Lumber Rush login.\n`) ||
            !challenge.message.includes(`Wallet: ${address}\n`) || !challenge.message.includes(`Origin: ${APP_IDENTITY.uri}\n`)) throw new Error('INVALID_CHALLENGE');
          const message = Buffer.from(challenge.message, 'utf8');
          stage = 'SIGN';
          const signed = (await wallet.signMessages({ addresses: [account.address], payloads: [message] }))[0];
          stage = 'SIGN_FORMAT';
          const signature = extractLoginSignature(signed, message);
          stage = 'VERIFY';
          return api('/auth/login', { challengeId: challenge.challengeId, signature: Buffer.from(signature).toString('base64') });
        });
        if (typeof session.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(session.token)) throw new Error('INVALID_SESSION');
        try { await writeServerSession(BASE!, session.token); }
        catch { storageWarning = ko ? '기기 보안 저장에 실패했어요. 앱 재시작 시 다시 서명해야 해요.' : 'Secure device storage failed. You will need to sign again after restarting.'; }
        token.current = session.token;
        sessionCache.token = session.token;
      }
      stage = 'ACCOUNT';
      updateState(await api('/me', undefined, token.current!));
      readyAt.current = Date.now() + 250;
      // A record RPC outage must not turn a successful account login into a login failure.
      try {
        // Retain recovery for receipts submitted by older Devnet previews.
        // Legacy chain outages must not prevent a newer Mainnet status check.
        try {
          const legacy = await recoverServerRecord((path, payload) => api(path, payload, token.current!), pendingServerRecord);
          if (legacy.snapshot) updateState(legacy.snapshot);
        } catch { /* The optional record may be checked again without resending. */ }
        const recovered = await recoverServerRecord((path, payload) => api(path, payload, token.current!), pendingServerRecord, '/milestone');
        if (recovered.snapshot) updateState(recovered.snapshot);
        setNotice([recordRecoveryNotice(recovered.status, ko), storageWarning].filter(Boolean).join('\n'));
      } catch (error) {
        if (error instanceof Error && error.message === 'UNAUTHENTICATED') await expireSession();
        setNotice([ko ? '서버 진행을 불러왔어요. 선택형 기념 기록은 확인하지 못했지만 계속 플레이할 수 있어요. 새 거래를 보내지 않았어요.' : 'Server progress loaded. Optional record recovery is unavailable, but you can keep playing. No new transaction was sent.', storageWarning].filter(Boolean).join('\n'));
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHENTICATED') await expireSession();
      const safe = ['INVALID_SIGNATURE', 'INVALID_SIGNED_MESSAGE', 'INVALID_CHALLENGE', 'INVALID_SESSION', 'CHALLENGE_UNAVAILABLE', 'UNAUTHENTICATED', 'RATE_LIMITED', 'INVALID_BODY', 'INVALID_WALLET', 'INTERNAL_ERROR', 'SERVER_REQUEST_FAILED', 'NO_ACCOUNT'];
      const code = error instanceof Error && safe.includes(error.message) ? error.message : 'WALLET_OR_NETWORK_ERROR';
      setNotice(`${ko ? '로그인이 완료되지 않았어요. 아래 단계와 코드를 알려주세요. 로컬 진행은 변경되지 않았어요.' : 'Login did not finish. Please report the stage and code below. Local progress is unchanged.'}\n${stage} / ${code}`);
    } finally { lock.current = false; setBusy(false); }
  };
  const action = async (command?: GameCommand) => {
    if (lock.current || !token.current || !sessionCache.state) return;
    if (!sessionCache.pending && !command) return;
    lock.current = true; setBusy(true); setNotice('');
    const retrying = sessionCache.pending !== null;
    sessionCache.pending ??= { requestId: `play_${Date.now()}_${++sequence}`, expectedRevision: sessionCache.state.revision, command: command! };
    try {
      const sentType = sessionCache.pending.command.type;
      const beforeAudio = sessionCache.state;
      const beforeHarvested = sessionCache.state.progress.harvested;
      const beforeTrolley = sessionCache.state.progress.trolleyWood;
      const beforeCoins = sessionCache.state.progress.coins;
      const beforeGems = sessionCache.state.progress.gems;
      const beforeSquirrelTrip = sessionCache.state.squirrel?.trip;
      const sentCommand = sessionCache.pending.command;
      const hadFirstRecordPower = firstRecordBonusActive(sessionCache.state.progress);
      let sentAt = 0;
      let response: PlayerSnapshot;
      for (let retry = 0; ; retry++) {
        sentAt = Date.now();
        try {
          response = await api('/commands', sessionCache.pending, token.current);
          break;
        } catch (error) {
          // A 429 here means the server did not commit. Retry the same request ID;
          // never retry an uncertain network failure as a different command.
          if (!(error instanceof Error && error.message === 'ACTION_TOO_FAST') || retry >= 2) throw error;
          await new Promise(resolve => setTimeout(resolve, 180 + retry * 150));
        }
      }
      // The network round trip already consumes most of the server's 150/250 ms
      // action window. Pace from send time, not response time; the server still
      // enforces the final limit and the safe 429 retry above handles jitter.
      readyAt.current = sentAt + (['collectDrop', 'loadTrolley', 'loadTrolleyBatch', 'collectTrolley'].includes(sentType) ? 300 : 200);
      sessionCache.pending = null;
      response = updateState(response)!;
      const tutorialMask = confirmedCollectionTutorial(sentCommand, beforeAudio.progress, response.progress);
      if (tutorialMask) setConfirmedTutorialMask(current => current | tutorialMask);
      for (const cue of serverCues(beforeAudio, response, sentCommand)) playSound(cue);
      if (response.progress.harvested > beforeHarvested && sentType !== 'collectTrolley') {
        const collected = response.progress.harvested - beforeHarvested;
        if (beforeHarvested < 20 && response.progress.harvested >= 20) setNotice(translate(language, 'firstHarvestReady'));
        else if (collected > 0) setNotice(translate(language, 'collected', collected));
      }
      if (sentType === 'collectTrolley' && response.progress.trolleyTrip) setNotice(translate(language, 'trolleyDeparted'));
      if (sentType === 'startFarmPuzzle') setNotice(ko ? '뿌리 물길이 나타났어요. 흙 칸을 탭해 돌려 주세요.' : 'The root waterway is ready. Tap soil tiles to rotate them.');
      if (sentType === 'finishFarmPuzzle' && response.progress.farm?.plots.some(plot => plot?.plantedAt === response.serverTime))
        setNotice(ko ? '묘목을 심었어요! 자라면 숲에 이식해 카르마를 받으세요.' : 'Sapling planted! Transplant it when grown to earn karma.');
      if (sentType === 'claimFarmTree') setNotice(ko ? '묘목을 숲에 이식했어요. 카르마 +1!' : 'Sapling transplanted. Karma +1!');
      if ((sentType === 'loadTrolley' || sentType === 'loadTrolleyBatch') && response.progress.trolleyWood > beforeTrolley)
        setNotice(translate(language, 'trolleyLoaded', response.progress.trolleyWood - beforeTrolley));
      if (sentType === 'acknowledgeWallet' && response.walletCoinRewardClaimed && response.progress.coins - beforeCoins === 20)
        setNotice(translate(language, 'walletCoinGranted'));
      if (sentType === 'claimFirstRecord' && response.progress.firstRecordClaimed)
        setNotice(translate(language, 'firstRecordRewardReceived'));
      if (sentType === 'claimGrowthReward' && response.progress.growthRewardClaimed)
        setNotice(`${translate(language, 'rewardClaimed')} · ${translate(language, 'gemReceived')}`);
      if (sentType === 'claimAdventure' || sentType === 'claimForestTrail') setNotice(translate(language, 'rewardClaimed'));
      if (sentType === 'claimWorldBossReward') setNotice(ko ? '월드보스 참여 보상을 받았어요!' : 'World boss participation reward received!');
      if (sentType === 'claimWorldBossSharedReward') setNotice(ko ? '함께 달성한 공동 보상을 받았어요!' : 'Community boss reward received!');
      if (sentType === 'useFatiguePotion') setNotice(translate(language, 'fatiguePotionDone'));
      if (sentType === 'claimSquirrel') setNotice(ko ? '다람쥐가 탐험 친구가 되었어요!' : 'The squirrel joined your adventures!');
      if (sentType === 'dispatchSquirrel') setNotice(ko ? '다람쥐가 탐험을 떠났어요. 4시간 뒤 돌아와요.' : 'The squirrel is exploring. It returns in 4 hours.');
      if (sentType === 'collectSquirrel' && beforeSquirrelTrip) setNotice(ko
        ? `다람쥐가 ${beforeSquirrelTrip.reward.toLocaleString()} ${beforeSquirrelTrip.destination === 'mine' ? '코인' : '목재'}를 가져왔어요!`
        : `The squirrel brought back ${beforeSquirrelTrip.reward.toLocaleString()} ${beforeSquirrelTrip.destination === 'mine' ? 'coins' : 'wood'}!`);
      if (sentCommand.type === 'drawGem') {
        const tier = GEM_TIERS.find(candidate => response.progress.gems[candidate] > beforeGems[candidate]);
        if (tier) setNotice(translate(language, 'woodGemReceived', translate(language, tier)));
      }
      if (sentCommand.type === 'fuse') {
        const nextTier = GEM_TIERS[GEM_TIERS.indexOf(sentCommand.tier) + 1];
        const success = nextTier !== undefined && response.progress.gems[nextTier] > beforeGems[nextTier];
        setNotice(`${translate(language, success ? 'fusionSuccess' : 'fusionFailed')} · ${translate(language, success ? 'fusionSuccessBody' : 'fusionFailedBody', GEM_FUSION_COST)}`);
      }
      if (sentType === 'openGem' && response.progress.inventory.length > 0) {
        const item = response.progress.inventory.at(-1)!;
        const option = optionInfo(item);
        setNotice(`${translate(language, 'gemResult')} · ${translate(language, option.kind)} +${option.value}${option.kind === 'damage' ? '' : '%p'}`);
      }
      if (sentType === 'equipOption') setNotice(translate(language, 'skinEquipped'));
      if (sentType === 'equipAxe' && !hadFirstRecordPower && firstRecordBonusActive(response.progress))
        setNotice(translate(language, 'firstRecordBonusUnlocked'));
      // Response already contains authoritative state. Re-read only on an explicit refresh/conflict.
      if (retrying) updateState(await api('/me', undefined, token.current));
    } catch (error) {
      inputQueue.current.clear(); setQueued(0);
      playSound('unavailable');
      const code = error instanceof Error ? error.message : 'NETWORK';
      if (code === 'UNAUTHENTICATED') await expireSession();
      else if (['INVALID_COMMAND', 'ACTION_TOO_FAST', 'DROP_UNAVAILABLE', 'ACTION_UNAVAILABLE', 'REVISION_CONFLICT', 'REQUEST_ID_REUSED', 'RATE_LIMITED'].includes(code)) {
        sessionCache.pending = null;
        try { updateState(await api('/me', undefined, token.current!)); } catch { /* keep prior view, never grant locally */ }
      }
      setNotice(code === 'DROP_UNAVAILABLE'
        ? (ko ? '목재가 만료되었거나 이미 회수됐어요. 남아 있는 목재를 다시 쓸어 담아 주세요.' : 'A log expired or was already collected. Sweep the remaining logs again.')
        : code === 'ACTION_TOO_FAST'
          ? (ko ? '입력이 너무 빨랐어요. 잠시 후 다시 시도해 주세요.' : 'Input was too fast. Please try again shortly.')
          : ['ACTION_UNAVAILABLE', 'REVISION_CONFLICT', 'RATE_LIMITED', 'INVALID_COMMAND', 'REQUEST_ID_REUSED'].includes(code)
            ? (ko ? '현재 요청을 처리할 수 없어 서버 상태를 새로 확인했어요. 다시 시도해 주세요.' : 'The request could not be processed. Server state was refreshed; please try again.')
            : (ko ? '서버 응답을 확인하지 못했어요. 메뉴에서 같은 요청을 재확인해 주세요. 중복 보상은 지급하지 않아요.' : 'Could not confirm the server response. Retry the same pending request from the menu; no duplicate rewards are granted.'));
    } finally { lock.current = false; setBusy(false); }
  };
  pump.current = () => {
    queueTimer.current = null;
    if (!foreground.current || !inputQueue.current.size) return;
    if (!token.current || (sessionCache.pending && !lock.current)) {
      inputQueue.current.clear(); setQueued(0); return;
    }
    if (lock.current || collecting.current) {
      queueTimer.current = setTimeout(() => pump.current(), 25); return;
    }
    const step = inputQueue.current.take(Date.now(), readyAt.current);
    setQueued(inputQueue.current.size);
    if (step.expired) setNotice(ko ? '연결 지연으로 오래된 미전송 입력을 취소했어요.' : 'Stale unsent input was cancelled after a delay.');
    if (step.command) {
      void action(step.command).finally(() => {
        if (inputQueue.current.size && foreground.current && !queueTimer.current) pump.current();
      });
    } else if (step.wait) queueTimer.current = setTimeout(() => pump.current(), step.wait);
  };
  const enqueue = (command: GameCommand): boolean => {
    if (!foreground.current || !token.current || (lock.current && !sessionCache.pending) || (sessionCache.pending && !lock.current)) return false;
    if (command.type === 'claimWorldBossSharedReward' &&
      (sessionCache.pending?.command.type === command.type || inputQueue.current.hasType(command.type))) return false;
    if (!trolleySupported && ['loadTrolley', 'loadTrolleyBatch', 'collectTrolley'].includes(command.type)) {
      setNotice(ko ? '서버가 아직 트롤리를 지원하지 않아요. 서버 업데이트 전에는 목재를 보관함으로 직접 옮겨 주세요.' : 'The server does not support the trolley yet. Move logs directly to storage until it is updated.');
      return false;
    }
    if (command.type === 'claimWorldBossReward' || command.type === 'claimForestTrail' || command.type === 'useFatiguePotion' || command.type === 'claimFirstRecord' || command.type === 'acknowledgeWallet' || command.type === 'claimGrowthReward' || command.type === 'claimAdventure' || command.type === 'drawGem' || command.type === 'fuse') {
      if (sessionCache.pending?.command.type === command.type || inputQueue.current.hasType(command.type)) return false;
      if (command.type === 'claimAdventure' && command.stage !== sessionCache.state?.progress.adventureClaimed) return false;
      if (command.type === 'claimFirstRecord' && sessionCache.state?.progress.firstRecordClaimed) return false;
      if (command.type === 'claimGrowthReward' && sessionCache.state?.progress.growthRewardClaimed) return false;
      if (command.type === 'acknowledgeWallet' && sessionCache.state?.walletCoinRewardClaimed) return false;
    }
    if (command.type === 'collectDrop' || command.type === 'loadTrolley') {
      const pending = sessionCache.pending?.command;
      if ((pending?.type === 'collectDrop' || pending?.type === 'loadTrolley') && pending.dropId === command.dropId ||
        pending?.type === 'loadTrolleyBatch' && pending.dropIds.includes(command.dropId) || inputQueue.current.hasDrop(command.dropId)) return true;
    }
    if (command.type === 'loadTrolleyBatch') {
      const pending = sessionCache.pending?.command;
      const remaining = command.dropIds.filter(id => !((pending?.type === 'collectDrop' || pending?.type === 'loadTrolley') && pending.dropId === id) &&
        !(pending?.type === 'loadTrolleyBatch' && pending.dropIds.includes(id)) && !inputQueue.current.hasDrop(id));
      if (!remaining.length) return true;
      command = { type: 'loadTrolleyBatch', dropIds: remaining };
    }
    if (command.type === 'collectTrolley' && (sessionCache.pending?.command.type === 'collectTrolley' || inputQueue.current.hasType('collectTrolley'))) return false;
    if (!inputQueue.current.push(command, Date.now())) {
      setNotice(ko ? '입력이 밀렸어요. 잠시 후 다시 시도해 주세요.' : 'Input queue is full. Please try again shortly.');
      return false;
    }
    setQueued(inputQueue.current.size);
    if (!queueTimer.current) pump.current();
    return true;
  };
  const enqueueHit = () => {
    if (collecting.current) return false;
    return enqueue({ type: 'hit' });
  };
  const record = async () => {
    if (lock.current || inputQueue.current.size || sessionCache.pending || collecting.current || !token.current) return;
    lock.current = true; setBusy(true);
    setNotice(ko ? '선택형 Mainnet 기념 기록을 준비해요. 성장 보상과는 별개예요.' : 'Preparing an optional Mainnet record, separate from growth rewards.');
    try {
      const intent = await api('/milestone/prepare', {}, token.current);
      const signature = intent.signature ?? pendingServerRecord(intent.memo);
      if (signature) await api('/milestone/submit', { signature }, token.current);
      else {
        await recordHarvest(intent.wallet, async submitted => {
          // Keep the recovery receipt even when submission to the API fails.
          savePendingServerRecord(intent.memo, submitted);
          await api('/milestone/submit', { signature: submitted }, token.current!);
        }, intent.memo, { approveFee: lamports => new Promise(resolve => Alert.alert(
          ko ? 'Mainnet 기념 기록 · 선택' : 'Optional Mainnet record',
          ko ? `네트워크 수수료: ${lamports / 1_000_000_000} SOL (실제 SOL)\n공개 Memo에 성장 이정표를 남겨요. 토큰 구매·목재 소모는 없어요. 기록하지 않아도 도끼와 모든 성장 보상을 받을 수 있어요.\n지갑이 Mainnet인지 확인해 주세요.` : `Network fee: ${lamports / 1_000_000_000} SOL (real SOL)\nPublish your milestone as a public Memo. No token purchase or wood cost. Your axe and all growth rewards remain free without recording.\nMake sure your wallet is on Mainnet.`,
          [{ text: ko ? '나중에' : 'Not now', style: 'cancel', onPress: () => resolve(false) },
           { text: ko ? '지갑에서 확인' : 'Review in wallet', onPress: () => resolve(true) }],
          { cancelable: true, onDismiss: () => resolve(false) },
        )) });
      }
      const result = await api('/milestone/check', {}, token.current);
      updateState(result.snapshot);
      setNotice(recordRecoveryNotice(result.status, ko));
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHENTICATED') await expireSession();
      const detail = translate(language, recordErrorKey(error));
      setNotice(`${detail}\n${ko ? '이미 제출했다면 메뉴의 기록 상태 확인을 이용해 주세요. 새 거래를 보내지 않고 확인해요.' : 'If already submitted, use Check record status in the menu. It never sends a new transaction.'}`);
    } finally { lock.current = false; setBusy(false); }
  };
  const checkRecord = async () => {
    if (lock.current || inputQueue.current.size || sessionCache.pending || collecting.current || !token.current) return;
    lock.current = true; setBusy(true);
    try {
      const recovered = await recoverServerRecord((path, payload) => api(path, payload, token.current!), pendingServerRecord, '/milestone');
      if (recovered.snapshot) updateState(recovered.snapshot);
      if (recovered.status === 'none' || recovered.status === 'prepared') {
        const legacy = await recoverServerRecord((path, payload) => api(path, payload, token.current!), pendingServerRecord);
        if (legacy.snapshot) updateState(legacy.snapshot);
        if (legacy.status !== 'none' && legacy.status !== 'prepared') {
          setNotice(`${ko ? '이전 Devnet 기록: ' : 'Previous Devnet record: '}${recordRecoveryNotice(legacy.status, ko)}`);
          return;
        }
      }
      setNotice(recordRecoveryNotice(recovered.status, ko) || (ko ? '기념 기록은 선택이에요. 기록 없이도 퀘스트 보상을 받고 계속 플레이할 수 있어요.' : 'Recording is optional. Claim quest rewards and keep playing without a record.'));
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHENTICATED') await expireSession();
      setNotice(ko ? '기록을 확인하지 못했어요. 잠시 후 다시 확인해 주세요. 거래를 다시 보내거나 보상을 지급하지 않았어요.' : 'Could not check the record. Try again shortly. No transaction was resent and no reward was granted.');
    } finally { lock.current = false; setBusy(false); }
  };
  const input = { busy: busy || restoring, queued, pending: sessionCache.pending?.command.type ?? null, dragging };
  const navigationLocked = !canLeaveServer(input);
  const button = (text: string, logout: boolean) => <Pressable accessibilityRole="button" disabled={navigationLocked} onPress={() => void run(logout)} style={{ padding: 12, minHeight: 44, backgroundColor: '#29524C', borderRadius: 10, opacity: navigationLocked ? 0.5 : 1 }}><Text style={{ color: '#E6EFDD' }}>{text}</Text></Pressable>;
  // A saved server session must never briefly render the separate local save.
  if (!state && (restoring || token.current)) return <View style={{ flex: 1, backgroundColor: '#102D32', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
    {(restoring || busy) && <ActivityIndicator size="large" color="#EDCE71" />}
    <Text style={{ color: '#E6EFDD', fontSize: 16, textAlign: 'center' }}>{restoring || busy
      ? (ko ? '서버 저장을 확인하고 있어요…' : 'Checking your server save…')
      : (ko ? '서버 저장에 연결하지 못했어요.' : 'Could not connect to your server save.')}</Text>
    {!restoring && !busy && <Pressable accessibilityRole="button" onPress={() => void run(false)} style={{ padding: 12, minHeight: 44, backgroundColor: '#29524C', borderRadius: 10 }}>
      <Text style={{ color: '#E6EFDD' }}>{ko ? '다시 시도' : 'Retry'}</Text>
    </Pressable>}
    {!restoring && !!notice && <Text style={{ color: '#FFD18E', textAlign: 'center' }}>{notice}</Text>}
  </View>;
  return renderMain({ snapshot: state, busy: busy || restoring, queued, pending: sessionCache.pending !== null, trolleySupported,
    get now() { return Date.now() + serverClockOffset; }, canChop: !!token.current && canQueueServerHit(input), notice, confirmedTutorialMask,
    retryPending: () => { if (!collecting.current) void action(); },
    resetTutorialConfirmations: () => setConfirmedTutorialMask(0),
    connect: () => { if (!restoring) void run(false); },
    loadRanking: async category => {
      if (!token.current) throw new Error('UNAUTHENTICATED');
      return api(`/leaderboards/${category}`, undefined, token.current);
    },
    refresh: () => { if (!lock.current && !inputQueue.current.size && !sessionCache.pending && token.current) {
      lock.current = true; setBusy(true);
      void api('/me', undefined, token.current).then(updateState)
        .catch(() => setNotice(ko ? '공동 숲을 새로고침하지 못했어요.' : 'Could not refresh the community forest.'))
        .finally(() => { lock.current = false; setBusy(false); });
    } },
    hit: enqueueHit, dragging: setCollecting, record, checkRecord,
    command: command => !collecting.current && enqueue(command),
    controls: <View style={{ gap: 10 }}>
      <Text style={{ color: '#B9D5CC' }}>{ko ? '지갑 연결과 서버 저장은 무료예요. 선택형 Mainnet 기념 기록에만 네트워크 수수료가 필요해요. 주간 순위에는 서버에서 확인한 기여만 반영돼요.' : 'Wallet login and server saves are free. Only optional Mainnet records require a network fee. Weekly rankings use server-verified contributions only.'}</Text>
      {button(token.current ? (ko ? '서버 상태 새로고침' : 'Refresh server state') : (ko ? '서버 저장 연결 · 지갑 서명' : 'Connect server save · Sign with wallet'), false)}
      {state && button(ko ? '서버 로그아웃 · 로컬 저장 복귀' : 'Sign out · Restore local save', true)}
      {state && token.current && <Pressable accessibilityRole="button" disabled={navigationLocked} onPress={() => void checkRecord()} style={{ padding: 12 }}><Text style={{ color: '#E6EFDD' }}>{ko ? '기록 상태 확인 · 거래 재전송 없음' : 'Check record status · No resend'}</Text></Pressable>}
      {sessionCache.pending && !busy && <Pressable accessibilityRole="button" onPress={() => void action()} style={{ padding: 12 }}><Text style={{ color: '#FFD18E' }}>{ko ? '미확인 요청 재확인' : 'Retry pending request'}</Text></Pressable>}
      {!!notice && <Text style={{ color: '#FFD18E' }}>{notice}</Text>}
    </View>,
  });
}
