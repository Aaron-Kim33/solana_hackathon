import { StyleSheet, Text, View } from 'react-native';
import { translate, type TranslationKey } from '../i18n';
import { characterLevel, firstRecordBonusActive, masteryBonus, optionInfo, talentValue, type Progress, type MasteryAxe } from './progression';
import { autoPickupRemaining } from './auto-pickup';
import { formatNumber } from './format-number';

export function BuffPanel({ progress }: { progress: Progress }) {
  const t = (key: TranslationKey, value?: string | number) => translate(progress.language, key, value);
  const rows: { source: string; effect: string }[] = [];
  const add = (source: string, effect: string) => rows.push({ source, effect });
  const names = { default: 'defaultSkin', firstRecord: 'firstRecordSkinShort', pioneer: 'pioneerAxe', warden: 'wardenAxe', recovery: 'recoveryAxe' } as const;
  const level = characterLevel(progress.xp);
  add(t('buffCharacter'), `${t('critChance')} ${formatNumber(2 + (level - 1) * 0.1)}% · ${t('critDamage')} ${105 + level - 1}%`);
  // Base attack is identified separately, not mixed with percentage bonuses or slots.
  const offset = { default: 0, firstRecord: 0, pioneer: 98, warden: 249, recovery: 199 }[progress.axeSkin];
  const min = progress.axeLevel + offset;
  const max = min + (progress.axeSkin === 'recovery' ? 0 : progress.axeSkin === 'warden' ? 50 : 2);
  add(`${t('buffAxe')} · ${t(names[progress.axeSkin])}`, `${t('attackPower')} ${min === max ? min : `${min}–${max}`}`);
  if (progress.axeSkin === 'firstRecord') add(`${t('buffAxe')} · ${t('firstRecordSkinShort')}`, `${t('attackPower')} +2`);
  if (progress.axeSkin === 'pioneer') add(`${t('buffAxe')} · ${t('pioneerAxe')}`, t('masteryXp', 10));
  if (progress.axeSkin === 'recovery') add(`${t('buffAxe')} · ${t('recoveryAxe')}`, t('buffChance', 30));
  if (firstRecordBonusActive(progress)) add(t('buffPermanent'), `${t('attackPower')} +1`);
  const masteryEffects = { default: 'masteryDamage', firstRecord: 'masteryXp', pioneer: 'masteryCoins', warden: 'masteryCrit' } as const;
  for (const axe of Object.keys(masteryEffects) as MasteryAxe[]) {
    const value = masteryBonus(progress, axe);
    if (value) add(`${t('buffMastery')} · ${t(names[axe])}`, t(masteryEffects[axe], value));
  }
  progress.slots.forEach((id, index) => {
    if (!id) return;
    const option = optionInfo(id);
    add(`${t('buffSlot')} · ${t('slot', index + 1)} · ${t(option.tier ?? 'legacyOption')}`, `${t(option.kind)} +${formatNumber(option.value)}${option.kind === 'damage' ? '' : '%p'}`);
  });
  const remaining = Math.ceil(autoPickupRemaining(progress, Date.now()) / 1000);
  if (progress.talents.lumber) add(`${t('buffTalent')} · ${t('talentLumber')}`, t('masteryDamage', talentValue('lumber', progress.talents.lumber)));
  if (progress.talents.learning) add(`${t('buffTalent')} · ${t('talentLearning')}`, t('masteryXp', talentValue('learning', progress.talents.learning)));
  if (progress.talents.autoCollect) add(`${t('buffTalent')} · ${t('talentAuto')}`, remaining > 0 ? t('buffPickupOverride') : t('buffPickup', talentValue('autoCollect', progress.talents.autoCollect)));
  if (remaining > 0) add(t('buffTrial'), t('buffTrialTime', `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`));
  add(`${t('tree')} · Lv.${progress.treeLevel}`, t('treeBonus', progress.treeLevel));
  return <View style={styles.panel}>
    <Text style={styles.title}>{t('activeBuffs')}</Text>
    {rows.map((row, index) => <View key={index} style={styles.row}>
      <Text style={styles.source}>{row.source}</Text><Text style={styles.effect}>{row.effect}</Text>
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  panel: { backgroundColor: '#183D3D', borderRadius: 16, padding: 14, gap: 10 },
  title: { color: '#E6EFDD', fontSize: 16, fontWeight: '800' },
  row: { gap: 3, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#365A55', paddingTop: 8 },
  source: { color: '#A4BCB7', fontSize: 12 },
  effect: { color: '#B6E9CB', fontSize: 13, fontWeight: '600' },
});
