# Approved mascot — 2026-09-29

Created with built-in OpenAI ImageGen, not CLI. The approved small mascot mockup was the character reference; rejected realistic and older SOL character assets are not used.

Final runtime assets: `mascot-body.png`, `mascot-forearm.png`.

Prompt set:
1. Extract the tiny cute woodcutter from the approved game mockup as a transparent full-body sprite. Preserve orange knitted cap, cream dot-eye face without realistic nose/mouth, rounded hair/ear, sage tunic, brown belt/trousers/boots, short proportions and right-facing pose. Remove axe and near/right bare forearm/hand; preserve forward sleeve socket and hanging far arm. No scenery, text or external shadow.
2. Generate only a matching short plump cream forearm extending horizontally from rounded elbow on left to closed mitten grip on right, thumb above an imaginary vertical handle. Same soft painterly shading as body; no sleeve, axe, body, wrinkles, realistic anatomy or background. Genuine transparency.

The body and forearm share a 240-unit rig; the main scene renders at 155 units. The elbow stays at the sleeve socket, and the equipped axe shares the hand transform. Native-driver phases: idle -> windup -> strike -> idle. No new animation library or per-frame React state updates.

Generated originals remain under `.codex/generated_images/01a087cf-1eec-7211-acc1-c8774ccaaeb5`: body `exec-16b07020-ef64-45f8-b405-3fc534b70a13.png`, arm `exec-57273df4-20ef-4a3a-8594-e23805bf669a.png`. Approved mockup: `exec-673c8113-3f17-453e-bb6f-b0d12c3f55b0.png`.

Retired character assets were backed up to `C:/Users/User/AppData/Local/Temp/lumber-retired-characters-20260929.zip` before removal.
