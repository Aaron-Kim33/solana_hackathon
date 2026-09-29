import { axeUpgradeReady, type Progress } from './progression.ts';

export const TUTORIAL_STEPS = ['chop', 'storage', 'sweep', 'trolley', 'tree', 'axe', 'character', 'fatigue'] as const;
export type TutorialStep = typeof TUTORIAL_STEPS[number];
export const TUTORIAL_ALL_SEEN = (1 << TUTORIAL_STEPS.length) - 1;

export function tutorialBit(step: TutorialStep): number {
  return 1 << TUTORIAL_STEPS.indexOf(step);
}

export function tutorialSeen(mask: number, step: TutorialStep): boolean {
  return (mask & tutorialBit(step)) !== 0;
}

export function nextTutorial(state: Progress, seen: number, groundLogs: number, panelOpen: boolean, coolingDown: boolean): TutorialStep | null {
  if (panelOpen || coolingDown) return null;
  if (!tutorialSeen(seen, 'tree') && state.treeHp === 0) return 'tree';
  if (!tutorialSeen(seen, 'chop') && state.treeHp > 0) return 'chop';
  if (!tutorialSeen(seen, 'storage') && groundLogs > 0) return 'storage';
  if (!tutorialSeen(seen, 'sweep') && tutorialSeen(seen, 'storage') && groundLogs >= 2) return 'sweep';
  if (!tutorialSeen(seen, 'trolley') && state.trolleyWood > 0 && !state.trolleyTrip) return 'trolley';
  const axeReady = axeUpgradeReady(state) || state.axeLevel > 1;
  if (!tutorialSeen(seen, 'axe') && axeReady) return 'axe';
  if (!tutorialSeen(seen, 'character') && tutorialSeen(seen, 'axe') && axeReady) return 'character';
  if (!tutorialSeen(seen, 'fatigue') && state.fatigue >= 80) return 'fatigue';
  return null;
}
