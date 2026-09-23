# Consumable options (save v9)

- Opening a gem consumes one gem and produces one unused option.
- Equipping consumes one unused option and permanently replaces the destination slot. No unequip or refund exists.
- Matching options in both slots remain supported, consuming one copy per slot. Reapplying the identical option to the same slot is a no-op.
- The UI confirms consumption/replacement before saving. A stale confirmation cannot spend from a changed state.
- Until the introductory slot quest is complete, its reward option must go into slot 1, preventing accidental consumption in slot 2.
- Old saves retain equipped effects. Migration subtracts one inventory copy per equipped slot, because pre-v9 inventory counted equipped copies too. Remaining copies stay unused; migration is idempotent.
- Reward history remains valid after the rewarded option is consumed or overwritten. Slots are still shared between axes, as before this change.

# Pioneer Axe

- Base attack at level 1: 99–101 (axe level +98 through axe level +100).
- Existing permanent +1, slot effects, character criticals and lumber mastery apply on top.
- Existing axe levels are retained; upgrading still affects only the selected axe. The +10% hit XP bonus is unchanged.
- This is a power adjustment, not proof that the full year-long progression target is balanced.

# Verification

- 69 automated tests and TypeScript passed.
- Manual QA: confirm equip reduces unused count by one, cancel leaves inventory unchanged, replacement never refunds, and reloading retains equipped effects.
