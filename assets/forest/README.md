# Forest art provenance

Generated for Lumber Rush on 2026-09-28 with built-in OpenAI ImageGen from this project's concept art; no third-party stock art was supplied.

- `background.png`: portrait forest clearing, darker top for the HUD, no foreground tree or character.
- `tree.png`: transparent old-tree sprite, rounded sunlit canopy and brown trunk.

Character art is maintained in `../forester`. Earlier woodcutter assets were removed after backup. Menus, text, economy and hit logic are not baked into these images.

## Storybook trolley (2026-10-01)

Generated with built-in OpenAI ImageGen, using the project's forest background and the user's gameplay screenshot as style references. Generation/edit mode; transparent backgrounds. No third-party stock art was supplied.

- `trolley-v2-empty.png`: empty cart.
- `trolley-v2-low.png`: two logs, used up to one third of capacity.
- `trolley-v2-medium.png`: five logs, used up to two thirds of capacity.
- `trolley-v2-full.png`: eight logs, used above two thirds of capacity.

Prompt set: a soft, simplified storybook-painted wooden trolley matching the forest, broad brush strokes, rounded chunky matte ochre wood, muted green bounce shadows, solid wooden disk wheels and a short left handle; no metal trim or photorealistic microtexture. Loaded variants preserve the same cart, canvas and ground baseline, adding rounded logs with painted end rings inside the bed and behind its front lip (two logs in one layer, five in two layers, eight in three layers).

Runtime assets are 384 × 256 RGBA PNGs on a shared canvas. Wheel baselines are aligned before resizing, so changing cargo stages does not move the cart. Logs are baked into each variant rather than drawn as separate UI shapes. Travel, cargo amounts and labels remain live UI/game state.
