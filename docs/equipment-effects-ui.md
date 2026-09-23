# Equipment and effect presentation

- The equipped axe card now has an accessible 44px dropdown button on its upper right. The old bottom Change Equipment button is removed.
- Wardrobe uses a horizontal owned-axe strip. Selection is preview-only until Equip is pressed. Existing locked Restoration Axe information remains accessible.
- Selected axe details distinguish unique effects (require equipping) from global mastery (active regardless of equipment).
- Only the highest reached mastery tier is labeled Active. Earlier tiers say they are included in a higher tier; unreached tiers are inactive. The two consumed slot options remain shared and are explicitly labeled as such.
- Character overview lists current character base/growth, equipped weapon effects, permanent first-record reward, each highest mastery bonus, both equipped slots with source/tier, talents, active free auto-pickup time, and tree bountiful effect. Trial pickup overrides rather than adds to talent pickup odds.
- No game balance, save data, purchases or equipment state changed by viewing these screens.

Manual QA: open axe via forest shortcut, press top-right dropdown, scroll axe strip, inspect inactive unique versus active mastery on an unequipped axe, equip and revisit overview. Check both languages and a narrow phone screen; verify free-trial expiration updates while overview is open. Automated type/core tests do not substitute for device layout verification.
