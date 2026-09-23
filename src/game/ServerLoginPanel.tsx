import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
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
import { deployment } from '../deployment';
import { createLiveInputQueue } from './live-input-queue';
import { canLeaveServer, canQueueServerHit } from './server-input-policy';
import { clearServerSession, readServerSession, writeServerSession } from './server-session';
import type { PlayerSnapshot, GameCommand, CommandRequest } from '../shared/server-contract';

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
  snapshot: PlayerSnapshot | null; busy: boolean; queued: number; pending: boolean; now: number;
  canChop: boolean; controls: ReactNode; notice: string;
  connect: () => void;
  hit: () => boolean; command: (command: GameCommand) => boolean; dragging: (value: boolean) => void;
  record: () => Promise<void>; checkRecord: () => Promise<void>;
};
export function ServerLoginPanel({ language, renderMain }: { language: 'ko' | 'en'; renderMain: (controller: ServerController) => ReactNode }) {
  const ko = language === 'ko', token = useRef<string | null>(sessionCache.token), lock = useRef(false);
  const [busy, setBusy] = useState(false), [restoring, setRestoring] = useState(true);
  const [state, setState] = useState<PlayerSnapshot | null>(sessionCache.state), [notice, setNotice] = useState('');
  const inputQueue = useRef(createLiveInputQueue());
  const readyAt = useRef(0), foreground = useRef(true);
  const pump = useRef<() => void>(() => {});
  const queueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [queued, setQueued] = useState(0);
  const collecting = useRef(false);
  const [dragging, setDragging] = useState(false);
  const setCollecting = (value: boolean) => { collecting.current = value; setDragging(value); };
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
  const updateState = (value: PlayerSnapshot | null) => { if (value?.serverTime !== undefined) serverClockOffset = value.serverTime - Date.now(); sessionCache.state = value; setState(value); };
  // Expiry must not silently switch a server player into the local economy.
  const expireSession = async () => {
    token.current = null; sessionCache.token = null; sessionCache.pending = null;
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
          const authorization = await wallet.authorize({ chain: 'solana:devnet', identity: APP_IDENTITY });
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
        const recovered = await recoverServerRecord((path, payload) => api(path, payload, token.current!), pendingServerRecord);
        if (recovered.snapshot) updateState(recovered.snapshot);
        setNotice([recordRecoveryNotice(recovered.status, ko), storageWarning].filter(Boolean).join('\n'));
      } catch (error) {
        if (error instanceof Error && error.message === 'UNAUTHENTICATED') await expireSession();
        setNotice([ko ? '서버 진행은 불러왔지만 기록 상태 확인은 완료하지 못했어요. 새 거래를 보내지 않았어요. 메뉴에서 기록 상태를 다시 확인해 주세요.' : 'Server progress loaded, but record recovery could not finish. No new transaction was sent. Recheck record status from the menu.', storageWarning].filter(Boolean).join('\n'));
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
      const beforeHarvested = sessionCache.state.progress.harvested;
      const beforeCoins = sessionCache.state.progress.coins;
      const response = await api('/commands', sessionCache.pending, token.current);
      readyAt.current = Date.now() + (sentType === 'collectDrop' ? 250 : 150);
      sessionCache.pending = null;
      updateState(response);
      if (sentType === 'collectDrop') {
        const collected = response.progress.harvested - beforeHarvested;
        if (beforeHarvested < 20 && response.progress.harvested >= 20) setNotice(translate(language, 'firstHarvestReady'));
        else if (collected > 0) setNotice(translate(language, 'collected', collected));
      }
      if (sentType === 'acknowledgeWallet' && response.walletCoinRewardClaimed && response.progress.coins - beforeCoins === 20)
        setNotice(translate(language, 'walletCoinGranted'));
      if (sentType === 'claimFirstRecord' && response.progress.firstRecordClaimed)
        setNotice(translate(language, 'firstRecordRewardReceived'));
      // Response already contains authoritative state. Re-read only on an explicit refresh/conflict.
      if (retrying) updateState(await api('/me', undefined, token.current));
    } catch (error) {
      inputQueue.current.clear(); setQueued(0);
      const code = error instanceof Error ? error.message : 'NETWORK';
      if (code === 'UNAUTHENTICATED') await expireSession();
      else if (['INVALID_COMMAND', 'ACTION_TOO_FAST', 'DROP_UNAVAILABLE', 'ACTION_UNAVAILABLE', 'REVISION_CONFLICT', 'REQUEST_ID_REUSED', 'RATE_LIMITED'].includes(code)) {
        sessionCache.pending = null;
        try { updateState(await api('/me', undefined, token.current!)); } catch { /* keep prior view, never grant locally */ }
      }
      setNotice(ko ? '처리를 완료하지 못했어요. 잠시 후 다시 시도해 주세요. 응답이 불확실하면 같은 요청으로 재확인하며 로컬 보상은 지급하지 않아요.' : 'Action did not finish. Retry shortly. Uncertain requests reuse the same ID; no local rewards are granted.');
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
    if (command.type === 'claimFirstRecord' || command.type === 'acknowledgeWallet') {
      if (sessionCache.pending?.command.type === command.type || inputQueue.current.hasType(command.type)) return false;
      if (command.type === 'claimFirstRecord' && sessionCache.state?.progress.firstRecordClaimed) return false;
      if (command.type === 'acknowledgeWallet' && sessionCache.state?.walletCoinRewardClaimed) return false;
    }
    if (command.type === 'collectDrop' && sessionCache.pending?.command.type === 'collectDrop' && sessionCache.pending.command.dropId === command.dropId) return true;
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
    setNotice(ko ? 'Devnet 기록을 확인하고 있어요. 실제 SOL 결제가 아니에요.' : 'Checking your Devnet record. This is not a real SOL purchase.');
    try {
      const intent = await api('/record/prepare', {}, token.current);
      const signature = intent.signature ?? pendingServerRecord(intent.memo);
      if (signature) await api('/record/submit', { signature }, token.current);
      else {
        await recordHarvest(intent.wallet, async submitted => {
          // Keep the recovery receipt even when submission to the API fails.
          savePendingServerRecord(intent.memo, submitted);
          await api('/record/submit', { signature: submitted }, token.current!);
        }, intent.memo);
      }
      const result = await api('/record/check', {}, token.current);
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
      const recovered = await recoverServerRecord((path, payload) => api(path, payload, token.current!), pendingServerRecord);
      if (recovered.snapshot) updateState(recovered.snapshot);
      setNotice(recordRecoveryNotice(recovered.status, ko) || (ko ? '제출된 기록이 없어요. 퀘스트에서 첫 기록을 진행해 주세요.' : 'No submitted record found. Start First Record from Quests.'));
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHENTICATED') await expireSession();
      setNotice(ko ? '기록을 확인하지 못했어요. 잠시 후 다시 확인해 주세요. 거래를 다시 보내거나 보상을 지급하지 않았어요.' : 'Could not check the record. Try again shortly. No transaction was resent and no reward was granted.');
    } finally { lock.current = false; setBusy(false); }
  };
  const input = { busy: busy || restoring, queued, pending: sessionCache.pending?.command.type ?? null, dragging };
  const navigationLocked = !canLeaveServer(input);
  const button = (text: string, logout: boolean) => <Pressable accessibilityRole="button" disabled={navigationLocked} onPress={() => void run(logout)} style={{ padding: 12, minHeight: 44, backgroundColor: '#29524C', borderRadius: 10, opacity: navigationLocked ? 0.5 : 1 }}><Text style={{ color: '#E6EFDD' }}>{text}</Text></Pressable>;
  return renderMain({ snapshot: state, busy: busy || restoring, queued, pending: sessionCache.pending !== null,
    get now() { return Date.now() + serverClockOffset; }, canChop: !!token.current && canQueueServerHit(input), notice,
    connect: () => { if (!restoring) void run(false); },
    hit: enqueueHit, dragging: setCollecting, record, checkRecord,
    command: command => !collecting.current && enqueue(command),
    controls: <View style={{ gap: 10 }}>
      <Text style={{ color: '#B9D5CC' }}>{ko ? '서버 저장 연결 · Devnet 테스트. 기존 로컬 저장과 별도이며 랭킹에는 반영되지 않아요.' : 'Server save connection · Devnet test. Separate from the local save; not ranked.'}</Text>
      {button(token.current ? (ko ? '서버 상태 새로고침' : 'Refresh server state') : (ko ? '서버 저장 연결 · 지갑 서명' : 'Connect server save · Sign with wallet'), false)}
      {state && button(ko ? '서버 로그아웃 · 로컬 저장 복귀' : 'Sign out · Restore local save', true)}
      {state && token.current && <Pressable accessibilityRole="button" disabled={navigationLocked} onPress={() => void checkRecord()} style={{ padding: 12 }}><Text style={{ color: '#E6EFDD' }}>{ko ? '기록 상태 확인 · 거래 재전송 없음' : 'Check record status · No resend'}</Text></Pressable>}
      {sessionCache.pending && !busy && <Pressable accessibilityRole="button" onPress={() => void action()} style={{ padding: 12 }}><Text style={{ color: '#FFD18E' }}>{ko ? '미확인 요청 재확인' : 'Retry pending request'}</Text></Pressable>}
      {!!notice && <Text style={{ color: '#FFD18E' }}>{notice}</Text>}
    </View>,
  });
}
