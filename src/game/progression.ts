export const RECOVERY_MS = 30 * 60 * 1000;
export const AXE_MAX = 200;
export const CHARACTER_MAX = 200;
export const TREE_MAX = 1000;
export const BOUNTIFUL_CHANCE = 0.1;
// Developer samples only; acquisition and economy balance are not final.
export const OPTION_ITEMS = {
  damage: { damage: 2, critChance: 0, critDamage: 0 },
  critChance: { damage: 0, critChance: 2, critDamage: 0 },
  critDamage: { damage: 0, critChance: 0, critDamage: 10 },
} as const;
export type OptionKind = keyof typeof OPTION_ITEMS;
export const GEM_TIERS = ['low', 'medium', 'high', 'supreme', 'legendary'] as const;
export type GemTier = typeof GEM_TIERS[number];
export const GEM_VALUES: Record<GemTier, { damage: number; critChance: number; critDamage: number }> = {
  low: { damage: 3, critChance: 1, critDamage: 13 },
  medium: { damage: 15, critChance: 5, critDamage: 65 },
  high: { damage: 30, critChance: 10, critDamage: 130 },
  supreme: { damage: 60, critChance: 20, critDamage: 260 },
  legendary: { damage: 120, critChance: 40, critDamage: 520 },
};
export const WOOD_GEM_COST = 10000;
export const GEM_FUSION_COST = 3;
export const GEM_FUSION_CHANCE = 0.2;
export function fuseLowGems(state: Progress, random: () => number = Math.random) {
  return fuseGems(state, 'low', random);
}
export function fuseGems(state: Progress, source: GemTier, random: () => number = Math.random) {
  const index = GEM_TIERS.indexOf(source);
  if (index < 0 || index >= GEM_TIERS.length - 1) return null;
  const target = GEM_TIERS[index + 1];
  if (state.gems[source] < GEM_FUSION_COST || !Number.isSafeInteger(state.gems[target] + 1)) return null;
  const roll = random();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
  const success = roll < GEM_FUSION_CHANCE;
  return { success, source, target, state: { ...state, gems: { ...state.gems,
    [source]: state.gems[source] - GEM_FUSION_COST, [target]: state.gems[target] + Number(success) } } };
}
export const WOOD_GEM_ODDS = [
  { tier: 'low', percent: 70 }, { tier: 'medium', percent: 25 }, { tier: 'high', percent: 5 },
] as const;
export function drawWoodGem(state: Progress, random: () => number = Math.random) {
  if (state.wood < WOOD_GEM_COST) return null;
  const roll = random();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
  let cumulative = 0;
  for (const entry of WOOD_GEM_ODDS) {
    cumulative += entry.percent;
    if (roll * 100 < cumulative) {
      if (!Number.isSafeInteger(state.gems[entry.tier] + 1)) return null;
      return { tier: entry.tier, state: { ...state, wood: state.wood - WOOD_GEM_COST,
        gems: { ...state.gems, [entry.tier]: state.gems[entry.tier] + 1 } } };
    }
  }
  return null;
}
export type OptionId = OptionKind | `${GemTier}:${OptionKind}`;
export function optionInfo(id: OptionId) {
  const [prefix, suffix] = id.split(':');
  const kind = (suffix ?? prefix) as OptionKind;
  const tier = suffix ? prefix as GemTier : null;
  const value = tier ? GEM_VALUES[tier][kind] : OPTION_ITEMS[kind][kind];
  return { kind, tier, value, damage: kind === 'damage' ? value : 0,
    critChance: kind === 'critChance' ? value : 0, critDamage: kind === 'critDamage' ? value : 0 };
}
const emptyGems = (): Record<GemTier, number> => ({ low: 0, medium: 0, high: 0, supreme: 0, legendary: 0 });
const gemDefaults = () => ({ gems: emptyGems(), growthRewardClaimed: false, rewardOption: null as OptionId | null, gemSlotQuestDone: false });
export type Receipt = { address: string; signature: string; status: 'pending' | 'confirmed' | 'failed' };
export type AxeId = 'default' | 'firstRecord' | 'pioneer' | 'warden' | 'recovery';
const adventureDefaults = () => ({ adventureClaimed: 0, xpBonusRemainder: 0 });
export const TALENT_IDS = ['lumber', 'autoCollect', 'learning'] as const;
export type TalentId = typeof TALENT_IDS[number];
export const TALENT_MAX: Record<TalentId, number> = { lumber: 20, autoCollect: 11, learning: 10 };
const talentDefaults = () => ({ talents: { lumber: 0, autoCollect: 0, learning: 0 } });
export const talentCost = (id: TalentId, currentLevel: number) =>
  ({ lumber: 100, autoCollect: 500, learning: 150 }[id]) * (currentLevel + 1) ** 2;
export const talentValue = (id: TalentId, level: number) =>
  id === 'lumber' ? level * 5 : id === 'learning' ? level * 2 : level === 0 ? 0 : 9 + level;
export function upgradeTalent(state: Progress, id: TalentId): Progress {
  if (!TALENT_IDS.includes(id)) return state;
  const level = state.talents[id], cost = talentCost(id, level);
  if (level >= TALENT_MAX[id] || state.wood < cost) return state;
  return { ...state, wood: state.wood - cost, talents: { ...state.talents, [id]: level + 1 } };
}
export type Progress = {
  version: 9; language: 'ko' | 'en'; wood: number; coins: number; harvested: number; xp: number;
  autoPickupTrial?: { startedAt: number };
  bosses?: { first: boolean; gate: boolean };
  wardenRewardsClaimed?: number;
  talents: Record<TalentId, number>;
  unequippedAxeLevels: Partial<Record<AxeId, number>>;
  adventureClaimed: number; xpBonusRemainder: number;
  axeLevel: number; treeLevel: number; treeHp: number; fatigue: number;
  recoveryAt: number | null; walletCompleted: boolean; receipt: Receipt | null;
  slots: [OptionId | null, OptionId | null]; inventory: OptionId[]; totalHits: number;
  firstRecordClaimed: boolean; axeSkin: AxeId; skinQuestHarvestStart: number | null;
  gems: Record<GemTier, number>; growthRewardClaimed: boolean; rewardOption: OptionId | null; gemSlotQuestDone: boolean;
};
export const treeHealth = (level: number) => 200 + level * 100;
export const BOSS_HEALTH = { first: 15000, gate: 60000 } as const;
export function activeBoss(state: Pick<Progress, 'treeLevel' | 'bosses'>): 'first' | 'gate' | null {
  if (!state.bosses) return null; // Legacy progress is grandfathered during loading.
  if (state.treeLevel === 50 && !state.bosses.first) return 'first';
  if (state.treeLevel === 100 && !state.bosses.gate) return 'gate';
  return null;
}
export function encounterHealth(state: Pick<Progress, 'treeLevel' | 'bosses'>) {
  const boss = activeBoss(state);
  return boss ? BOSS_HEALTH[boss] : treeHealth(state.treeLevel);
}
export const treeAppearance = (level: number) => Math.min(19, Math.floor((level - 1) / 50));
export const axeCost = (level: number) => level * 20;
export const treeCost = (level: number) => level * 30;
export const hitXp = (treeLevel: number) => treeLevel;
export const newTreeXp = (treeLevel: number) => treeLevel * 10;
export const treeCoins = (treeLevel: number) => treeLevel * 40;
export const bonusCoins = (treeLevel: number) => Math.ceil(treeLevel / 10);
export const COIN_CHANCE = 0.05;
// Provisional cumulative XP anchors, calibrated against the new coin economy.
const XP_ANCHORS = [[1, 0], [2, 50], [5, 4000], [20, 420000], [100, 22000000], [200, 140000000]] as const;
function calculateXpFloor(level: number): number {
  if (level <= 1) return 0;
  for (let i = 1; i < XP_ANCHORS.length; i++) {
    const [end, amount] = XP_ANCHORS[i];
    if (level > end) continue;
    const [start, previous] = XP_ANCHORS[i - 1];
    if (level === end) return amount;
    const fraction = Math.log((level - 1) / (start - 1)) / Math.log((end - 1) / (start - 1));
    return Math.round(previous * (amount / previous) ** fraction);
  }
  return XP_ANCHORS[XP_ANCHORS.length - 1][1];
}
const XP_FLOORS = Array.from({ length: CHARACTER_MAX }, (_, index) => calculateXpFloor(index + 1));
export const xpFloor = (level: number) => XP_FLOORS[Math.min(CHARACTER_MAX, Math.max(1, level)) - 1];
export const xpRequired = (level: number) => level >= CHARACTER_MAX ? 0 : xpFloor(level + 1) - xpFloor(level);
export const baseDamage = (level: number) => level;
export const woodYield = (damage: number) => Math.floor(Math.round(damage * 100) * 7 / 1000);
export const rollBaseDamage = (level: number, roll: number) => level + (roll < 0.5 ? 0 : roll < 0.8 ? 1 : 2);
export function initialProgress(language: 'ko' | 'en'): Progress {
  return { version: 9, bosses: { first: false, gate: false }, ...talentDefaults(), ...adventureDefaults(), unequippedAxeLevels: {}, ...gemDefaults(), language, wood: 0, coins: 0, harvested: 0, xp: 0, axeLevel: 1, treeLevel: 1,
    treeHp: treeHealth(1), fatigue: 0, recoveryAt: null, walletCompleted: false, receipt: null,
    slots: [null, null], inventory: [], totalHits: 0,
    firstRecordClaimed: false, axeSkin: 'default', skinQuestHarvestStart: null };
}
export function characterLevel(xp: number) {
  let low = 1, high = CHARACTER_MAX;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (xp >= xpFloor(middle)) low = middle; else high = middle - 1;
  }
  return low;
}
export function awardXp(state: Progress, value: number): Progress {
  if (!Number.isSafeInteger(value) || value <= 0) return state;
  const xp = Math.min(xpFloor(CHARACTER_MAX), state.xp + value);
  const leveledUp = characterLevel(xp) > characterLevel(state.xp);
  return { ...state, xp, fatigue: leveledUp ? 0 : state.fatigue, recoveryAt: leveledUp ? null : state.recoveryAt };
}
export const walletUnlocked = (state: Progress) => state.harvested >= 20;
function rawCombatStats(state: Progress) {
  const level = characterLevel(state.xp);
  let damage = firstRecordBonusActive(state) ? 1 : 0, critChance = 2 + (level - 1) * 0.1, critDamage = 105 + (level - 1);
  // Equipment-specific attack is separate from the permanent first-equip reward.
  if (state.firstRecordClaimed && state.axeSkin === 'firstRecord') damage += 2;
  if (pioneerOwned(state) && state.axeSkin === 'pioneer') damage += 98;
  if (wardenOwned(state) && state.axeSkin === 'warden') damage += 249;
  if (recoveryOwned(state) && state.axeSkin === 'recovery') damage += 199;
  critDamage += masteryBonus(state, 'warden');
  for (const id of state.slots) {
    if (!id) continue;
    const option = optionInfo(id);
    damage += option.damage;
    critChance += option.critChance;
    critDamage += option.critDamage;
  }
  return { min: baseDamage(state.axeLevel) + damage, max: baseDamage(state.axeLevel) + damage + (state.axeSkin === 'recovery' ? 0 : state.axeSkin === 'warden' ? 50 : 2),
    critChance: Math.min(100, Math.round(critChance * 10) / 10), critDamage };
}
export function combatStats(state: Progress) {
  const stats = rawCombatStats(state), multiplier = 1 + (talentValue('lumber', state.talents.lumber) + masteryBonus(state, 'default')) / 100;
  return { ...stats, min: Math.round(stats.min * multiplier * 100) / 100, max: Math.round(stats.max * multiplier * 100) / 100 };
}
export function equip(state: Progress, slot: 0 | 1, item: OptionId | null): Progress {
  if (item === null || (slot !== 0 && slot !== 1)) return state;
  const index = state.inventory.indexOf(item);
  if (index < 0 || state.slots[slot] === item) return state;
  if (!state.gemSlotQuestDone && item === state.rewardOption && slot === 1) return state;
  const gemSlotQuestDone = state.gemSlotQuestDone ||
    (slot === 0 && item !== null && item === state.rewardOption);
  if (state.slots[slot] === item && gemSlotQuestDone === state.gemSlotQuestDone) return state;
  const slots: Progress['slots'] = [...state.slots];
  slots[slot] = item;
  const inventory = [...state.inventory];
  inventory.splice(index, 1);
  return { ...state, slots, inventory, gemSlotQuestDone };
}
export function claimGrowthReward(state: Progress): Progress {
  if (state.growthRewardClaimed || questSteps(state)[10] !== 'active') return state;
  return { ...state, growthRewardClaimed: true, gems: { ...state.gems, low: state.gems.low + 1 } };
}
export function openGem(state: Progress, tier: GemTier, random: () => number = Math.random) {
  if (!GEM_TIERS.includes(tier) || state.gems[tier] < 1) return null;
  const roll = random();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
  const kind = (['damage', 'critChance', 'critDamage'] as const)[Math.floor(roll * 3)];
  const item: OptionId = `${tier}:${kind}`;
  return { item, state: { ...state, gems: { ...state.gems, [tier]: state.gems[tier] - 1 },
    inventory: [...state.inventory, item],
    rewardOption: state.growthRewardClaimed && state.rewardOption === null && tier === 'low' ? item : state.rewardOption } };
}
export function grantTestGems(state: Progress): Progress {
  return { ...state, gems: Object.fromEntries(GEM_TIERS.map(tier => [tier, Math.max(2, state.gems[tier])])) as Record<GemTier, number> };
}
export function grantTestOptions(state: Progress): Progress {
  const inventory = [...state.inventory];
  for (const id of Object.keys(OPTION_ITEMS) as OptionId[]) {
    while (inventory.filter(item => item === id).length < 2) inventory.push(id);
  }
  return { ...state, inventory };
}
export const firstRecordBonusActive = (state: Progress) => state.firstRecordClaimed && state.skinQuestHarvestStart != null;
export const skinQuestCollected = (state: Pick<Progress, 'harvested' | 'skinQuestHarvestStart'>) => state.skinQuestHarvestStart == null ? 0
  : Math.min(100, Math.max(0, state.harvested - state.skinQuestHarvestStart));
export function claimFirstRecord(state: Progress): Progress {
  if (state.firstRecordClaimed || state.receipt?.status !== 'confirmed' || questSteps(state)[6] !== 'active') return state;
  // Claim unlocks the axe. First equip records the separate permanent bonus unlock.
  return { ...state, firstRecordClaimed: true };
}
export function equipAxeSkin(state: Progress, skin: Progress['axeSkin']): Progress {
  if (skin === 'firstRecord' && !state.firstRecordClaimed) return state;
  if (skin === 'pioneer' && !pioneerOwned(state)) return state;
  if (skin === 'warden' && !wardenOwned(state)) return state;
  if (skin === 'recovery' && !recoveryOwned(state)) return state;
  if (skin === state.axeSkin) return state;
  const axeLevel = axeLevelFor(state, skin);
  const unequippedAxeLevels = { ...state.unequippedAxeLevels, [state.axeSkin]: state.axeLevel };
  delete unequippedAxeLevels[skin];
  return { ...state, axeSkin: skin, axeLevel, unequippedAxeLevels,
    skinQuestHarvestStart: skin === 'firstRecord' && state.skinQuestHarvestStart === null
      ? state.harvested : state.skinQuestHarvestStart };
}
export const axeLevelFor = (state: Progress, skin: Progress['axeSkin']) =>
  skin === state.axeSkin ? state.axeLevel : state.unequippedAxeLevels[skin] ?? 1;
export const highestAxeLevel = (state: Progress) => Math.max(state.axeLevel, ...Object.values(state.unequippedAxeLevels));
export const pioneerOwned = (state: Progress) => state.adventureClaimed >= 4;
export const wardenOwned = (state: Progress) => state.treeLevel >= 101;
export const recoveryOwned = (state: Progress) => pioneerOwned(state) && axeLevelFor(state, 'pioneer') >= 150;
export const MASTERY_VALUES = { default: [1, 2, 3], firstRecord: [1, 2, 3], pioneer: [2, 5, 8], warden: [3, 6, 10] } as const;
export type MasteryAxe = keyof typeof MASTERY_VALUES;
export function masteryBonus(state: Progress, axe: MasteryAxe): number {
  if (axe === 'warden' && state.wardenRewardsClaimed === 3) return 30;
  if ((axe === 'firstRecord' && !state.firstRecordClaimed) || (axe === 'pioneer' && !pioneerOwned(state)) || (axe === 'warden' && !wardenOwned(state))) return 0;
  const rank = Math.min(3, Math.floor(axeLevelFor(state, axe) / 50));
  return rank === 0 ? 0 : MASTERY_VALUES[axe][rank - 1];
}
export const defeatCoins = (state: Progress) => Math.floor(treeCoins(state.treeLevel) * (100 + masteryBonus(state, 'pioneer')) / 100);
export const WARDEN_TARGETS = [150, 175, 200] as const;
export function claimWardenReward(state: Progress): Progress {
  const index = state.wardenRewardsClaimed ?? 0;
  if (index < 0 || index >= 3 || !wardenOwned(state) || axeLevelFor(state, 'warden') < WARDEN_TARGETS[index]) return state;
  const tier = index === 2 ? 'supreme' : 'high';
  const count = index === 1 ? 2 : 1;
  if (!Number.isSafeInteger(state.gems[tier] + count)) return state;
  return { ...state, wardenRewardsClaimed: index + 1, gems: { ...state.gems, [tier]: state.gems[tier] + count } };
}
export const hitXpBonusPercent = (state: Progress) => (state.axeSkin === 'pioneer' ? 10 : 0) + talentValue('learning', state.talents.learning) + masteryBonus(state, 'firstRecord');
export const displayedHitXp = (state: Progress) => hitXp(state.treeLevel) * (100 + hitXpBonusPercent(state)) / 100;
export function adventureReady(state: Progress, index = state.adventureClaimed): boolean {
  if (!state.gemSlotQuestDone || index !== state.adventureClaimed) return false;
  switch (index) {
    case 0: return state.treeLevel >= 15;
    case 1: return state.slots[1] !== null;
    case 2: return state.treeLevel >= 25 && highestAxeLevel(state) >= 20;
    case 3: return state.treeLevel >= 50 && characterLevel(state.xp) >= 10;
    case 4: return state.axeSkin === 'pioneer' && state.axeLevel >= 10;
    case 5: return state.treeLevel >= 100 && characterLevel(state.xp) >= 20;
    default: return false;
  }
}
export function claimAdventure(state: Progress): Progress {
  if (!adventureReady(state) || !questSteps(state).slice(0, 13).every(status => status === 'complete')) return state;
  const index = state.adventureClaimed;
  const gems = { ...state.gems };
  if (index === 0) gems.low++;
  if (index === 2) gems.medium++;
  if (index === 5) gems.high++;
  return { ...state, adventureClaimed: index + 1, gems,
    coins: state.coins + (index === 1 ? 300 : index === 3 ? 900 : index === 4 ? 1000 : 0) };
}
export function recover(state: Progress, now: number): Progress {
  if (state.fatigue === 0 || state.recoveryAt === null || now < state.recoveryAt) return state;
  const steps = Math.floor((now - state.recoveryAt) / RECOVERY_MS);
  if (steps === 0) return state;
  const fatigue = Math.max(0, state.fatigue - steps * 20);
  return { ...state, fatigue, recoveryAt: fatigue === 0 ? null : state.recoveryAt + steps * RECOVERY_MS };
}
// autoPickupEntitled is a trusted future entitlement input, never a client-save purchase flag.
export function hit(state: Progress, now: number, random: () => number = Math.random, autoPickupEntitled = false) {
  const current = recover(state, now);
  if (current.fatigue >= 100 || current.treeHp === 0) return null;
  const stats = rawCombatStats(current);
  const roll = random();
  const base = state.axeSkin === 'recovery' ? stats.min : state.axeSkin === 'warden' ? stats.min + (roll < 0.5 ? 0 : roll < 0.8 ? 25 : 50) : rollBaseDamage(stats.min, roll);
  const critical = random() < stats.critChance / 100;
  // Keep two decimal places so a 105% critical is meaningful even at level 1.
  const damage = Math.round(base * (critical ? stats.critDamage / 100 : 1) *
    (1 + (talentValue('lumber', current.talents.lumber) + masteryBonus(current, 'default')) / 100) * 100) / 100;
  const baseWood = woodYield(damage);
  // Independent of criticals; zero-yield hits never receive a bonus.
  const harvestRoll = random();
  const bonusWood = baseWood > 0 && harvestRoll < BOUNTIFUL_CHANCE ? current.treeLevel : 0;
  const felled = current.treeHp <= damage;
  const coinBonus = random() < COIN_CHANCE ? bonusCoins(current.treeLevel) : 0;
  const coins = coinBonus + (felled ? defeatCoins(current) : 0);
  const bonusHundredths = current.xpBonusRemainder + hitXp(current.treeLevel) * hitXpBonusPercent(current);
  const xpGained = hitXp(current.treeLevel) + Math.floor(bonusHundredths / 100);
  const value = baseWood + bonusWood;
  const pickupRoll = random();
  const autoCollected = value > 0 && (autoPickupEntitled || pickupRoll < talentValue('autoCollect', current.talents.autoCollect) / 100);
  const fatigueSaved = current.axeSkin === 'recovery' && recoveryOwned(current) && random() < 0.3;
  let next = awardXp({ ...current, coins: current.coins + coins,
    xpBonusRemainder: bonusHundredths % 100,
    treeHp: Math.max(0, Math.round((current.treeHp - damage) * 100) / 100),
    totalHits: current.totalHits + 1, fatigue: Math.min(100, current.fatigue + (fatigueSaved ? 0 : 1)),
    recoveryAt: fatigueSaved ? current.recoveryAt : current.recoveryAt ?? now }, xpGained);
  if (autoCollected) next = collect(next, value);
  const bossDefeated = felled ? activeBoss(current) : null;
  if (bossDefeated) next = { ...next, bosses: { first: false, gate: false, ...next.bosses, [bossDefeated]: true },
    gems: { ...next.gems, high: next.gems.high + (bossDefeated === 'gate' ? 1 : 0) } };
  return {
    bossDefeated, fatigueSaved,
    damage, critical, felled, baseWood, bonusWood, value, coins, coinBonus, xpGained, autoCollected,
    manualWood: autoCollected ? 0 : value,
    state: next,
  };
}
export function collect(state: Progress, value: number): Progress {
  if (!Number.isSafeInteger(value) || value <= 0) return state;
  return { ...state, wood: state.wood + value, harvested: state.harvested + value };
}
export function upgrade(state: Progress, kind: 'axe' | 'tree'): Progress {
  if (kind === 'tree' && state.treeHp !== 0) return state;
  const level = kind === 'axe' ? state.axeLevel : state.treeLevel;
  const cost = kind === 'axe' ? axeCost(level) : treeCost(level);
  if (level >= (kind === 'axe' ? AXE_MAX : TREE_MAX) || (kind === 'axe' ? state.coins : state.wood) < cost) return state;
  return kind === 'axe' ? { ...state, coins: state.coins - cost, axeLevel: level + 1 }
    : awardXp({ ...state, wood: state.wood - cost, treeLevel: level + 1, treeHp: encounterHealth({ ...state, treeLevel: level + 1 }) }, newTreeXp(level + 1));
}
export function regrow(state: Progress): Progress {
  return state.treeHp === 0 ? { ...state, treeHp: encounterHealth(state) } : state;
}
export function testRest(state: Progress, now: number): Progress {
  const current = recover(state, now);
  const fatigue = Math.max(0, current.fatigue - 28);
  return { ...current, fatigue, recoveryAt: fatigue === 0 ? null : current.recoveryAt };
}
export function questSteps(state: Progress) {
  const conditions = [walletUnlocked(state), state.walletCompleted, highestAxeLevel(state) >= 2,
    characterLevel(state.xp) >= 2, state.treeLevel >= 2, state.receipt?.status === 'confirmed',
    state.firstRecordClaimed, state.skinQuestHarvestStart != null, skinQuestCollected(state) >= 100,
    state.treeLevel >= 10 && characterLevel(state.xp) >= 5 && highestAxeLevel(state) >= 15,
    state.growthRewardClaimed, state.rewardOption !== null, state.gemSlotQuestDone,
    ...Array.from({ length: 6 }, (_, index) => state.adventureClaimed > index)];
  let open = true;
  return conditions.map((done) => {
    const status = !open ? 'locked' : done ? 'complete' : 'active';
    if (!done) open = false;
    return status;
  });
}
export function parseProgress(raw: string): Progress {
  const oldVersion = JSON.parse(raw)?.version;
  const state = parseSavedProgress(raw);
  const rewards = state.wardenRewardsClaimed;
  if (rewards !== undefined && (!Number.isInteger(rewards) || rewards < 0 || rewards > 3 ||
    (rewards > 0 && (!wardenOwned(state) || axeLevelFor(state, 'warden') < WARDEN_TARGETS[rewards - 1])))) throw new Error('INVALID_SAVE');
  if (state.bosses !== undefined && (!state.bosses || typeof state.bosses !== 'object' || Array.isArray(state.bosses) ||
    typeof state.bosses.first !== 'boolean' || typeof state.bosses.gate !== 'boolean')) throw new Error('INVALID_SAVE');
  if (state.bosses === undefined) state.bosses = { first: state.treeLevel >= 50, gate: state.treeLevel >= 100 };
  if (state.autoPickupTrial !== undefined && (!state.autoPickupTrial ||
    typeof state.autoPickupTrial !== 'object' || Array.isArray(state.autoPickupTrial) ||
    !Number.isSafeInteger(state.autoPickupTrial.startedAt) || state.autoPickupTrial.startedAt < 0 ||
    state.autoPickupTrial.startedAt > Number.MAX_SAFE_INTEGER - 1800000 || state.treeLevel < 50)) throw new Error('INVALID_SAVE');
  if (oldVersion >= 9) return state;
  const inventory = [...state.inventory];
  for (const item of state.slots) {
    const index = inventory.indexOf(item as OptionId);
    if (index >= 0) inventory.splice(index, 1);
  }
  return { ...state, version: 9, inventory };
}
function parseSavedProgress(raw: string): Progress {
  const s = JSON.parse(raw);
  const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
  const legacy = s?.version === 1;
  if (!s || ![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(s.version) || !['ko', 'en'].includes(s.language) ||
    !integer(s.wood, 0) || !integer(s.harvested, s.wood) || !integer(s.xp, 0) ||
    !integer(s.axeLevel, 1, legacy ? 10 : AXE_MAX) || !integer(s.treeLevel, 1, legacy ? 5 : TREE_MAX) ||
    typeof s.treeHp !== 'number' || !Number.isFinite(s.treeHp) || s.treeHp < 0 ||
    s.treeHp > (legacy ? 100 + (s.treeLevel - 1) * 70 : encounterHealth(s)) || !integer(s.fatigue, 0, 100) ||
    (s.fatigue > 0 ? !integer(s.recoveryAt, 0) : s.recoveryAt !== null) ||
    typeof s.walletCompleted !== 'boolean' ||
    (s.receipt !== null && (!s.receipt || typeof s.receipt.address !== 'string' ||
      typeof s.receipt.signature !== 'string' || !['pending', 'confirmed', 'failed'].includes(s.receipt.status)))) {
    throw new Error('INVALID_SAVE');
  }
  if (legacy) {
    return migrateEconomy({ ...s, version: 4, ...gemDefaults(),
      treeHp: Math.round(s.treeHp / (100 + (s.treeLevel - 1) * 70) * treeHealth(s.treeLevel) * 100) / 100,
      slots: [null, null], inventory: [], totalHits: 0,
      firstRecordClaimed: false, axeSkin: 'default', skinQuestHarvestStart: null });
  }
  const isOption = (id: unknown): id is OptionId => typeof id === 'string' &&
    (Object.hasOwn(OPTION_ITEMS, id) || GEM_TIERS.some(tier =>
      Object.keys(OPTION_ITEMS).some(kind => id === `${tier}:${kind}`)));
  if (!integer(s.totalHits, 0) || !Array.isArray(s.inventory) || !s.inventory.every(isOption) ||
    !Array.isArray(s.slots) || s.slots.length !== 2 ||
    !s.slots.every((id: unknown) => id === null || (isOption(id) && (s.version >= 9 || s.inventory.includes(id)))) ||
    !s.slots.every((id: unknown) => s.version >= 9 || id === null ||
      s.slots.filter((equipped: unknown) => equipped === id).length <=
      s.inventory.filter((owned: unknown) => owned === id).length)) throw new Error('INVALID_SAVE');
  if (s.version === 2) return migrateEconomy({ ...s, version: 4, ...gemDefaults(),
    firstRecordClaimed: false, axeSkin: 'default', skinQuestHarvestStart: null });
  if (typeof s.firstRecordClaimed !== 'boolean' || !(s.version >= 9 ? ['default', 'firstRecord', 'pioneer', 'warden', 'recovery'] : s.version >= 7 ? ['default', 'firstRecord', 'pioneer'] : ['default', 'firstRecord']).includes(s.axeSkin) ||
    (s.firstRecordClaimed && s.receipt?.status !== 'confirmed') ||
    (!s.firstRecordClaimed && (!['default', 'warden'].includes(s.axeSkin) || s.skinQuestHarvestStart !== null)) ||
    (s.skinQuestHarvestStart !== null && !integer(s.skinQuestHarvestStart, 0, s.harvested)) ||
    (s.axeSkin === 'firstRecord' && s.skinQuestHarvestStart === null)) throw new Error('INVALID_SAVE');
  if (s.version === 3) return migrateEconomy({ ...s, version: 4, ...gemDefaults() });
  if (s.version >= 6 && (!s.unequippedAxeLevels || typeof s.unequippedAxeLevels !== 'object' || Array.isArray(s.unequippedAxeLevels) ||
    Object.entries(s.unequippedAxeLevels).some(([key, value]) => !(s.version >= 9 ? ['default', 'firstRecord', 'pioneer', 'warden', 'recovery'] : s.version >= 7 ? ['default', 'firstRecord', 'pioneer'] : ['default', 'firstRecord']).includes(key) ||
      (key === 'warden' && !wardenOwned(s)) ||
      (key === 'recovery' && !recoveryOwned(s)) ||
      (key === 'pioneer' && !pioneerOwned(s)) ||
      key === s.axeSkin || (key === 'firstRecord' && !s.firstRecordClaimed) || !integer(value, 1, AXE_MAX)))) throw new Error('INVALID_SAVE');
  if (!s.gems || !GEM_TIERS.every(tier => integer(s.gems[tier], 0)) ||
    typeof s.growthRewardClaimed !== 'boolean' || typeof s.gemSlotQuestDone !== 'boolean' ||
    (s.growthRewardClaimed && !(s.firstRecordClaimed && skinQuestCollected(s) >= 100 &&
      s.treeLevel >= 10 && (s.version === 4 ? legacyCharacterLevel(s.xp) >= 15 : characterLevel(s.xp) >= 5) &&
      (s.version >= 6 ? highestAxeLevel(s) : s.axeLevel) >= 15)) ||
    (s.rewardOption !== null && (!s.growthRewardClaimed || !isOption(s.rewardOption) ||
      !s.rewardOption.startsWith('low:') || (s.version < 9 && !s.inventory.includes(s.rewardOption)))) ||
    (s.gemSlotQuestDone && s.rewardOption === null)) throw new Error('INVALID_SAVE');
  if (s.version === 4) return migrateEconomy(s);
  if (!integer(s.coins, 0)) throw new Error('INVALID_SAVE');
  if (s.version === 5) return migrateAxes(s);
  if (s.version === 6) return { ...s, version: 9, ...adventureDefaults(), ...talentDefaults() };
  if (!integer(s.adventureClaimed, 0, 6) || !integer(s.xpBonusRemainder, 0, s.version === 7 ? 9 : 99) ||
    (s.adventureClaimed > 0 && (!s.gemSlotQuestDone || s.treeLevel < 15)) ||
    (s.adventureClaimed >= 3 && (s.treeLevel < 25 || highestAxeLevel(s) < 20)) ||
    (s.adventureClaimed >= 4 && (s.treeLevel < 50 || characterLevel(s.xp) < 10)) ||
    (s.adventureClaimed >= 5 && axeLevelFor(s, 'pioneer') < 10) ||
    (s.adventureClaimed >= 6 && (s.treeLevel < 100 || characterLevel(s.xp) < 20)) ||
    (s.axeSkin === 'pioneer' && !pioneerOwned(s)) || (s.axeSkin === 'warden' && !wardenOwned(s)) ||
    (s.axeSkin === 'recovery' && !recoveryOwned(s))) throw new Error('INVALID_SAVE');
  if (s.version === 7) return { ...s, version: 9, ...talentDefaults(), xpBonusRemainder: s.xpBonusRemainder * 10 };
  if (!s.talents || typeof s.talents !== 'object' || Array.isArray(s.talents) ||
    !TALENT_IDS.every(id => integer(s.talents[id], 0, TALENT_MAX[id])) ||
    Object.keys(s.talents).some(id => !TALENT_IDS.includes(id as TalentId))) throw new Error('INVALID_SAVE');
  return s;
}
function legacyCharacterLevel(xp: number) {
  let level = 1;
  while (level < CHARACTER_MAX && xp >= 15 * level * (level + 1)) level++;
  return level;
}
function migrateEconomy(state: Omit<Progress, 'version' | 'coins' | 'unequippedAxeLevels' | 'adventureClaimed' | 'xpBonusRemainder' | 'talents'> & { version: number }): Progress {
  const level = legacyCharacterLevel(state.xp);
  const fraction = (state.xp - 15 * level * (level - 1)) / (30 * level);
  return migrateAxes({ ...state, coins: 0,
    xp: level === CHARACTER_MAX ? xpFloor(level) : xpFloor(level) + Math.floor(fraction * xpRequired(level)) });
}
function migrateAxes(state: Omit<Progress, 'version' | 'unequippedAxeLevels' | 'adventureClaimed' | 'xpBonusRemainder' | 'talents'> & { version: number }): Progress {
  return { ...state, version: 9, ...talentDefaults(), ...adventureDefaults(), unequippedAxeLevels: state.firstRecordClaimed
    ? { [state.axeSkin === 'default' ? 'firstRecord' : 'default']: state.axeLevel } : {} };
}
