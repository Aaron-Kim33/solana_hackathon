# External Devnet test build — configuration, not deployment

## Current status

The app supports explicit `server-preview` mode, including server connection controls in a non-development bundle. Default mode retains existing local development behavior. Invalid preview configuration shows a blocking configuration screen, not a silent local fallback. An unsigned/not-connected local screen before explicit login is still separate local practice; server data is never imported from it.

No hosting account, external service, paid build or public listener has been created. The user owns `mellowcat.xyz` and chose a separate subdomain for Lumber Rush; `lumber.mellowcat.xyz` is the proposed wallet identity hostname, but its DNS and hosting have **not** been configured. The existing apex site belongs to another project and must not be changed. No externally usable APK is claimed. Current generated Android release configuration uses the development signing key; it is **not a store submission signing setup**. Railway payment remains deferred by user decision; the expired trial does not block local development.

The previous Expo starter icon has been superseded in `app.config.js` by `assets/lumber-rush-icon-v2.png` for the app and `assets/lumber-rush-adaptive-foreground-v2.png` for Android adaptive icons. These are new generated Lumber Rush assets, not replacements of the old files. The installed development app will retain its old launcher icon until a native rebuild; no current app data was deleted. A local Android JavaScript export succeeded, but that is neither an APK nor a release-signing test.

## Android APK profiles (configured, not built)

`eas.json` has two Android APK profiles. `preview` uses `com.lumberrush.seeker.preview` and a separate deep-link scheme; it can install beside the current `com.lumberrush.seeker` development app without uninstalling it. `dapp-store` retains `com.lumberrush.seeker` for the eventual store build. `app.config.js` selects the ID; an unknown `APP_VARIANT` fails configuration. The generated local `android/` folder is ignored by Git and still uses a debug key for release, so **do not submit its `assembleRelease` output**.

Before an actual cloud build, set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_IDENTITY_ORIGIN` in the matching EAS **preview** or **production** environment and verify their values. Both are public values embedded in the APK, not secrets. The `eas.json` profiles already set `APP_VARIANT` and `EXPO_PUBLIC_APP_MODE`. Check the URLs locally with `scripts/check-preview.mjs`, then run `node --experimental-strip-types scripts/check-preview.mjs --live` after deployment. The live check reads only HTTPS `GET /health` and the identity website's `/icon.png`: it requires a preview-mode API, the exact matching identity origin and PNG content. It never signs or modifies player data. Verify the EAS environment itself too; local PowerShell values alone do not prove that a cloud worker receives them. EAS configuration rejects missing, non-HTTPS or placeholder endpoints before bundling. Build commands, after account/hosting/signing approval:

```powershell
eas build --platform android --profile preview
eas build --platform android --profile dapp-store
```

EAS signing credentials have **not** been created. Keep a secure backup of the dApp Store signing key and credentials; future updates need the same key. The Solana dApp Store requires a signed **APK**, and its key must be separate from any Google Play key. Verify the actual artifact with `apksigner verify --print-certs <apk-path>`. Because the store package matches the existing development app but will use a different signing key, test store installation on a second device or after an explicit data-preservation plan—never uninstall the current app just to resolve a signature conflict.

## Wallet identity site prepared locally, not deployed

`npm run build:identity` copies the standalone static page and the current app icon into `dist/identity-site/`. A static host for the chosen separate subdomain must serve `index.html` at `/` and the PNG with `Content-Type: image/png` at `/icon.png`. The site has no JavaScript, account data or payment form. The MWA identity in the app uses the HTTPS origin plus relative `icon.png`, so both paths must work over a valid certificate. This folder can be hosted separately from the existing `mellowcat.xyz` project. Do not repoint the apex DNS or deploy this folder over the other project's site.

The current environment could not reach `mellowcat.xyz` through its network proxy, so the live site was **not** verified. No inference about its availability should be made from that failed local probe. Do not set `EXPO_PUBLIC_IDENTITY_ORIGIN` to the proposed subdomain until DNS, TLS and this page are live.

References: [Solana Mobile APK signing](https://docs.solanamobile.com/dapp-store/build-and-sign-an-apk), [Expo app variants](https://docs.expo.dev/build-reference/variants/), [EAS build environments](https://docs.expo.dev/eas/environment-variables/usage/).

## Railway deployment preparation (no payment or deployment yet)

The repository's `railway.json` selects the API launcher and `/health` check. Without that explicit launcher, this Expo repository's `npm start` would run Metro instead of the game API. The package specifies Node 24 because the API imports TypeScript through Node's type stripping.

When an external test is approved and billing is enabled:

1. Create **one** Railway API service from this repository; keep it at **one replica** for the current SQLite design. Attach a persistent volume mounted at `/data` before its first preview start. Do not mount over the source tree. Turn on a backup policy and perform a restore test before relying on hosted progress.
2. Set service variables `LUMBER_SERVER_MODE=preview`, `LUMBER_ALLOW_PUBLIC_BIND=true`, `LUMBER_DB_PATH=/data/lumber-rush.sqlite`, and `LUMBER_IDENTITY_ORIGIN=https://<approved-website-domain>`. Railway supplies `PORT`, `RAILWAY_PROJECT_ID`, and `RAILWAY_VOLUME_MOUNT_PATH`; do not invent the latter. On Railway, startup rejects a missing volume or a database path outside it.
3. Approve a Railway-generated HTTPS API domain or a dedicated API subdomain. Separately host the wallet identity website and `icon.png` under its own HTTPS origin. The API and mobile build must use the **same identity origin**. A domain used by another project can use separate subdomains, but do not repoint the existing project's records.
4. Confirm `GET https://<approved-api-domain>/health` and server restart persistence. Review edge rate limiting and access before inviting external testers. Then build a preview APK with the real public URLs above and verify it without Metro or `adb reverse`.

Payment can wait until the actual hosted test window. It cannot wait beyond the external-device APK gate: without a live HTTPS API, server-preview login and progress cannot work off the developer PC. Do not build an APK with placeholder URLs. Railway usage is metered and may exceed the plan's included usage, so set a budget/alert when enabling billing. If selected as a winner, the hackathon's later store-publication obligation may require a live service after judging; do not assume it can be shut down immediately after submission.

Railway references: [config as code](https://docs.railway.com/config-as-code/reference), [volumes](https://docs.railway.com/volumes), [public networking](https://docs.railway.com/networking/public-networking), [pricing](https://docs.railway.com/pricing/plans).

## Decisions required before building/distributing

1. User-approved hosting account/budget and an HTTPS API endpoint. SQLite currently needs one API instance and a durable local volume, not ephemeral/serverless storage or multiple replicas.
2. User-controlled separate HTTPS website origin for wallet identity, proposed `https://lumber.mellowcat.xyz`, with an available `/icon.png`. Mobile and API must use exactly the same identity origin. The API hostname may differ. DNS and deployment are still pending.
3. Android test device and distribution scope. A dedicated preview application ID is configured, but its signed APK is not built. Never uninstall the current app to resolve signature conflicts: that can erase local progress.
4. Before public exposure: TLS termination, request/body/rate limits at the edge, persistent volume backup/restore, restricted access and authentication review. Existing process-local limits do not replace edge protection. No public exposure until reviewed and authorized.

## Mobile build inputs (public, embedded in APK)

Set all three in the shell used for the build, using approved real domains:

```powershell
$env:EXPO_PUBLIC_APP_MODE = 'server-preview'
$env:EXPO_PUBLIC_API_URL = 'https://<approved-api-domain>'
$env:EXPO_PUBLIC_IDENTITY_ORIGIN = 'https://<approved-website-domain>'
node --experimental-strip-types scripts/check-preview.mjs
# Only after the API and identity website are live:
node --experimental-strip-types scripts/check-preview.mjs --live
```

Angle-bracket placeholders intentionally fail validation. Do not put credentials, private keys, RPC secrets or login tokens into `EXPO_PUBLIC_*`. The default checker validates syntax only; `--live` confirms the two public endpoints but not domain ownership, durable storage, signing or APK operation. Changing the URLs requires rebuilding/reloading the bundle; there is no remotely mutable endpoint switch.

## Server inputs (operator-only; do not enable now)

- `LUMBER_SERVER_MODE=preview`
- `LUMBER_ALLOW_PUBLIC_BIND=true` — explicit public-bind opt-in, not proof of TLS/security readiness
- `LUMBER_DB_PATH` — durable SQLite path on one server instance
- `LUMBER_IDENTITY_ORIGIN` — identical to mobile identity origin
- `PORT` — internal upstream port, default 8787
- Node 24-compatible runtime; start with `node --experimental-strip-types server/start.mjs`

Preview binds plain HTTP inside the hosting environment and **requires an HTTPS reverse proxy**. Never point the app directly to that HTTP port. Default launch without preview inputs continues binding only `127.0.0.1:8787` with the existing development DB.

## Acceptance gates

- Actual APK installs on a second Android device without removing existing saves.
- Metro stopped and no `adb reverse`: app launches, connects to approved HTTPS API, signs in, progresses, reconnects and verifies First Record.
- Devnet visibly identified; no real purchases or ranking/airdrop eligibility.
- Test rest/grant controls absent; Korean/English layouts checked; cancel/offline/insufficient Devnet SOL tested.
- Restart API and confirm persisted account/receipt. Backup restore tested separately.
- Release signing and privacy/support documents are separate submission gates.

Reference: https://docs.expo.dev/guides/environment-variables/
