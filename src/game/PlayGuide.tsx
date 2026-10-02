import { StyleSheet, Text, View } from 'react-native';
import { SoundPressable as Pressable } from '../audio/GameAudio';
import { attackIntervalMs, type Progress } from './progression';

export function PlayGuide({ progress, saveMode, onQuests, onGems }: { progress: Progress; saveMode: 'local' | 'practice' | 'server'; onQuests: () => void; onGems: () => void }) {
  const ko = progress.language === 'ko';
  const secondsPerHit = attackIntervalMs(progress) / 1000;
  const confirmed = progress.mainnetReceipt?.status === 'confirmed';
  const rows = ko ? [
    ['1 · 벌목과 수집 사이의 선택', `나무를 길게 눌러 ${secondsPerHit}초마다 벌목하세요. 목재 하나를 왼쪽 보관함에 드롭하면 즉시 회수해요. 여러 목재를 쓸어 지나가면 트롤리에 실려요. 수레 용량은 일반 고목 최대 HP의 약 1/3이며, 보스 HP로 늘어나지 않아요. 실리지 않은 목재는 보관함으로 직접 옮길 수 있어요. 트롤리를 누르면 3초 동안 보관함으로 이동한 뒤 목재가 들어오고, 빈 수레는 2초에 걸쳐 돌아와요. 바닥 목재는 5초 뒤 사라지고, 드래그 중에는 벌목할 수 없어요.`],
    ['2 · 짧게 플레이하고 성장하기', saveMode === 'server' ? '피로도가 가득 차면 쉬어 가세요. 목재는 고목 강화와 보석 뽑기에, 코인은 선택한 도끼 강화에 사용해요.' : '피로도가 가득 차면 쉬어 가세요. 목재는 고목·특성·보석에, 코인은 선택한 도끼 강화에 사용해요.'],
    ['3 · 무료 지갑 연결과 성장 보상', '지갑 연결은 Mainnet 지갑의 무료 메시지 서명이에요. 거래나 SOL 수수료는 없어요. 첫 성장 도끼도 기록 없이 받아요. 서버 저장의 기념 기록은 선택이며 실제 SOL 네트워크 수수료가 필요해요. 취소하거나 나중에 해도 불이익이 없어요. 연습 진행은 서버로 옮겨지지 않아요.'],
    ['4 · 원하는 장비 조합 만들기', saveMode === 'server' ? '서버 저장에서도 보석을 개봉·합성하거나 목재로 뽑을 수 있어요. 확률 결과와 재화 차감은 서버에서 확정돼요. 옵션 장착은 소모형이며 덮어쓴 옵션은 돌아오지 않아요.' : '보석은 개봉하거나 합성할 수 있어요. 옵션 장착은 소모형이며 기존 옵션을 덮으면 되돌릴 수 없어요.'],
  ] : [
    ['1 · Choose when to chop or collect', `Hold the tree to chop once every ${secondsPerHit} second${secondsPerHit === 1 ? '' : 's'}. Drop one log in the left storage box to collect it immediately. Sweep across logs to load the trolley. Its capacity is about one third of the ordinary tree's maximum HP; boss HP does not increase it. Logs that do not fit can go directly to storage. Tap the trolley to travel 3 seconds to storage, where the wood is credited. The empty trolley returns in 2 seconds. Ground logs expire after 5 seconds, and you cannot chop while dragging.`],
    ['2 · Short sessions, lasting progress', saveMode === 'server' ? 'Rest when fatigue fills. Spend wood on tree upgrades and gem draws; spend coins to upgrade the selected axe.' : 'Rest when fatigue fills. Spend wood on trees, talents and gems; spend coins to upgrade the selected axe.'],
    ['3 · Free wallet login and growth rewards', 'Login uses a free message signature with your Mainnet wallet, not a transaction. Claim the growth axe without recording. Server-save commemorative records are optional and require a real SOL network fee. Cancel or record later without any disadvantage. Practice progress is not uploaded.'],
    ['4 · Build your loadout', saveMode === 'server' ? 'Open or fuse gems and draw more with wood in server saves. The server confirms random results and resource spending. Equipping an option consumes it; replacing one does not return the old option.' : 'Open gems or fuse them into higher tiers. Equipping an option consumes it and permanently replaces the previous option.'],
  ];
  return <View style={s.root}>
    <Text style={s.title}>{ko ? '플레이 가이드' : 'How to play'}</Text>
    <Text style={s.text}>{ko ? '길게 눌러 벌목하고, 수집하고, 나만의 도끼를 성장시키는 모바일 게임.' : 'A mobile woodcutting game about holding to chop, collecting and building your own axe loadout.'}</Text>
    <Text style={s.text}>{ko ? '두 번째 슬롯 장착 퀘스트 보상으로 피로회복제 1개를 받아요. 하단 목표 왼쪽 🧪 버튼에서 확인 후 사용하면 피로도가 0%가 돼요. 0개이거나 이미 피로도 0%면 사용할 수 없어요.' : 'The second-slot quest awards 1 recovery potion. Tap 🧪 to the left of your current goal and confirm to reset fatigue to 0%. You cannot use it with no potion or when already fresh.'}</Text>
    {rows.map(([title, body]) => <View key={title} style={s.card}><Text style={s.title}>{title}</Text><Text style={s.text}>{body}</Text></View>)}
    <View style={s.card}>
      <Text style={s.title}>{ko ? '현재 체험 상태' : 'Current demo status'}</Text>
      <Text style={s.text}>{ko ? `첫 수확 ${Math.min(progress.harvested, 20)}/20 · 지갑 ${progress.walletCompleted ? '연결 경험 있음' : '미완료'} · Mainnet 기념 기록 ${confirmed ? '확인됨' : '선택 · 미기록'}` : `First harvest ${Math.min(progress.harvested, 20)}/20 · Wallet ${progress.walletCompleted ? 'previously connected' : 'pending'} · Mainnet record ${confirmed ? 'confirmed' : 'optional · not recorded'}`}</Text>
      <Text style={s.text}>{saveMode === 'server'
        ? (ko ? '지금 진행은 서버에 저장돼요. 기기의 연습 저장과 합쳐지지 않고 랭킹에도 반영되지 않아요.' : 'This progress is saved on the server. It does not merge with local practice or count toward rankings.')
        : saveMode === 'practice'
          ? (ko ? '지금은 기기에만 저장되는 연습 진행이에요. 서버 로그인 시 별도 계정으로 시작하며 이 진행은 업로드되지 않아요.' : 'This is local-only practice. Server login starts a separate account; this progress is not uploaded.')
          : (ko ? '현재 진행은 기기에 저장돼요. 기념 기록은 NFT 발행이나 모든 플레이의 온체인 증명이 아니에요. 서버 저장에서만 선택할 수 있어요.' : 'Progress is stored on this device. A commemorative record is not an NFT mint or proof of all gameplay. It is optional in server saves only.')}</Text>
    </View>
    <Pressable accessibilityRole="button" style={s.button} onPress={onQuests}><Text style={s.title}>{ko ? '퀘스트로 이어하기' : 'Continue with quests'}</Text></Pressable>
    <Pressable accessibilityRole="button" style={s.button} onPress={onGems}><Text style={s.title}>{ko ? '보석 인벤토리 열기' : 'Open gem inventory'}</Text></Pressable>
  </View>;
}
const s = StyleSheet.create({ root: { gap: 12 }, card: { padding: 14, gap: 8, borderRadius: 14, backgroundColor: '#183D3D' }, title: { color: '#E6EFDD', fontWeight: '800', fontSize: 15 }, text: { color: '#B9D5CC', lineHeight: 21, fontSize: 13 }, button: { padding: 14, minHeight: 48, borderRadius: 12, backgroundColor: '#29524C' } });
