# Lumber Rush — Project State

## Product

Seeker-first touch action game: chop an ancient tree, collect dropped logs, and manage fatigue. Gameplay is off-chain; player identity, achievements, and future rewards use Solana.

## Stack

- Expo SDK 57 / React Native 0.86 / TypeScript
- Android custom development build (not Expo Go)
- Solana Mobile Wallet Adapter 2.0 on devnet
- `@solana/web3.js` for Solana public-key and transaction primitives

## Implemented

- Save v8 adds three wood-funded character talents: lumber mastery (+5% final damage/level, max20), auto collection (unlock10%, 10 further upgrades to20%), learning (+2% hit XP/level, max10). See docs/talents-v1.md for costs and simulations
- Auto-collected bundles grant all wood including bountiful bonus in the same saved hit and never create draggable duplicates. Future trusted 100% pickup input has no purchase UI/active entitlement yet. Learning adds to Pioneer bonus; fractional XP migrates from tenths to hundredths

- Save v7: six sequential post-gem adventure quests, with explicit once-only claims for low gem / 300 coins / medium gem / Pioneer Axe + 900 coins / 1,000 coins / high gem. Quest panel shows one current adventure card
- Pioneer Axe: independent level starting at 1, gold/teal code artwork, +10% hit XP only while equipped. Fractional bonus carry survives restart/unequip; damage and tree-entry XP are unchanged. See docs/adventure-quests.md for tests and simulation

- Save v6: axe levels are per equipment, not shared skins. axeLevel is the equipped axe's level; unequippedAxeLevels stores other owned axes. Switching moves levels without changing coins, options or permanent bonuses. New axes start at 1; older shared-level saves preserve that level for every already-owned axe once. Quest thresholds use the highest owned axe level so switching cannot regress rewards

- Current economy (supersedes earlier XP/currency notes below): axe upgrades spend coins; trees spend wood. Automatic coins on every defeat plus independent 5% hit bonus. Hit XP scales with tree level; new tree entry grants one-time XP, wood collection no longer grants XP
- Save v5 migrates old levels and within-level XP progress without resetting fatigue or replaying rewards. New coin balance starts at zero. Growth quest now tree10/character5/axe15
- See docs/economy-v3.md and src/game/simulate-economy.mjs for current calibration and remaining endgame-duration concerns

- Five option-gem tiers: damage 3/6/12/21/30, crit chance 1/2/4/7/10pp, crit damage 13/26/52/91/130pp. Each gem rolls one same-tier option with equal thirds; duplicates stack when two copies are owned
- Growth quest chain: tree 10 + character 15 + axe 15 → claim one low gem once → open a low gem → equip its reward option in slot 1. Already-earned levels count
- Save v4 migrates v1–v3; preserves legacy test items and their original stats. Gem consumption and item grant share one saved state. Paid RNG/server entitlement verification is not implemented
- Character → Option gems provides tier counts, possible outcomes, result alert and slot-1 shortcut. Dev-only tier top-ups; higher-tier production acquisition is not yet defined
- First Record Axe now adds +2 while equipped, separately from the permanent first-equip +1

- Inventory-style Character UI: centered avatar and tappable axe slot; separate axe details, two option slots, owned appearance picker with actual combat-stat comparison, and passive skills page
- Hidden internal damage probability/wood-yield formulas from gameplay panels. Skin previews use equipAxeSkin + combatStats without mutating saves; permanent first-record bonus correctly remains active when switching appearances
- First-record reward chain: confirmed Devnet record → claim commemorative axe skin → first equip unlocks permanent +1 damage without an option slot → collect 100 additional wood
- Claim alone does not grant damage. First-equip unlock persists when changing skins/upgrading axes. Repeated claim/equip cannot stack it
- Korean/English reward, skin and quest UI; code-drawn purple/mint commemorative axe shown in reward preview, portrait and forest
- Save v3 migrates v1/v2 resources and receipts; already-confirmed records can claim once per local save. This is NOT an NFT or server-enforced wallet-wide entitlement
- Fixed, non-scrolling gameplay surface; top-left menu opens separate quest and character panels
- Character panel shows a code-drawn woodcutter, axe upgrades, two persistent option slots and critical passives; gameplay includes an XP bar
- Tree remains felled at 0 HP. Its marker opens an upgrade cost dialog; insufficient wood disables upgrading
- Free same-tier regrowth prevents a dead end when upgrades are unaffordable or at maximum tier
- Tree upgrades are enforced at 0 HP in game logic as well as UI; quest cards no longer bypass this gate

- Tap-to-chop, fatigue, damage scaling, tree fall, draggable log collection
- Each strike drops a bundle of floor(final damage × 0.7) wood; zero-yield hits create no bundle. Uncollected bundles expire individually after 5 seconds
- Existing drops do not block chopping; only an active log drag blocks chopping
- Damage numbers appear inside the forest beside the tree
- Devnet wallet authorization entry point and wallet address display
- Typed Korean/English dictionary covering gameplay, wallet messages, and achievement UI
- Development defaults to Korean; release defaults to English; in-app language toggle
- Tree shake, floating damage, bouncing log drops, lifetime bars, and last-second fade
- Simple code-drawn tree canopy and bark replacing platform-dependent club glyphs
- Cumulative harvest of 20 wood unlocks wallet connection, even after spending wood
- Ordered quests: harvest 20 → connect wallet → axe Lv.2 → character Lv.2 → tree Lv.2 → confirmed devnet record
- Axe Lv.L rolls L/L+1/L+2 damage at 50/30/20% (cap 200); no rhythm bonus or fatigue damage penalty
- Provisional axe upgrade cost remains 20 × current level wood
- Tree HP is 200 + 100 × level (cap 1000); provisional upgrade cost remains 30 × current level wood, with no tree yield multiplier
- Bountiful harvest: eligible hits (base wood ≥1) independently roll 10% for +tree level wood; one golden bundle includes base + bonus, awarded as currency/XP only on collection within 5 seconds
- Tree appearances change every 50 levels: 20 code-drawn prototype palettes/shapes, not final artwork
- Collected wood awards equal XP; character cap 200, level 2 requires 30 XP; every new level resets fatigue
- Character crit chance starts at 2% and adds 0.1 percentage points per level; total critical damage starts at 105% and adds 1 point per level (Lv.200: 21.9% / 304%)
- Two equipment slots retain options across axe upgrades; dev-only sample grant supplies +2 damage, +2 percentage-point crit chance and +10 percentage-point crit damage items
- Every accepted strike adds 1 fatigue point; 100 strikes fill fatigue unless recovery or leveling intervenes
- Fatigue recovers by 20 percentage points every 30 minutes, including time away from the app
- Development-only Rest button retains instant recovery of 28 points; paid recovery is not implemented
- Two alternating validated local save files persist growth, language, fatigue clock, quest history, and public transaction receipts
- Transaction submission and confirmation are separate; submitted signatures remain available in Explorer

## Verification and current limits

- 2026-09-12 record failure diagnosis: Mock MWA Wallet rejected transaction with RPC -32002; connected address had 0 lamports on Devnet. Added balance/fee checks before signing and visible quest notices + alerts (previous errors were hidden behind the modal). 28 unit tests pass. Funding and successful live confirmation still require user follow-through
- First-record reward model: 25 tests passed, including pending/failed receipt rejection, delayed first-equip activation, no stacking, 100-wood counter boundaries and v1/v2 migration
- Bountiful harvest: 19 automated tests pass; paired five-seed simulations at 100%/80% collection recorded in docs/balance-v2.md. Bonus improves early progression but does not resolve ending duration or existing continuous level-up fatigue refills
- 2026-09-12 v2: 16 automated tests, TypeScript and Android production export passed; Korean/English gameplay and Korean character/slot panels inspected on Pixel_8
- Existing device progress (424 wood, axe Lv.7, character Lv.9, tree Lv.5 felled) migrated successfully; language returned to Korean, no wood spent or test items granted during inspection
- Three deterministic workload simulations recorded in docs/balance-v2.md; not a calendar-time or revenue forecast
- TypeScript check and Android production bundle export passed.
- Translation key and interpolation-placeholder parity checked for Korean and English.
- Both language layouts and damage beside the tree inspected on Pixel_8 emulator.
- Official Mock MWA Wallet built successfully and installed as com.solana.mwallet on emulator-5554. Source: ../lumber-rush-tools/mock-mwa-wallet.
- Wallet end-to-end authorization/signing still requires user authentication in the test wallet and devnet funding.
- The Memo is a public commemorative demo, not a trusted score attestation or on-chain reward.
- Wallet sessions are not persisted; reconnect after restart when signing is needed. Connection quest history remains complete.
- Recovery uses the device clock; server-authoritative time and gameplay validation are required before a paid economy.
- Version 1 disk saves migrate to version 2 without resetting resources, quests, receipts or fatigue; remaining tree HP is preserved proportionally
- See docs/balance-v2.md: the requested numbers do NOT yet meet the 365-day / fast-first-100 pacing target
- Final production artwork, axe animation, audio, accessibility gestures, and fatigue balancing remain pending.

## Next milestone

Current delivery priorities and release gates are maintained in [CLOCK-IN-DELIVERY.md](docs/CLOCK-IN-DELIVERY.md). Earlier implementation notes in this file are historical; they are not the current balance specification or evidence of server/release completion.

1. Complete the existing first-record quest journey on server-owned progress: validate the wallet's transaction, grant the reward once, equip the axe, and advance the quest. Preserve local saves.
2. Verify persistence/reconnect and prepare an externally testable Android APK. The current loopback API and JavaScript export alone do not meet this gate.
3. Improve first-five-minute UX/art and one fixed cosmetic purchase flow, followed by submission QA/video/documentation. Optional content must not displace these gates.

Local gameplay stalls remain unresolved; further diagnosis is deferred at the user's request pending a comparison without another PC game running. Automated tests are not proof of smooth gameplay.

## Guardrails

- Never put private keys, seed phrases, or real payment flows in the app.
- Keep all gameplay events off-chain; only verifiable milestones and ownership go on-chain.
- Replace the development identity domain before public release.
