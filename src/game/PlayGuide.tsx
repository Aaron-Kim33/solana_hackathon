import { StyleSheet, Text, View } from 'react-native';
import { SoundPressable as Pressable } from '../audio/GameAudio';
import { attackIntervalMs, type Progress } from './progression';

export function PlayGuide({ progress, saveMode, onQuests, onGems }: { progress: Progress; saveMode: 'local' | 'practice' | 'server'; onQuests: () => void; onGems: () => void }) {
  const ko = progress.language === 'ko';
  const secondsPerHit = attackIntervalMs(progress) / 1000;
  const confirmed = progress.mainnetReceipt?.status === 'confirmed';
  const rows = ko ? [
    ['1 · 꾹 눌러 벌목', `나무를 길게 누르면 ${secondsPerHit}초마다 도끼질해요. 바닥 목재는 5초 뒤 사라져요. 드래그 중에는 벌목이 멈춰요.`],
    ['2 · 쓱 모아 수집', '목재를 보관함에 드롭하면 즉시 수집해요. 여러 개를 쓸면 트롤리에 실려요. 가득 찼다면 남은 목재는 직접 옮겨 주세요. 트롤리를 누르면 3초 뒤 보관함에 도착하고, 2초 뒤 돌아와요.'],
    ['3 · 조금씩 성장', saveMode === 'server' ? '목재로 고목과 보석을, 코인으로 도끼를 성장시켜요. 피로도가 차면 쉬거나 하단 🧪에서 피로회복제를 사용하세요.' : '목재로 고목·특성·보석을, 코인으로 도끼를 성장시켜요. 피로도가 차면 쉬거나 하단 🧪에서 피로회복제를 사용하세요.'],
    ['4 · 숲 너머로', '지도가 열리면 공동 숲·월드보스·묘목 농장을 만나 보세요. 공동 시설을 키우면 새로 출발하는 다람쥐의 탐험 보상이 늘어요.'],
    ['5 · 나만의 도끼', '보석을 개봉·합성하거나 목재로 뽑아 옵션을 얻어요. 옵션 장착은 소모형이며, 덮어쓴 옵션은 돌아오지 않아요.'],
  ] : [
    ['1 · Hold to chop', `Hold the tree to swing every ${secondsPerHit} seconds. Ground logs disappear after 5 seconds. Chopping pauses while you drag.`],
    ['2 · Sweep to collect', 'Drop logs in storage to collect immediately. Sweep across several to load the trolley. If full, move the rest directly to storage. Tap the trolley: 3 seconds to deliver, 2 seconds to return.'],
    ['3 · Grow a little every day', saveMode === 'server' ? 'Use wood for tree upgrades and gems; coins for axe upgrades. Rest when tired, or use a recovery potion with the bottom 🧪 button.' : 'Use wood for trees, talents and gems; coins for axes. Rest when tired, or use a recovery potion with the bottom 🧪 button.'],
    ['4 · Beyond your forest', 'Unlock the map to explore the community forest, world boss and sapling farm. Growing shared facilities improves rewards for new squirrel expeditions.'],
    ['5 · Your own axe', 'Open or fuse gems, or draw with wood, to find options. Equipping consumes the option; replacing one never returns the previous option.'],
  ];
  return <View style={s.root}>
    <Text style={s.title}>{ko ? '플레이 가이드' : 'How to play'}</Text>
    <Text style={s.text}>{ko ? '길게 눌러 벌목하고, 수집하고, 나만의 도끼를 성장시키는 모바일 게임.' : 'A mobile woodcutting game about holding to chop, collecting and building your own axe loadout.'}</Text>
    {rows.map(([title, body]) => <View key={title} style={s.card}><Text style={s.title}>{title}</Text><Text style={s.text}>{body}</Text></View>)}
    <View style={s.card}>
      <Text style={s.title}>{ko ? '저장과 지갑' : 'Saves & wallet'}</Text>
      <Text style={s.text}>{ko ? '지갑 연결은 무료 메시지 서명이며 SOL 수수료가 없어요. 첫 성장 도끼도 기록 없이 받아요. Mainnet 기념 기록만 선택형 유료 거래예요. 실제 SOL 네트워크 수수료가 필요하며, 취소해도 성장에는 불이익이 없어요. NFT나 전체 플레이의 온체인 증명은 아니에요.' : 'Wallet login is a free message signature with no SOL fee. Claim your growth axe without recording. Only the optional Mainnet commemorative record is a paid transaction with a real SOL network fee. Cancelling never blocks growth. It is not an NFT or proof of all gameplay.'}</Text>
      {confirmed && <Text style={s.text}>{ko ? 'Mainnet 기념 기록이 확인됐어요.' : 'Mainnet commemorative record confirmed.'}</Text>}
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
