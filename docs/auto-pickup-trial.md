# Auto pickup trial

- Tree level 50 reveals the bottom-left forest button. Opening it explains the feature and asks before consuming the daily trial.
- One 30-minute trial per UTC calendar day; no accumulated unused trials. An active trial cannot be restarted even across midnight.
- Fatigue 100 blocks activation. Activation does not charge currency, restore fatigue, or automatically chop trees.
- Only newly spawned wood is collected at 100%, through the existing atomic hit save. Existing ground drops stay manual. At expiry normal manual collection and talent odds apply.
- Optional v9 `autoPickupTrial.startedAt` persists the deadline and last used day. Old saves need no reset. Closing the app does not pause time.
- Expired trial button explains the future product; there is no payment or paid entitlement granted.
- Prototype only: device clock and local save are not trustworthy. Before release, use server time, account-bound daily grants and verified purchase entitlements. Clock rollback is rejected relative to the recorded start, but local edits/reinstalls/forward clock changes remain exploitable.

Manual QA: test level 49/50 visibility, cancel/start at fatigue 99/100, countdown after reopening, new-bundle pickup versus existing ground drops, and expiry/product messaging in both languages. Do not change real player progress for tests.
