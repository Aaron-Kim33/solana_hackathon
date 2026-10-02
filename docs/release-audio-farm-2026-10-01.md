# Audio / farm release — 2026-10-01

- User explicitly approved updating Railway and building a combined Preview APK.
- Frozen source: `04e9dba0ad3c9646fb5f2e27dcc629ba0bcfe2a1`, pushed to GitHub main.
- Includes CC0 BGM/SFX, independent sound settings, axe Change button, unlimited planting,
  separate waterway watering, and four-karma 20-minute double chopping wood/coin blessing.
- Preflight: TypeScript, all 231 tests and Android export passed. Unused trolley-v1 draft
  excluded from commit; runtime databases and keys remain ignored.
- Existing Railway project/service/environment only; persistent `/data` volume unchanged.
  Previously acknowledged lack of Railway backup remains unresolved; no plan upgrade or reset.
- Railway deployment ID: `67d0bbfd-f1f8-4ebe-9e2e-0ee10151a976`; **SUCCESS**, matching frozen source.
  Logs show volume mount and API startup on 0.0.0.0:8080. Live HTTPS API/identity preflight passed.
- EAS build ID: `3484208e-5885-466c-9d1b-97f97cfaeed3`; request accepted, observed IN_QUEUE.
- [EAS build](https://expo.dev/accounts/mellowcat/projects/lumber-rush/builds/3484208e-5885-466c-9d1b-97f97cfaeed3).
- Existing remote preview signing credentials reused. Package `com.lumberrush.seeker.preview`;
  preview environment retains the public Railway HTTPS API and lumber.mellowcat.xyz identity.

Pending: final deployment/health and build result, APK package/certificate verification,
then actual Seeker installation, sound quality, farm flow and saved account QA. Do not
uninstall the existing Preview app; use an in-place update after certificate verification.
