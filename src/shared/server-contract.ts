import type { GemTier, OptionId, Progress } from '../game/progression';
import type { PaymentCurrency, ProductId } from './catalog';
import type { CommunityQuestId, CommunityFacilityId, CommunitySnapshot } from './community';
import type { WorldBossSnapshot } from './world-boss';
import type { SquirrelSnapshot } from './pets';
export type GameCommand = { type: 'fuse'; tier: GemTier } | { type: 'drawGem' } | { type: 'claimWardenReward' }
  | { type: 'useFatiguePotion' }
  | { type: 'claimForestTrail'; stage: number }
  | { type: 'plantFarmSeed'; plot: 0 | 1 } | { type: 'activateBlessing' }
  | { type: 'startFarmPuzzle'; plot: 0 | 1 } | { type: 'finishFarmPuzzle'; rotations: number[] } | { type: 'claimFarmTree'; plot: 0 | 1 }
  | { type: 'claimSquirrel' } | { type: 'dispatchSquirrel'; destination: CommunityFacilityId } | { type: 'collectSquirrel' }
  | { type: 'hitWorldBoss' }
  | { type: 'claimWorldBossReward'; weekStart: number; stage: number }
  | { type: 'claimWorldBossSharedReward'; weekStart: number; stage: number }
  | { type: 'claimCommunityQuest'; questId: CommunityQuestId }
  | { type: 'contributeCommunity'; facility: CommunityFacilityId; amount: number }
  | { type: 'claimGrowthReward' } | { type: 'openGem'; tier: GemTier } | { type: 'equipOption'; slot: 0 | 1; item: OptionId }
  | { type: 'hit' } | { type: 'hitBatch'; count: number } | { type: 'collectDrop'; dropId: string }
  | { type: 'loadTrolley'; dropId: string } | { type: 'loadTrolleyBatch'; dropIds: string[] } | { type: 'collectTrolley' } | { type: 'recover' } | { type: 'regrow' } | { type: 'upgradeTree' }
  | { type: 'upgradeAxe' } | { type: 'equipAxe'; skin: Progress['axeSkin'] }
  | { type: 'acknowledgeWallet' } | { type: 'claimFirstRecord' } | { type: 'claimAdventure'; stage: number };
export type CommandRequest = { requestId: string; expectedRevision: number; command: GameCommand };
export type ServerDrop = { id: string; value: number; expiresAt: number };
export type PlayerSnapshot = { revision: number; provenance: 'local-test' | 'server'; progress: Progress;
  community?: CommunitySnapshot;
  worldBoss?: WorldBossSnapshot;
  squirrel?: SquirrelSnapshot;
  drops?: ServerDrop[]; serverTime?: number; lastDamage?: number; walletCoinRewardClaimed?: boolean;
  lastBossDamage?: number; lastBossCritical?: boolean;
  hitEvents?: { hit: number; damage: number; critical: boolean }[] };
// Account identity must come from authenticated server sessions, not command payloads.
export interface GameGateway {
  load(): Promise<PlayerSnapshot>;
  execute(request: CommandRequest): Promise<PlayerSnapshot>;
}
export type PurchaseRequest = { requestId: string; productId: ProductId; currency: PaymentCurrency };
export type OrderQuote = {
  orderId: string; productId: ProductId; currency: PaymentCurrency;
  cluster: 'devnet' | 'mainnet-beta'; recipient: string;
  amountBaseUnits: string; mint: string | null; expiresAt: number;
};
export type RankingCategory = 'forest' | 'axeMastery' | 'seasonChallenge';
export type RankingEntry = { playerId: string; displayName: string; rank: number; score: number };
export type Leaderboard = { seasonId: string; category: RankingCategory; asOf: number; entries: RankingEntry[] };
