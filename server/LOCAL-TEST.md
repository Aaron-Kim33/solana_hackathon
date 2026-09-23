# Local API and Android login test

Run from `C:\Users\User\Desktop\lumber-rush`:

```powershell
node --experimental-strip-types server/start.mjs
```

In another terminal, with the intended emulator connected:

```powershell
adb -s emulator-5554 reverse tcp:8787 tcp:8787
```

Reload Metro, open the menu, select **Server login test**. The first button checks the local API, opens MWA authorization and requests a login-only message signature. Approve only after checking the message. The server returns a separate fresh account, not an uploaded local save. Refresh and logout are available. No actual payment or game-state upload is performed.

The API binds only 127.0.0.1:8787. `server/local-dev.sqlite` is created when starting it, with no test grants. Stop with Ctrl+C. No background daemon is installed. Verify the emulator ID using `adb devices`; do not assume 5554 if multiple devices are connected.

Client tokens are kept in Expo SecureStore and scoped to the configured API URL. On a cold app start the token is verified against `/me` before server progress is shown; a network failure leaves the account unavailable for retry, not merged with local rewards. Logout attempts server revocation and removes the device token; a 401 removes the device token. Server sessions still expire after 24 hours. This requires the rebuilt development app, and the wallet-login → cold-restart → automatic recovery path still needs manual Android QA. Do not use the ordinary local save as a trusted server balance.

Development builds may allow cleartext loopback HTTP. If Android rejects it, check the development network security configuration; do not enable global cleartext for production. Release builds hide this test panel. The `.example` identity is development-only, not a verified production domain.

HTTP scope: health, challenge, login, account read, validated commands and logout. JSON body limit 4KB, timeouts, error redaction and origin rejection are present. Authenticated requests have a 600/minute limit per verified player ID (shared across that player's sessions); anonymous/invalid-session requests use a separate 600/minute direct-IP limit. Forwarded IP headers are intentionally not trusted. Buckets expire and are capped at 10,000 per limiter. Restart resets these process-local limits. No public deployment: production still needs HTTPS, edge abuse protection, challenge cleanup, auth schema migrations, proper domain association, monitoring and backup review. These limits are not a production anti-abuse system.

## Server chopping test

Restart `server/start.mjs` after updating (Ctrl+C then the same command), then reload Metro. SQLite schema v2 adds `play_state` without replacing players or receipts. Login, tap the test tree and drag its wood cards at least 12 pixels. Damage, fatigue, XP, drops and balances are calculated server-side; wood expires exactly 5 seconds after server creation. The client sends drop IDs, never wood amounts. Collection and hit changes are persisted atomically with receipts/audit. Tree upgrade/regrow and natural recovery are available. No paid entitlements or test-rest bypass is enabled here.

Commands enforce a prototype 150ms minimum action interval and 250ms post-collection lock. This is not full gesture-duration validation or anti-bot protection. Full production gameplay, automatic pickup entitlement, axe management, season rules and ranking remain unconnected. Current test accounts must not be used for reward distribution.

Uncertain requests remain pending in memory and retry with the same ID. A fresh `/me` fetch follows successful commands to avoid showing an old receipt as latest state. Closing/reloading the app loses the pending request, but fetching server state on the next login shows committed progress. The main local forest remains completely separate.

Automated HTTP test uses an ephemeral key and disposable DB. Actual Android wallet signing has NOT been verified by the agent. Test cancellation, wrong signature, server stopped, repeated refresh, logout, restart and both languages manually. Native signed-message extraction follows MWA's message-plus-appended-signature format.
