// Bounded local feedback window, not authoritative gameplay time.
export function inputWindowDecision(ageMs: number, inFlight: boolean, unresolved: boolean): 'wait' | 'send' | 'discard' {
  if (ageMs < 0 || ageMs >= 2000 || (unresolved && !inFlight)) return 'discard';
  if (ageMs < 600 || inFlight) return 'wait';
  return 'send';
}
