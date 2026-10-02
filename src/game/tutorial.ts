import { axeUpgradeReady, fatiguePotionCount, highestAxeLevel, type Progress } from './progression.ts';
import type { ForestShortcutUnlocks } from './shortcut-unlocks';

export const TUTORIAL_STEPS = ['chop', 'storage', 'sweep', 'trolley', 'tree', 'axe', 'character', 'fatigue', 'gem', 'map', 'pet', 'potion'] as const;
export type TutorialStep = typeof TUTORIAL_STEPS[number];
export const TUTORIAL_ALL_SEEN = (1 << TUTORIAL_STEPS.length) - 1;
export const TUTORIAL_LEGACY_ALL_SEEN = (1 << 8) - 1;

export function tutorialBit(step: TutorialStep): number {
  return 1 << TUTORIAL_STEPS.indexOf(step);
}

export function tutorialSeen(mask: number, step: TutorialStep): boolean {
  return (mask & tutorialBit(step)) !== 0;
}

export function nextTutorial(state: Progress, seen: number, groundLogs: number, panelOpen: boolean, coolingDown: boolean,
  shortcuts: ForestShortcutUnlocks = { gems: false, map: false, pet: false }): TutorialStep | null {
  if (panelOpen || coolingDown) return null;
  if (!tutorialSeen(seen, 'potion') && fatiguePotionCount(state) > 0) return 'potion';
  if (!tutorialSeen(seen, 'tree') && state.treeHp === 0) return 'tree';
  if (!tutorialSeen(seen, 'chop') && state.treeHp > 0) return 'chop';
  if (!tutorialSeen(seen, 'storage') && groundLogs > 0) return 'storage';
  if (!tutorialSeen(seen, 'sweep') && tutorialSeen(seen, 'storage') && groundLogs >= 2) return 'sweep';
  if (!tutorialSeen(seen, 'trolley') && state.trolleyWood > 0 && !state.trolleyTrip) return 'trolley';
  const axeReady = axeUpgradeReady(state) || highestAxeLevel(state) > 1;
  if (!tutorialSeen(seen, 'axe') && axeReady) return 'axe';
  if (!tutorialSeen(seen, 'character') && tutorialSeen(seen, 'axe') && axeReady) return 'character';
  if (!tutorialSeen(seen, 'gem') && tutorialSeen(seen, 'axe') && shortcuts.gems) return 'gem';
  if (!tutorialSeen(seen, 'map') && tutorialSeen(seen, 'gem') && shortcuts.map) return 'map';
  if (!tutorialSeen(seen, 'pet') && tutorialSeen(seen, 'map') && shortcuts.pet) return 'pet';
  if (!tutorialSeen(seen, 'fatigue') && state.fatigue >= 80) return 'fatigue';
  return null;
}
