# Release run — 2026-10-01

## Frozen gameplay source

- Commit: `885415f9d4b5b345901cdf59e665e2b03a75265a`.
- Full preflight: 217 tests, TypeScript and Android JS export passed before this commit.
- User explicitly approved proceeding without a backup after discussing loss/recovery risk. Commit `885415f` was pushed to GitHub main; the existing Railway autodeploy started.
- Unused earlier `assets/forest/trolley-v1.png` remains an untracked local art draft; the live UI references the four committed v2 images.

## EAS preview

- Build ID: `05d36d9f-ba72-4d93-a673-5ce94a96f8fe`.
- [Build page](https://expo.dev/accounts/mellowcat/projects/lumber-rush/builds/05d36d9f-ba72-4d93-a673-5ce94a96f8fe).
- Account/project: `mellowcat/lumber-rush`; package `com.lumberrush.seeker.preview`.
- Existing remote keystore reused; no new signing credential or paid-plan upgrade.
- Build **FINISHED** at `2026-10-01T08:15:48.784Z`, with commit `885415f`.
- [Download APK](https://expo.dev/artifacts/eas/5P8Kd4a5jBt72CMz7SJMYPFAQGAFomEQ-igtwvqkt5I.apk).
- Downloaded local file: `C:\Users\User\AppData\Local\Temp\lumber-rush-preview-885415f.apk`, 81,648,809 bytes.
- APK SHA-256: `3D599A25D367AD3CFE2BA27EB073058F94E50612A0C5E0108A74E67D66D17C7A`.
- `apksigner verify --print-certs` passed. Certificate SHA-256: `9a89001e84537965e58d61b2416a7ed4cea68476a459bcdce140e7333652d128`.
- `aapt dump badging` confirms `com.lumberrush.seeker.preview`, version 1.0.0/code 1, min SDK 24, target SDK 36, no `application-debuggable` entry. No installation, actual wallet handoff, real-device performance or gameplay verification is claimed.
- Public API/identity values verified in the EAS preview environment. No development PC URL is embedded.

## Railway gate

- Only project `adventurous-commitment`, service `solana_hackathon`, environment `production` selected.
- Project ID `e975288b-4ae9-4afa-a544-fb6025c9a7a9`; service ID `02b3f52e-9a16-45fd-939e-98d4e0b7cb2b`.
- Existing live deployment: `259cc7fa-da51-49dd-ae01-0c7b91c2cd23`, commit `50598fbec2ff9724538e89a37956b6a1e7f33d8e`. One running instance observed.
- Existing persistent volume `/data`: volume `abf65384-89fb-476e-ad8b-bc33e0ce1f77`, instance `481fc8cd-f627-4f20-a2fa-712dcc4871aa`, Ready.
- Backup listing returned no backups. The official `volumeInstanceBackupCreate` mutation returned `Not Authorized`; subsequent listing was still empty. No successful backup is claimed.
- The user's dashboard screenshot confirmed new Railway backups require Pro; no backups exist. The user declined the backup step and explicitly approved deployment without one. No Pro upgrade or SSH key registration was performed. Existing volume/database paths remain unchanged; this is not authorization to reset player data.
- A Railway volume backup is a recovery snapshot, not proof of a successful SQLite restore drill. Perform any restoration/integrity rehearsal on isolated data; never overwrite live player state for QA.

## Server deployment

- Deployment ID: `7b574012-6eab-4e89-8780-7939a80be390`.
- Trigger: GitHub main push, source commit `885415f9d4b5b345901cdf59e665e2b03a75265a` (same gameplay source as APK).
- Final observed status: **SUCCESS**. Deployment logs confirm the volume mounted and the preview API started on `0.0.0.0:8080` without a database startup error.
- Post-deploy live preflight passed: public HTTPS API health and wallet identity icon respond correctly.
- Existing volume instance `481fc8cd-f627-4f20-a2fa-712dcc4871aa` remains Ready at `/data`; one running service instance observed. No volume replacement or player reset was performed.
- Existing player's exact balances/relogin restoration and new gameplay remain real-device QA gates; startup/health alone do not verify them.

Next: install/update the completed Preview APK and verify existing progress, wallet restoration and new gameplay on a real Android device without Metro. Both APK and hosted gameplay source now match `885415f`. Backup/restore coverage remains unresolved and must not be reported as complete.
