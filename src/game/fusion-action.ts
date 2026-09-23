import { fuseGems, type Progress, type GemTier } from './progression.ts';

// A confirmation can execute once, but unrelated recovery updates must not cancel it.
export function createFusionAction(getState: () => Progress, commit: (next: Progress) => boolean, random = Math.random, source: GemTier = 'low') {
  let executed = false;
  return () => {
    if (executed) return { status: 'duplicate' as const };
    executed = true;
    const result = fuseGems(getState(), source, random);
    if (!result) return { status: 'unavailable' as const };
    if (!commit(result.state)) return { status: 'saveError' as const };
    return { status: 'saved' as const, ...result };
  };
}
