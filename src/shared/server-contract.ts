import type { GemTier, Progress } from '../game/progression';
import type { PaymentCurrency, ProductId } from './catalog';
export type GameCommand = { type: 'fuse'; tier: GemTier } | { type: 'drawGem' } | { type: 'claimWardenReward' }
  | { type: 'hit' } | { type: 'hitBatch'; count: number } | { type: 'collectDrop'; dropId: string } | { type: 'recover' } | { type: 'regrow' } | { type: 'upgradeTree' }
  | { type: 'upgradeAxe' } | { type: 'equipAxe'; skin: Progress['axeSkin'] }
  | { type: 'acknowledgeWallet' } | { type: 'claimFirstRecord' };
export type CommandRequest = { requestId: string; expectedRevision: number; command: GameCommand };
export type ServerDrop = { id: string; value: number; expiresAt: number };
export type PlayerSnapshot = { revision: number; provenance: 'local-test' | 'server'; progress: Progress;
  drops?: ServerDrop[]; serverTime?: number; lastDamage?: number; walletCoinRewardClaimed?: boolean;
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
