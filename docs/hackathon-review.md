# Lumber Rush: hackathon review — 2026-09-14

Historical research note. Current approved requirements and priorities are in [CLOCK-IN-DELIVERY.md](./CLOCK-IN-DELIVERY.md), updated 2026-09-20 after reading the official registration site's Brief, Rules, FAQ and legal terms. In particular: the Brief specifies a three-minute demo, judging weights are 25% each, and winning apps must be publicly listed within 30 days of the winner announcement. Do not use the earlier uncertainty below as the current submission checklist.

## Verified sources and scope

- [Official mobile winners](https://solanamobile.com/blog/solana-mobile-hackathon-winners-announced): includes Memeshot (mobile PvP), DojoDuel (character duels), Scrolly (playable social feed), Mattle (skill-based survival with gameplay points/onchain activities). The announcement emphasizes mobile-first functionality and Solana/MWA integration. These are descriptions, not proof of why any individual won; apps were not installed or source-audited. The page currently displays July 14, 2026, but describes the inaugural event; do not infer original event chronology from that page date.
- [CLOCK IN announcement](https://solanamobile.com/blog/clock-in-the-solana-mobile-hackathon): Sep 8–Oct 8, 2026, functional Android APK, GitHub source, demo video, pitch/presentation. Criteria: retention/PMF, UX, innovation, presentation/demo. Optional meaningful SKR integration prize; winners must publish to dApp Store within the provided timeframe. Confirm exact closing time and full eligibility on the linked event rules. User has not explicitly identified their event; CLOCK IN is a current, relevant reference, not confirmed registration.
- [Colosseum advice](https://blog.colosseum.com/how-to-win-a-colosseum-hackathon/): prioritize a functional Devnet demo and user feedback. Its presentation/time rules are not automatically CLOCK IN rules.

## Implications (our judgment, not official scoring)

1. Lead with the mobile choice: attack versus collecting expiring drops. Token income is not the gameplay hook. Test whether people understand this in the first minute.
2. Prove one complete chain: play → unlock wallet → confirmed Devnet record → claim → visibly changed equipment. Record cancelled signatures, retries and persistence honestly; do not imply the memo is an NFT or validated score.
3. A server-verified fair challenge is a stronger competitive direction than purchased power determining reward rank. It is still unbuilt. Do not add real-time PvP solely because winners have it.
4. A SOL/SKR purchase button alone is a weak differentiation. Finish verified orders and durable inventory before considering an integration-prize claim. No native SKR devnet mint assumption and no fake payment success.
5. Focus remaining scope: authoritative persistence/auth → single end-to-end Devnet flow → first-minute UX/art/feedback → small fair challenge only if deliverable → real-device QA and submission. Defer more axe tiers, mainnet sales and automated airdrops.

## Applied now

- Korean/English in-app guide, accessible from the menu: core controls, fatigue/resources, wallet onboarding, consumable gems, quest/inventory shortcuts.
- Live local milestone status and explicit distinction between current local/Devnet features and future purchases/ranking/airdrops. No game economy or player save changes.

## Next user-test checklist

Use a separate test install/save, never overwrite the player's progress. Ask 3–5 new testers to play without verbal instructions. Record observations manually, with no analytics upload: time to first collected wood; understanding of expiry/attack exclusion; wallet cancellation recovery; where they get lost; whether they want another session. Do not invent retention numbers.

## Demo outline (suggested 2–3 minutes, not a verified event limit)

0:00–0:20 show tap/collect tradeoff and target player. 0:20–0:55 demonstrate manual collection and equipment choice. 0:55–1:40 show actual wallet/Devnet confirmation and reward chain. 1:40–2:10 show gems and progression. 2:10–2:40 distinguish completed features from server/fair-season roadmap and explain why players return. Identify any pre-progressed test account or recording cuts; no simulated chain success. Produce footage only after verifying on a device.

Submission gates: standalone APK opens without Metro; English default for submission with Korean switch; compatible wallet instructions and test funds; no debug grants in release; Android/Seeker QA; source access without secrets; actual demo video; presentation; applicable dApp Store/privacy requirements. None of these gates are satisfied merely by an Expo JS export.
