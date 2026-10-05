# Lumber Rush — Privacy and Support

Effective date: October 5, 2026. Contact: **hi.mellowcat@gmail.com**.

Lumber Rush is a mobile forest game operated by the Mellowcat project maintainer.
This notice describes the current preview. Ordinary play is server-managed, not entirely on-chain.

## Data used

- Local practice progress and audio preferences are stored on your device.
- Connecting a wallet provides its public address and a signed login message. The server
  stores the wallet/account link, login challenges, hashed session tokens, game progress,
  action receipts, reward claims and community contributions needed to operate the game.
- The app stores its server login session in the device's secure storage. The server never
  requests or stores your wallet seed phrase or private key.
- Network requests expose normal connection metadata to the hosting provider, Railway.
  Its service logs may contain request metadata. Game files do not contain advertising SDKs.
- Weekly contribution rankings are visible to signed-in players. They show an anonymous
  account-derived forester label, contributed material totals by facility, or boss damage
  and attack count. Rankings do not expose your wallet address, login token or account ID.
  The label is a stable pseudonym, not a guarantee that gameplay activity cannot be linked.

## Optional public blockchain record

Wallet login is a message signature, not a payment. Growth rewards do not require a
transaction. If you choose a Mainnet commemorative Memo, the app reviews a real SOL
network fee before asking your wallet to sign. Your wallet address, transaction and Memo
are public on Solana. Blockchain records cannot be erased by deleting a game account.
Older Devnet records are preserved separately.

## Storage, retention and providers

Connected game data is stored in the hosted API's persistent database. It is retained to
restore your progress until an account deletion request is completed or the service is
discontinued. Expired authentication rows are cleaned periodically when the updated
server handles authentication requests; this is not an immediate deletion guarantee.
Hosting infrastructure may process data outside your country. Railway hosts the API;
wallet providers process your wallet requests; Solana RPC services process optional
record checks. Their own privacy policies also apply.

The current game does not sell personal data or provide advertising or real-token payouts.

## Requests and support

Email **hi.mellowcat@gmail.com** for bugs, privacy questions or account deletion requests.
Include your public wallet address only if needed to identify a connected account.
Never send a seed phrase, private key or login token. Ownership may need to be verified
with a safe wallet-message signature before account changes. Deletion is handled by the
maintainer; there is no automatic deletion endpoint in the current app. We do not promise
an unimplemented self-service feature. Server deletion cannot remove public blockchain
history or copies of data controlled by independent providers.

Uninstalling the app can remove local practice data but does not delete connected server
progress. Signing out revokes the server session; it does not delete your account.

## 한국어 요약

문의·삭제 요청: **hi.mellowcat@gmail.com**. 로컬 연습은 기기에 저장되고, 지갑 연결 시 공개 지갑
주소·서명된 로그인 메시지·게임 진행·보상/공동 기여 기록 등을 서버에서 처리합니다. 개인 키나
시드 문구는 요청하거나 보관하지 않습니다. 로그인은 무료 메시지 서명이며, 선택형 Mainnet
기념 기록에는 실제 SOL 수수료가 필요합니다. 온체인 기록은 공개되고 삭제할 수 없습니다.
앱 삭제/로그아웃은 서버 계정 삭제가 아닙니다. 삭제는 이메일로 요청하며 소유 확인이 필요할 수
있습니다. 아직 자동 삭제 기능은 없으며 제3자 호스팅·지갑·RPC의 개인정보 정책도 적용됩니다.
주간 순위는 로그인한 유저에게 익명 벌목꾼 표식과 자재 기여량 또는 보스 피해·공격 횟수를 보여줍니다.
지갑 주소는 표시하지 않지만, 같은 표식의 활동을 연결할 수 있는 가명 표시입니다.
