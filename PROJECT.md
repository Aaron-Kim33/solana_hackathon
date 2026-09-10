# Lumber Rush — Project State

## Product

Seeker-first touch action game: chop an ancient tree, collect dropped logs, and manage fatigue. Gameplay is off-chain; player identity, achievements, and future rewards use Solana.

## Stack

- Expo SDK 57 / React Native 0.86 / TypeScript
- Android custom development build (not Expo Go)
- Solana Mobile Wallet Adapter 2.0 on devnet
- `@solana/web3.js` for Solana public-key and transaction primitives

## Implemented

- Tap-to-chop, fatigue, damage scaling, tree fall, draggable log collection
- Every strike adds a log; uncollected logs expire individually 5 seconds after spawning
- Existing drops do not block chopping; only an active log drag blocks chopping
- Damage numbers appear inside the forest beside the tree
- Devnet wallet authorization entry point and wallet address display
- Typed Korean/English dictionary covering gameplay, wallet messages, and achievement UI
- Development defaults to Korean; release defaults to English; in-app language toggle
- Tree shake, floating damage, bouncing log drops, lifetime bars, and last-second fade
- Simple code-drawn tree canopy and bark replacing platform-dependent club glyphs
- First harvest (20 collected wood in the current session) unlocks a wallet-approved devnet Memo transaction
- Transaction submission and confirmation are separate; submitted signatures remain available in Explorer

## Verification and current limits

- TypeScript check and Android production bundle export passed.
- Translation key and interpolation-placeholder parity checked for Korean and English.
- Both language layouts and damage beside the tree inspected on Pixel_8 emulator.
- Official Mock MWA Wallet built successfully and installed as com.solana.mwallet on emulator-5554. Source: ../lumber-rush-tools/mock-mwa-wallet.
- Wallet end-to-end authorization/signing still requires user authentication in the test wallet and devnet funding.
- The Memo is a public commemorative demo, not a trusted score attestation or on-chain reward.
- Language selection, inventory, and achievement receipt currently live only in memory; persistence is still required.
- Final production artwork, axe animation, audio, accessibility gestures, and fatigue balancing remain pending.

## Next milestone

1. User authenticates the installed Solana Mock MWA Wallet in the emulator.
2. Verify authorization, fund the test wallet with devnet SOL, and exercise the achievement Memo flow.
3. Add language/game persistence and a coherent final art/audio pass after gameplay feedback.

## Guardrails

- Never put private keys, seed phrases, or real payment flows in the app.
- Keep all gameplay events off-chain; only verifiable milestones and ownership go on-chain.
- Replace the development identity domain before public release.
