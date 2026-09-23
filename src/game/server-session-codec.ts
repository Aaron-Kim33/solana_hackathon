const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function encodeServerSession(apiUrl: string, token: string): string {
  if (!TOKEN.test(token)) throw new Error('INVALID_SESSION');
  return JSON.stringify({ apiUrl, token });
}

export function decodeServerSession(raw: string | null, apiUrl: string): string | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const session = value as { apiUrl?: unknown; token?: unknown };
    return session.apiUrl === apiUrl && typeof session.token === 'string' && TOKEN.test(session.token)
      ? session.token : null;
  } catch { return null; }
}
