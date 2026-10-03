import { characterLevel, GEM_TIERS, type Progress } from '../game/progression.ts';
import type { GameCommand, PlayerSnapshot } from '../shared/server-contract';
export type AudioSettings = { music: boolean; effects: boolean };
export function parseAudioSettings(raw: string | null): AudioSettings {
  try {
    const data = JSON.parse(raw ?? 'null');
    if (data?.version === 1 && typeof data.music === 'boolean' && typeof data.effects === 'boolean')
      return { music: data.music, effects: data.effects };
  } catch { /* Audio preferences never invalidate a game save. */ }
  return { music: true, effects: true };
}
export const CUES = {
  click: { group: 'ui', gap: 90, volume: 0.32 }, open: { group: 'ui', gap: 120, volume: 0.3 },
  close: { group: 'ui', gap: 120, volume: 0.25 }, select: { group: 'ui', gap: 100, volume: 0.32 },
  map: { group: 'ui', gap: 160, volume: 0.3 }, chop: { group: 'attack', gap: 180, volume: 0.8 },
  bossHit: { group: 'attack', gap: 180, volume: 0.6 }, felled: { group: 'attack', gap: 180, volume: 0.55 },
  collect: { group: 'wood', gap: 180, volume: 0.38 }, load: { group: 'wood', gap: 180, volume: 0.4 },
  drop: { group: 'wood', gap: 200, volume: 0.5 },
  unload: { group: 'wood', gap: 250, volume: 0.45 }, trolley: { group: 'action', gap: 500, volume: 0.32 },
  coins: { group: 'reward', gap: 300, volume: 0.38 }, upgrade: { group: 'reward', gap: 450, volume: 0.22 },
  reward: { group: 'reward', gap: 450, volume: 0.45 }, magic: { group: 'reward', gap: 400, volume: 0.4 },
  unavailable: { group: 'ui', gap: 1600, volume: 0.22 }, confirm: { group: 'reward', gap: 250, volume: 0.35 },
  pet: { group: 'action', gap: 400, volume: 0.35 }, plant: { group: 'action', gap: 300, volume: 0.4 },
  water: { group: 'action', gap: 400, volume: 0.3 },
} as const;
export type SoundCue = keyof typeof CUES;
// Called for confirmed mutations only, never save loading/refresh. One reward
// cue/response prevents several currencies from producing overlapping jingles.
export function progressCues(before: Progress, after: Progress): SoundCue[] {
  if (before === after) return [];
  if ((after.fatiguePotionsUsed ?? 0) > (before.fatiguePotionsUsed ?? 0)) return ['magic'];
  if ((after.farm?.blessingUntil ?? 0) > (before.farm?.blessingUntil ?? 0)) return ['magic'];
  if (after.farm?.plots.some((plot, i) => plot && plot.readyAt > 0 && before.farm?.plots[i]?.readyAt === 0)) return ['water'];
  if ((after.farm?.grown ?? 0) > (before.farm?.grown ?? 0)) return ['magic'];
  if (after.farm?.plots.some((plot, i) => plot && plot.plantedAt !== before.farm?.plots[i]?.plantedAt)) return ['plant'];
  if ((!before.firstRecordClaimed && after.firstRecordClaimed) || (!before.growthRewardClaimed && after.growthRewardClaimed) ||
      after.adventureClaimed > before.adventureClaimed || (after.forestTrailClaimed ?? 0) > (before.forestTrailClaimed ?? 0) || (after.wardenRewardsClaimed ?? 0) > (before.wardenRewardsClaimed ?? 0) ||
      characterLevel(after.xp) > characterLevel(before.xp)) return ['reward'];
  if (after.inventory.length > before.inventory.length || (after.woodGemDraws ?? 0) > (before.woodGemDraws ?? 0)) return ['magic'];
  const gemsUsed = GEM_TIERS.reduce((sum, tier) => sum + Math.max(0, before.gems[tier] - after.gems[tier]), 0);
  if (gemsUsed >= 3) return [GEM_TIERS.some(tier => after.gems[tier] > before.gems[tier]) ? 'magic' : 'unavailable'];
  if (after.treeLevel > before.treeLevel || (before.axeSkin === after.axeSkin && after.axeLevel > before.axeLevel)) return ['upgrade'];
  if (after.axeSkin !== before.axeSkin || after.slots.some((slot, i) => slot !== before.slots[i])) return ['select'];
  if (after.trolleyTrip && after.trolleyTrip.departedAt !== before.trolleyTrip?.departedAt) return ['trolley'];
  if (before.trolleyTrip && before.trolleyWood > 0 && after.trolleyWood === 0 && after.harvested > before.harvested) return ['unload'];
  if (after.trolleyWood > before.trolleyWood) return ['load'];
  if (before.treeHp > 0 && after.treeHp === 0) return ['felled'];
  if (after.harvested > before.harvested) return ['collect'];
  // Random automatic +1 coin hits deliberately stay quiet.
  if (after.coins > before.coins && after.totalHits === before.totalHits) return ['coins'];
  return [];
}
export function serverCues(before: PlayerSnapshot, after: PlayerSnapshot, command: GameCommand): SoundCue[] {
  if (after.revision <= before.revision) return [];
  if (command.type === 'claimWorldBossReward' || command.type === 'claimWorldBossSharedReward') return ['reward'];
  if (command.type === 'dispatchSquirrel' && after.squirrel?.trip && after.squirrel.trip.departedAt !== before.squirrel?.trip?.departedAt) return ['pet'];
  if (command.type === 'collectSquirrel' && before.squirrel?.trip && !after.squirrel?.trip)
    return [before.squirrel.trip.destination === 'mine' ? 'coins' : 'collect'];
  if (command.type === 'claimSquirrel' && !before.squirrel?.owned && after.squirrel?.owned) return ['reward'];
  if (command.type === 'claimCommunityQuest' && after.community && before.community && after.community.materials > before.community.materials) return ['reward'];
  if (command.type === 'contributeCommunity' && after.community && before.community && after.community.materials < before.community.materials)
    return [after.community.facilities.some(f => f.level > (before.community!.facilities.find(old => old.id === f.id)?.level ?? f.level)) ? 'upgrade' : 'confirm'];
  return progressCues(before.progress, after.progress);
}
