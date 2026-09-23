import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BuffPanel } from './BuffPanel';
import { GemPackages } from './DeepwoodContent';
import { GemArt, GEM_COLORS } from './GemArt';
import { createFusionAction } from './fusion-action';
import { GEM_FUSION_COST, GEM_FUSION_CHANCE } from './progression';
import { translate, type TranslationKey } from '../i18n';
import { AXE_MAX, CHARACTER_MAX, OPTION_ITEMS, axeCost, characterLevel, combatStats, equip,
  equipAxeSkin, firstRecordBonusActive, grantTestOptions, xpFloor, type Progress } from './progression';
import { GEM_TIERS, GEM_VALUES, optionInfo, openGem, grantTestGems, xpRequired, axeLevelFor, pioneerOwned, type OptionId, type GemTier } from './progression';
import { TALENT_IDS, TALENT_MAX, talentCost, talentValue, upgradeTalent } from './progression';
import { formatNumber, formatSignedNumber } from './format-number';
import { wardenOwned, recoveryOwned, MASTERY_VALUES } from './progression';
import { WOOD_GEM_COST, WOOD_GEM_ODDS, drawWoodGem } from './progression';

type Props = { progress: Progress; commit: (next: Progress) => boolean;
  initialPage?: 'overview' | 'axe' | 'gems';
  onSkin: (skin: Progress['axeSkin']) => void; onUpgrade: () => void; onNavigate: () => void };
type Page = 'overview' | 'axe' | 'wardrobe' | 'options' | 'skills' | 'gems' | 'talents';

export function CharacterPanel({ progress, commit, onSkin, onUpgrade, onNavigate, initialPage = 'overview' }: Props) {
  const [page, setPage] = useState<Page>(initialPage);
  const [slot, setSlot] = useState<0 | 1>(0);
  const [selected, setSelected] = useState<Progress['axeSkin']>(progress.axeSkin);
  const [selectedGem, setSelectedGem] = useState<GemTier>('low');
  const fusionPromptOpen = useRef(false);
  const [fusionResult, setFusionResult] = useState<{ success: boolean; source: GemTier; target: GemTier } | null>(null);
  const fusionTarget = GEM_TIERS[GEM_TIERS.indexOf(selectedGem) + 1] ?? null;
  const t = (key: TranslationKey, value?: string | number) => translate(progress.language, key, value);
  const latest = useRef(progress);
  latest.current = progress;
  const optionLabel = (id: OptionId) => {
    const info = optionInfo(id);
    return `${t(info.tier ?? 'legacyOption')} · ${t(info.kind)} +${info.value}${info.kind === 'damage' ? '' : '%p'}`;
  };
  const useGem = (tier: GemTier) => {
    const result = openGem(latest.current, tier);
    if (!result) return;
    if (!commit(result.state)) { Alert.alert(t('gems'), t('saveError')); return; }
    latest.current = result.state;
    Alert.alert(t('gemResult'), optionLabel(result.item), [
      { text: t('editSlot', 1), onPress: () => { setSlot(0); go('options'); } },
      { text: t('close') },
    ]);
  };
  const go = (next: Page) => { setPage(next); onNavigate(); };
  const stats = combatStats(progress), level = characterLevel(progress.xp);
  const range = (s: typeof stats) => `${formatNumber(s.min)}–${formatNumber(s.max)}`;
  const name = (skin: Progress['axeSkin']) => t(skin === 'recovery' ? 'recoveryAxe' : skin === 'warden' ? 'wardenAxe' : skin === 'pioneer' ? 'pioneerAxe' : skin === 'firstRecord' ? 'firstRecordSkinShort' : 'defaultSkin');
  const delta = (value: number) => {
    const n = Number(formatNumber(value));
    return <Text style={[s.delta, { color: n > 0 ? '#92E4B6' : n < 0 ? '#FF9C8D' : '#ADC5BC' }]}>{n === 0 ? t('noChange') : formatSignedNumber(n)}</Text>;
  };
  const stat = (label: string, value: string) => <View style={s.stat}><Text style={s.muted}>{label}</Text><Text style={s.statNumber}>{value}</Text></View>;
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled}
    onPress={action} style={[s.button, disabled && s.disabled]}><Text style={s.buttonText}>{label}</Text></Pressable>;
  const owned: Progress['axeSkin'][] = progress.firstRecordClaimed ? ['default', 'firstRecord'] : ['default'];
  if (pioneerOwned(progress)) owned.push('pioneer');
  if (wardenOwned(progress)) owned.push('warden');
  if (recoveryOwned(progress)) owned.push('recovery');
  const mastery = (skin: Progress['axeSkin']) => skin === 'recovery' ? <Text style={s.bonus}>{t('recoveryBonus')}</Text> : <View style={s.card}>
    <Text style={s.section}>{t('axeMastery')}</Text><Text style={s.muted}>{t('axeMasteryHint')}</Text>
    {MASTERY_VALUES[skin].map((value, index) => {
      const target = (index + 1) * 50;
      const reached = axeLevelFor(progress, skin) >= target;
      const currentTier = Math.min(3, Math.floor(axeLevelFor(progress, skin) / 50));
      const applied = index + 1 === currentTier && !(skin === 'warden' && progress.wardenRewardsClaimed === 3);
      const effect = skin === 'default' ? 'masteryDamage' : skin === 'firstRecord' ? 'masteryXp' : skin === 'pioneer' ? 'masteryCoins' : 'masteryCrit';
      return <View key={target} style={{ gap: 4 }}><Text style={reached ? s.bonus : s.muted}>
        {applied ? '●' : reached ? '✓' : '○'} Lv.{target} · {t(effect, value)}
        {'\n'}{t(applied ? 'buffApplied' : reached ? 'buffSuperseded' : 'buffNotUnlocked')}
      </Text>{skin === 'pioneer' && target === 150 && <Text style={s.muted}>{t('recoveryUnlock')}</Text>}</View>;
    })}
    {skin === 'warden' && progress.wardenRewardsClaimed === 3 && <Text style={s.bonus}>● Lv.200 · {t('masteryCrit', 30)}</Text>}
  </View>;
  const candidate = combatStats(equipAxeSkin(progress, selected));
  return <View style={s.container}>
    {page !== 'overview' && <View style={s.heading}>
      <Pressable accessibilityRole="button" onPress={() => go(page === 'options' || page === 'wardrobe' ? 'axe' : 'overview')} style={s.back}>
        <Text style={s.text}>‹ {t('back')}</Text>
      </Pressable>
      <Text style={s.title}>{t(page === 'axe' ? 'equippedAxe' : page === 'wardrobe' ? 'ownedAxes' : page === 'options' ? 'optionSlots' : page === 'gems' ? 'gems' : page === 'talents' ? 'talents' : 'skills')}</Text>
    </View>}

    {page === 'overview' && <>
      <View style={s.heading}><Text style={s.title}>{t('appearance')}</Text><Text style={s.level}>Lv. {level}</Text></View>
      <View style={s.stage}>
        <View style={s.halo} /><View style={s.floor} />
        <View style={s.head}><View style={s.hat} /><View style={s.eye} /></View>
        <View style={s.body}><View style={s.belt} /></View><View style={s.legLeft} /><View style={s.legRight} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('openAxe')} onPress={() => go('axe')} style={s.equipmentSlot}>
          <InventoryAxe skin={progress.axeSkin} crowned={progress.wardenRewardsClaimed === 3} /><Text style={s.slotCaption}>{t('axe')} ›</Text>
        </Pressable>
        <Text style={s.stageCaption}>{t('tapEquipment')}</Text>
      </View>
      <View style={s.heading}><Text style={s.muted}>XP</Text><Text style={s.muted}>{level === CHARACTER_MAX ? t('maxLevel') : `${progress.xp - xpFloor(level)} / ${xpRequired(level)}`}</Text></View>
      <View style={s.meter}><View style={[s.fill, { width: `${level === CHARACTER_MAX ? 100 : Math.min(100, (progress.xp - xpFloor(level)) / xpRequired(level) * 100)}%` }]} /></View>
      <Pressable accessibilityRole="button" onPress={() => go('axe')} style={s.card}>
        <Text style={s.muted}>{t('equippedAxe')}</Text>
        <View style={s.heading}><Text style={s.title}>{name(progress.axeSkin)}</Text><Text style={s.text}>›</Text></View>
        <Text style={s.text}>Lv. {progress.axeLevel} · {t('attackPower')} {range(stats)}</Text>
      </Pressable>
      <View style={s.row}>{stat(t('critChance'), `${formatNumber(stats.critChance)}%`)}{stat(t('critDamage'), `${formatNumber(stats.critDamage)}%`)}</View>
      <BuffPanel progress={progress} />
      <Pressable accessibilityRole="button" onPress={() => go('skills')} style={s.back}><Text style={s.text}>{t('passiveSkills')} ›</Text></Pressable>
      {button(t('talents'), () => go('talents'))}
      {button(`${t('gems')} · ${Object.values(progress.gems).reduce((sum, count) => sum + count, 0)}`, () => go('gems'))}
    </>}

    {page === 'axe' && <>
      <View style={s.equipmentHero}><InventoryAxe skin={progress.axeSkin} crowned={progress.wardenRewardsClaimed === 3} /><View style={s.grow}>
        <View style={s.heading}><Text style={[s.title, { flex: 1 }]}>{name(progress.axeSkin)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('changeEquipment')}
            onPress={() => { setSelected(progress.axeSkin); go('wardrobe'); }} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#BDE9D8', fontSize: 28 }}>⌄</Text>
          </Pressable></View><Text style={s.muted}>Lv. {progress.axeLevel} / {AXE_MAX}</Text>
        <Text style={s.statNumber}>{t('attackPower')} {range(stats)}</Text>
      </View></View>
      <Text style={s.section}>{t('optionSlots')}</Text>
      <View style={s.row}>{([0, 1] as const).map(index => <Pressable key={index} accessibilityRole="button"
        accessibilityLabel={t('editSlot', index + 1)} onPress={() => { setSlot(index); go('options'); }} style={[s.slot, progress.slots[index] && s.slotFilled]}>
        <Text style={s.muted}>{t('slot', index + 1)}</Text><Text style={s.slotIcon}>{progress.slots[index] ? '◆' : '+'}</Text>
        <Text style={s.text}>{progress.slots[index] ? optionLabel(progress.slots[index]) : t('emptySlot')}</Text><Text style={s.muted}>{t('changeOption')} ›</Text>
      </Pressable>)}</View>
      {firstRecordBonusActive(progress) && <Text style={s.bonus}>{t('permanentBonusShort')}</Text>}
      {progress.axeSkin === 'firstRecord' && <Text style={s.bonus}>{t('commemorativeAttack')}</Text>}
      {progress.axeSkin === 'pioneer' && <Text style={s.bonus}>{t('pioneerBonus')}</Text>}
      {progress.axeSkin === 'warden' && <Text style={s.bonus}>{t('wardenBonus')}</Text>}
      {mastery(progress.axeSkin)}
      <View style={s.card}><View style={s.heading}><Text style={s.section}>{t('axeUpgrade')}</Text>{progress.axeLevel < AXE_MAX && delta(1)}</View>
        <Text style={s.muted}>{t('ownedCoins', progress.coins)}</Text>
        <Text style={s.muted}>{t('coinHint')}</Text>
        {button(t(progress.axeLevel >= AXE_MAX ? 'maxLevel' : 'axeCoinCost', axeCost(progress.axeLevel)), onUpgrade,
          progress.axeLevel >= AXE_MAX || progress.coins < axeCost(progress.axeLevel))}
      </View>
    </>}

    {page === 'wardrobe' && <>
      <Text style={s.muted}>{t('sharedAxeProgress')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 8 }}>{owned.map(skin => <Pressable key={skin} accessibilityRole="button" accessibilityLabel={name(skin)} accessibilityState={{ selected: selected === skin }}
        onPress={() => setSelected(skin)} style={[s.slot, { flex: 0, width: 90 }, selected === skin && s.selected]}>
        <InventoryAxe skin={skin} crowned={progress.wardenRewardsClaimed === 3} /><Text style={s.text}>{name(skin)}</Text>
        <Text style={s.muted}>Lv. {axeLevelFor(progress, skin)}</Text>
        {progress.axeSkin === skin && <Text style={s.bonus}>{t('skinEquipped')}</Text>}
      </Pressable>)}</ScrollView>
      {!recoveryOwned(progress) && <Pressable accessibilityRole="button" onPress={() => Alert.alert(t('recoveryAxe'), `${t('recoveryBonus')}\n\n${t('recoveryUnlock')}\n${Math.min(axeLevelFor(progress, 'pioneer'), 150)} / 150`)} style={[s.card, { opacity: 0.5 }]}>
        <InventoryAxe skin="recovery" /><Text style={s.title}>{t('recoveryAxe')} · {t('masteryLocked')}</Text>
        <Text style={s.muted}>{t('recoveryUnlock')}</Text>
      </Pressable>}
      <View style={s.card}><Text style={s.section}>{t('equipmentCompare')}</Text>
        <Text style={s.title}>{name(selected)} · Lv.{axeLevelFor(progress, selected)}</Text>
        <Text style={s.bonus}>{t(progress.axeSkin === selected ? 'buffApplied' : 'buffEquipToApply')}</Text>
        {selected === 'firstRecord' && <Text style={s.bonus}>{t('commemorativeAttack')}</Text>}
        {selected === 'pioneer' && <Text style={s.bonus}>{t('pioneerBonus')}</Text>}
        {selected === 'warden' && <Text style={s.bonus}>{t('wardenBonus')}</Text>}
        {selected === 'recovery' && <Text style={s.bonus}>{t('recoveryBonus')}</Text>}
        <View style={s.row}>{stat(t('currentEquipment'), range(stats))}{stat(t('selectedEquipment'), range(candidate))}</View>
        <View style={s.heading}><Text style={s.text}>{t('attackPower')}</Text>{delta(candidate.min - stats.min)}</View>
        {selected === 'firstRecord' && !firstRecordBonusActive(progress) && <Text style={s.bonus}>{t('firstEquipBonusShort')}</Text>}
        {firstRecordBonusActive(progress) && <Text style={s.muted}>{t('permanentBonusShort')}</Text>}
      </View>
      {button(t(progress.axeSkin === selected ? 'skinEquipped' : 'equipSkin'), () => { onSkin(selected); go('axe'); }, progress.axeSkin === selected)}
      {mastery(selected)}
      <View style={s.card}><Text style={s.section}>{t('optionSlots')}</Text><Text style={s.muted}>{t('sharedSlotsHint')}</Text>
        {progress.slots.map((id, index) => <Text key={index} style={s.text}>{t('slot', index + 1)} · {id ? `${optionLabel(id)} · ${t('buffApplied')}` : t('emptySlot')}</Text>)}
      </View>
    </>}

    {page === 'options' && <>
      <Text style={s.section}>{t('slot', slot + 1)}</Text>
      <Text style={s.muted}>{t('consumeOptionHint')}</Text>
      {progress.inventory.length === 0 && <Text style={s.muted}>{t('noOptions')}</Text>}
      {[...new Set(progress.inventory)].map(id => {
        const count = progress.inventory.filter(item => item === id).length;
        const questBlocked = !progress.gemSlotQuestDone && progress.rewardOption === id && slot === 1;
        const blocked = count < 1 || progress.slots[slot] === id || questBlocked;
        const next = combatStats(equip(progress, slot, id));
        return <Pressable key={id} accessibilityRole="button" disabled={blocked} onPress={() => {
          const snapshot = latest.current;
          Alert.alert(t('equipSkin'), t('consumeOptionHint'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('equipSkin'), onPress: () => {
              if (latest.current !== snapshot) return;
              const updated = equip(latest.current, slot, id);
              if (updated === latest.current) return;
              if (commit(updated)) { latest.current = updated; go('axe'); }
              else Alert.alert(t('equipSkin'), t('saveError'));
            } },
          ]);
        }}
          style={[s.card, progress.slots[slot] === id && s.selected, blocked && s.disabled]}>
          <Text style={s.title}>◆ {optionLabel(id)}</Text>
          {progress.rewardOption === id && <Text style={s.bonus}>{t('qEquipGem')}</Text>}
          <Text style={s.muted}>{t('ownedOptionCount', count)}</Text>
          <View style={s.heading}><Text style={s.muted}>{t('attackPower')}</Text>{delta(next.min - stats.min)}</View>
          <Text style={s.muted}>{t('critChance')} {formatNumber(next.critChance)}% · {t('critDamage')} {formatNumber(next.critDamage)}%</Text>
          <Text style={s.text}>{t(questBlocked ? 'qEquipGem' : progress.slots[slot] === id ? 'skinEquipped' : 'equipSkin')}</Text>
        </Pressable>;
      })}
      {__DEV__ && (Object.keys(OPTION_ITEMS) as Array<keyof typeof OPTION_ITEMS>).some(id => progress.inventory.filter(item => item === id).length < 2) && button(t('testOptions'), () => commit(grantTestOptions(progress)))}
      {button(t('gems'), () => go('gems'))}
    </>}

    {page === 'gems' && <>
      <GemPackages progress={progress} />
      <Text style={s.title}>{t('gemInventory')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {GEM_TIERS.map(tier => <Pressable key={tier} accessibilityRole="button" accessibilityLabel={`${t(tier)} · ${progress.gems[tier]}`}
          accessibilityState={{ selected: selectedGem === tier }} onPress={() => setSelectedGem(tier)}
          style={[s.slot, { flex: 0, width: '30%', minWidth: 76, padding: 6, alignItems: 'center', borderColor: selectedGem === tier ? GEM_COLORS[tier] : '#355754' }, selectedGem === tier && s.selected]}>
          <GemArt tier={tier} size={60} /><Text style={[s.text, { color: GEM_COLORS[tier] }]}>{t(tier)}</Text>
          <Text style={s.title}>×{progress.gems[tier].toLocaleString()}</Text>
        </Pressable>)}
      </View>
      <View style={s.card}>
        <View style={s.heading}><GemArt tier={selectedGem} /><View style={s.grow}><Text style={[s.title, { color: GEM_COLORS[selectedGem] }]}>{t(selectedGem)}</Text><Text style={s.bonus}>×{progress.gems[selectedGem].toLocaleString()}</Text></View></View>
        <Text style={s.muted}>{t('damage')} +{GEM_VALUES[selectedGem].damage} · {t('critChance')} +{GEM_VALUES[selectedGem].critChance}%p · {t('critDamage')} +{GEM_VALUES[selectedGem].critDamage}%p</Text>
        <Text style={s.text}>{t('gemHint')}</Text>
        {button(t('openGem'), () => useGem(selectedGem), progress.gems[selectedGem] < 1)}
      </View>
      <View style={s.card}>
        <Text style={s.title}>{t('gemFusion')}</Text>
        <Text style={s.muted}>{t('fusionSelect')}</Text>
        {fusionTarget ? <>
        <View style={[s.row, { alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }]}><GemArt tier={selectedGem} size={50} /><Text style={s.title}>×{GEM_FUSION_COST} →</Text><GemArt tier={fusionTarget} size={50} /><Text style={s.title}>×1</Text></View>
        <Text style={s.text}>{t(selectedGem)} → {t(fusionTarget)}</Text>
        <Text style={s.text}>{t('fusionOdds', GEM_FUSION_CHANCE * 100)}</Text>
        <Text style={s.muted}>{t('fusionWarning', GEM_FUSION_COST)}</Text>
        <Text style={s.bonus}>{t(selectedGem)} {progress.gems[selectedGem]} / {GEM_FUSION_COST}</Text>
        {button(t('gemFusion'), () => {
          if (fusionPromptOpen.current) return;
          fusionPromptOpen.current = true;
          const execute = createFusionAction(() => latest.current, commit, Math.random, selectedGem);
          Alert.alert(t('gemFusion'), `${t(selectedGem)} ×${GEM_FUSION_COST} → ${t(fusionTarget)} ×1\n${t('fusionOdds', GEM_FUSION_CHANCE * 100)}\n\n${t('fusionWarning', GEM_FUSION_COST)}`, [
            { text: t('cancel'), style: 'cancel', onPress: () => { fusionPromptOpen.current = false; } },
            { text: t('gemFusion'), onPress: () => {
              fusionPromptOpen.current = false;
              const result = execute();
              if (result.status === 'duplicate') return;
              if (result.status !== 'saved') { Alert.alert(t('gemFusion'), t(result.status === 'saveError' ? 'saveError' : 'fusionUnavailable')); return; }
              latest.current = result.state;
              setFusionResult({ success: result.success, source: result.source, target: result.target });
              Alert.alert(t(result.success ? 'fusionSuccess' : 'fusionFailed'), `${t(result.source)} ×${GEM_FUSION_COST} → ${t(result.target)} ×${result.success ? 1 : 0}\n${t(result.success ? 'fusionSuccessBody' : 'fusionFailedBody', GEM_FUSION_COST)}`);
            } },
          ], { cancelable: true, onDismiss: () => { fusionPromptOpen.current = false; } });
        }, progress.gems[selectedGem] < GEM_FUSION_COST)}
        </> : <Text style={s.bonus}>{t('fusionMaxTier')}</Text>}
        {fusionResult !== null && <View accessibilityLiveRegion="polite" style={{ gap: 6, paddingTop: 8 }}>
          <Text style={[s.title, { color: fusionResult.success ? '#B6E9CB' : '#FFBB9B' }]}>{t(fusionResult.success ? 'fusionSuccess' : 'fusionFailed')}</Text>
          <Text style={s.text}>{t(fusionResult.source)} ×{GEM_FUSION_COST} → {t(fusionResult.target)} ×{fusionResult.success ? 1 : 0}</Text>
          <Text style={s.muted}>{t(fusionResult.success ? 'fusionSuccessBody' : 'fusionFailedBody', GEM_FUSION_COST)}</Text>
        </View>}
      </View>
      <View style={s.card}>
        <Text style={s.title}>{t('woodGemDraw')}</Text>
        <Text style={s.bonus}>{t('ownedWood', progress.wood)}</Text>
        <Text style={s.text}>{WOOD_GEM_ODDS.map(({ tier, percent }) => `${t(tier)} ${percent}%`).join(' · ')}</Text>
        <Text style={s.muted}>{t('woodGemHint')}</Text>
        {button(t('woodGemCost', WOOD_GEM_COST.toLocaleString()), () => {
          const snapshot = latest.current;
          Alert.alert(t('woodGemDraw'), `${t('woodGemCost', WOOD_GEM_COST.toLocaleString())}\n${WOOD_GEM_ODDS.map(({ tier, percent }) => `${t(tier)} ${percent}%`).join(' · ')}\n\n${t('woodGemHint')}`, [
            { text: t('cancel'), style: 'cancel' },
            { text: t('woodGemDraw'), onPress: () => {
              if (latest.current !== snapshot) return;
              const result = drawWoodGem(latest.current);
              if (!result) return;
              if (!commit(result.state)) { Alert.alert(t('woodGemDraw'), t('saveError')); return; }
              latest.current = result.state;
              Alert.alert(t('rewardClaimed'), t('woodGemReceived', t(result.tier)));
            } },
          ]);
        }, progress.wood < WOOD_GEM_COST)}
      </View>
      {__DEV__ && button(t('testGems'), () => {
        const next = grantTestGems(latest.current);
        if (commit(next)) latest.current = next;
      })}
    </>}

    {page === 'talents' && <>
      <Text style={s.text}>{t('talentsHint')}</Text>
      <Text style={s.bonus}>{t('ownedWood', progress.wood)}</Text>
      {TALENT_IDS.map(id => {
        const rank = progress.talents[id], maxed = rank >= TALENT_MAX[id];
        const current = talentValue(id, rank), next = talentValue(id, Math.min(TALENT_MAX[id], rank + 1));
        const title = id === 'lumber' ? 'talentLumber' : id === 'autoCollect' ? 'talentAuto' : 'talentLearning';
        const hint = id === 'lumber' ? 'talentLumberHint' : id === 'autoCollect' ? 'talentAutoHint' : 'talentLearningHint';
        return <View key={id} style={s.card}>
          <View style={s.heading}><Text style={s.title}>{t(title)}</Text><Text style={s.muted}>Lv. {rank} / {TALENT_MAX[id]}</Text></View>
          <Text style={s.text}>{t(hint)}</Text>
          <Text style={s.statNumber}>{current}%{!maxed && ` → ${next}%`}</Text>
          {button(t(maxed ? 'maxLevel' : rank === 0 ? 'unlockTalent' : 'upgradeCost', talentCost(id, rank)), () => {
            // Use the latest saved state, including during quick repeated taps.
            const upgraded = upgradeTalent(latest.current, id);
            if (upgraded !== latest.current) {
              if (commit(upgraded)) latest.current = upgraded;
              else Alert.alert(t('talents'), t('saveError'));
            }
          }, maxed || progress.wood < talentCost(id, rank))}
        </View>;
      })}
    </>}

    {page === 'skills' && <>
      <View style={s.card}><Text style={s.title}>{t('recoverySkill')}</Text><Text style={s.text}>{t('recoverySkillHint')}</Text></View>
      <View style={s.card}><Text style={s.title}>{t('firstRecordPower')}</Text><Text style={s.text}>{t(firstRecordBonusActive(progress) ? 'permanentBonusShort' : 'firstRecordBonusLocked')}</Text></View>
    </>}
  </View>;
}

function InventoryAxe({ skin, crowned = false }: { skin: Progress['axeSkin']; crowned?: boolean }) {
  const rare = skin === 'firstRecord';
  return <View style={s.axeFrame}><View style={[s.handle, rare && { backgroundColor: '#7850B0' }, skin === 'pioneer' && { backgroundColor: '#377C85' }, skin === 'warden' && { backgroundColor: '#234A63' }]}>
    <View style={[s.blade, rare && { backgroundColor: '#9945FF', borderLeftColor: '#14F195' }, skin === 'pioneer' && { backgroundColor: '#DCAA54', borderLeftColor: '#FFF0BC' }, skin === 'warden' && { backgroundColor: '#69C9ED', borderLeftColor: '#DBF7FF', width: 52 }, skin === 'recovery' && { backgroundColor: '#80BC78', borderLeftColor: '#E5F9B1' }]} />
    {crowned && skin === 'warden' && <View style={{ position: 'absolute', top: 0, left: -14, width: 44, height: 30, borderWidth: 3, borderColor: '#FFD56A', borderRadius: 8, backgroundColor: '#D5A12A' }}><Text style={{ color: '#FFF5C4', textAlign: 'center' }}>◆</Text></View>}
    {rare && <View style={s.band} />}
  </View></View>;
}
const s = StyleSheet.create({
  container: { gap: 12, paddingBottom: 8 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  row: { flexDirection: 'row', gap: 10 }, grow: { flex: 1, gap: 8 }, title: { color: '#F8EED6', fontSize: 16, fontWeight: '800', flexShrink: 1 },
  text: { color: '#DAE6DF', fontSize: 13, fontWeight: '600' }, muted: { color: '#A0BCB2', fontSize: 12, flexShrink: 1 },
  section: { color: '#E6EDDC', fontWeight: '800', fontSize: 14 }, level: { color: '#F5CB77', fontWeight: '900', fontSize: 18 },
  stage: { height: 226, backgroundColor: '#193F40', borderRadius: 24, alignItems: 'center', overflow: 'hidden' },
  halo: { position: 'absolute', width: 164, height: 164, borderRadius: 82, top: 22, backgroundColor: '#28534E' },
  floor: { position: 'absolute', bottom: 28, width: 110, height: 19, borderRadius: 55, backgroundColor: '#102D32' },
  head: { position: 'absolute', top: 37, width: 48, height: 48, borderRadius: 18, backgroundColor: '#EBC292', zIndex: 2 },
  hat: { position: 'absolute', top: -8, left: -5, width: 58, height: 24, borderRadius: 9, backgroundColor: '#C87348' },
  eye: { position: 'absolute', right: 9, top: 24, width: 5, height: 5, borderRadius: 3, backgroundColor: '#203637' },
  body: { position: 'absolute', top: 82, width: 68, height: 72, borderRadius: 17, backgroundColor: '#729D7C' },
  belt: { position: 'absolute', bottom: 7, height: 9, width: 68, backgroundColor: '#EFC75E' },
  legLeft: { position: 'absolute', top: 150, marginLeft: -32, width: 24, height: 38, borderRadius: 7, backgroundColor: '#102D32' },
  legRight: { position: 'absolute', top: 150, marginLeft: 32, width: 24, height: 38, borderRadius: 7, backgroundColor: '#102D32' },
  stageCaption: { position: 'absolute', bottom: 9, color: '#A0BCB2', fontSize: 11 },
  equipmentSlot: { position: 'absolute', right: 10, top: 62, width: 70, minHeight: 103, borderRadius: 16, borderWidth: 1, borderColor: '#D0B76F', alignItems: 'center', backgroundColor: '#133336', padding: 6 },
  slotCaption: { color: '#F5CB77', fontSize: 11, fontWeight: '800' },
  axeFrame: { height: 72, width: 56, alignItems: 'center', justifyContent: 'flex-end' },
  handle: { width: 8, height: 59, borderRadius: 4, backgroundColor: '#BE8558', transform: [{ rotate: '22deg' }], marginBottom: 5 },
  blade: { position: 'absolute', top: -1, left: -16, width: 37, height: 25, borderRadius: 6, borderLeftWidth: 6, borderLeftColor: '#EFF5DD', backgroundColor: '#BED9D2' },
  band: { position: 'absolute', top: 37, width: 8, height: 9, backgroundColor: '#14F195' },
  meter: { height: 5, backgroundColor: '#284C49', borderRadius: 4, overflow: 'hidden' }, fill: { height: 5, backgroundColor: '#8ED1AB' },
  card: { padding: 14, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: '#365A53', backgroundColor: '#193A3C' },
  stat: { flex: 1, gap: 6, padding: 12, backgroundColor: '#173537', borderRadius: 14 }, statNumber: { color: '#F5E8C8', fontSize: 19, fontWeight: '800' },
  back: { paddingVertical: 12, paddingHorizontal: 8 }, button: { padding: 15, backgroundColor: '#EFC75E', borderRadius: 14, alignItems: 'center' },
  buttonText: { color: '#3A3224', fontWeight: '900', fontSize: 14 }, disabled: { opacity: 0.4 },
  equipmentHero: { flexDirection: 'row', alignItems: 'center', gap: 18, backgroundColor: '#224749', borderRadius: 20, padding: 20 },
  slot: { flex: 1, alignItems: 'center', gap: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#42645B', backgroundColor: '#183638' },
  slotFilled: { borderColor: '#76AE96' }, slotIcon: { fontSize: 25, color: '#93CBA9' }, selected: { borderColor: '#EFC75E', backgroundColor: '#2A4A42' },
  bonus: { fontSize: 12, fontWeight: '700', color: '#A2DEC0', flexShrink: 1 }, delta: { fontWeight: '900', fontSize: 16 },
});
