import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Progress } from './progression';

export function PlayGuide({ progress, saveMode, onQuests, onGems }: { progress: Progress; saveMode: 'local' | 'practice' | 'server'; onQuests: () => void; onGems: () => void }) {
  const ko = progress.language === 'ko';
  const confirmed = progress.receipt?.status === 'confirmed';
  const rows = ko ? [
    ['1 · 탭과 수집 사이의 선택', '나무를 탭해 목재를 만들고, 드래그로 회수하세요. 수집하는 동안은 공격할 수 없고 떨어진 목재는 5초 후 사라져요.'],
    ['2 · 짧게 플레이하고 성장하기', saveMode === 'server' ? '피로도가 가득 차면 쉬어 가세요. 목재는 고목에, 코인은 선택한 도끼 강화에 사용해요. 특성·보석은 서버 저장에 아직 연결되지 않았어요.' : '피로도가 가득 차면 쉬어 가세요. 목재는 고목·특성·보석에, 코인은 선택한 도끼 강화에 사용해요.'],
    ['3 · 플레이 후 지갑 연결', saveMode === 'server' ? '서버 로그인은 처음 한 번 지갑 서명이 필요해요. 서버 계정에서 목재 20개를 회수하면 지갑 퀘스트가 열려요. 타격마다 지갑 승인은 필요하지 않아요.' : saveMode === 'practice' ? '연습 후 서버 저장을 시작하려면 지갑으로 별도 로그인하세요. 연습 목재와 레벨은 서버 계정으로 옮겨지지 않아요.' : '목재 20개를 회수하면 지갑 연결이 열려요. 퀘스트를 따라 Devnet 성장 기록을 남기고 확인된 보상을 수령하세요. 매 타격마다 지갑 승인이 필요하지 않아요.'],
    ['4 · 원하는 장비 조합 만들기', saveMode === 'server' ? '첫 기록 보상 도끼를 장착하고 강화해 보세요. 보석과 옵션 변경은 서버 저장에서 아직 사용할 수 없어요.' : '보석은 개봉하거나 합성할 수 있어요. 옵션 장착은 소모형이며 기존 옵션을 덮으면 되돌릴 수 없어요.'],
  ] : [
    ['1 · Choose when to chop or collect', 'Tap the tree to drop wood, then drag to collect it. You cannot attack while collecting. Dropped wood disappears after 5 seconds.'],
    ['2 · Short sessions, lasting progress', saveMode === 'server' ? 'Rest when fatigue fills. Spend wood on trees and coins on the selected axe. Talents and gems are not connected to server saves yet.' : 'Rest when fatigue fills. Spend wood on trees, talents and gems; spend coins to upgrade the selected axe.'],
    ['3 · Play first, connect later', saveMode === 'server' ? 'Sign with your wallet once to enter the server account. Collect 20 wood there to unlock the wallet quest. Hits do not require wallet approval.' : saveMode === 'practice' ? 'Sign in with your wallet to start a separate server save. Practice wood and levels are not uploaded.' : 'Collect 20 wood to unlock wallet connection. Follow quests to record growth on Devnet, then claim confirmed rewards. No wallet approval is needed for each hit.'],
    ['4 · Build your loadout', saveMode === 'server' ? 'Equip and upgrade the First Record Axe. Gems and option changes are not available in server saves yet.' : 'Open gems or fuse them into higher tiers. Equipping an option consumes it and permanently replaces the previous option.'],
  ];
  return <View style={s.root}>
    <Text style={s.title}>{ko ? '플레이 가이드' : 'How to play'}</Text>
    <Text style={s.text}>{ko ? '탭하고, 수집하고, 나만의 도끼를 성장시키는 모바일 벌목 게임.' : 'A mobile woodcutting game about tapping, collecting and building your own axe loadout.'}</Text>
    {rows.map(([title, body]) => <View key={title} style={s.card}><Text style={s.title}>{title}</Text><Text style={s.text}>{body}</Text></View>)}
    <View style={s.card}>
      <Text style={s.title}>{ko ? '현재 체험 상태' : 'Current demo status'}</Text>
      <Text style={s.text}>{ko ? `첫 수확 ${Math.min(progress.harvested, 20)}/20 · 지갑 ${progress.walletCompleted ? '연결 경험 있음' : '미완료'} · Devnet 기록 ${confirmed ? '확인됨' : '미확인'}` : `First harvest ${Math.min(progress.harvested, 20)}/20 · Wallet ${progress.walletCompleted ? 'previously connected' : 'pending'} · Devnet record ${confirmed ? 'confirmed' : 'not confirmed'}`}</Text>
      <Text style={s.text}>{saveMode === 'server'
        ? (ko ? '지금 진행은 서버에 저장돼요. 기기의 연습 저장과 합쳐지지 않고 랭킹에도 반영되지 않아요.' : 'This progress is saved on the server. It does not merge with local practice or count toward rankings.')
        : saveMode === 'practice'
          ? (ko ? '지금은 기기에만 저장되는 연습 진행이에요. 서버 로그인 시 별도 계정으로 시작하며 이 진행은 업로드되지 않아요.' : 'This is local-only practice. Server login starts a separate account; this progress is not uploaded.')
          : (ko ? '현재 진행은 기기에 저장돼요. Devnet 기록은 플레이 전체의 검증이나 NFT 발행이 아니에요. 실제 구매·서버 랭킹·에어드랍은 아직 제공하지 않아요.' : 'Progress is stored on this device. A Devnet record is not proof of all gameplay or an NFT mint. Live purchases, server rankings and airdrops are not available yet.')}</Text>
    </View>
    <Pressable accessibilityRole="button" style={s.button} onPress={onQuests}><Text style={s.title}>{ko ? '퀘스트로 이어하기' : 'Continue with quests'}</Text></Pressable>
    {saveMode !== 'server' && <Pressable accessibilityRole="button" style={s.button} onPress={onGems}><Text style={s.title}>{ko ? '보석 인벤토리 열기' : 'Open gem inventory'}</Text></Pressable>}
  </View>;
}
const s = StyleSheet.create({ root: { gap: 12 }, card: { padding: 14, gap: 8, borderRadius: 14, backgroundColor: '#183D3D' }, title: { color: '#E6EFDD', fontWeight: '800', fontSize: 15 }, text: { color: '#B9D5CC', lineHeight: 21, fontSize: 13 }, button: { padding: 14, minHeight: 48, borderRadius: 12, backgroundColor: '#29524C' } });
