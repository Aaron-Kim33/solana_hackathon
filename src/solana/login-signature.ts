// Normalize transport layouts only. Server verification against its stored challenge is mandatory.
export function extractLoginSignature(signed: Uint8Array | undefined, message: Uint8Array): Uint8Array {
  if (!(signed instanceof Uint8Array)) throw new Error('INVALID_SIGNED_MESSAGE');
  if (signed.length === 64) return signed.slice(); // Detached Ed25519 signature.
  if (signed.length === message.length + 64) {
    if (message.every((byte, i) => signed[i] === byte)) return signed.slice(message.length);
    if (message.every((byte, i) => signed[i + 64] === byte)) return signed.slice(0, 64);
  }
  throw new Error('INVALID_SIGNED_MESSAGE');
}
