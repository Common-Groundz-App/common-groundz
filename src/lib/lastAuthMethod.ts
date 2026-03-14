const STORAGE_KEY = 'cg_last_auth_method';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type AuthMethod = 'email' | 'google';

interface StoredAuth {
  method: AuthMethod;
  timestamp: number;
}

export function setLastAuthMethod(method: AuthMethod): void {
  try {
    const value: StoredAuth = { method, timestamp: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function getLastAuthMethod(): AuthMethod | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: StoredAuth = JSON.parse(raw);

    // Corruption guard
    if (parsed.method !== 'email' && parsed.method !== 'google') return null;

    // TTL guard
    if (Date.now() - parsed.timestamp > TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed.method;
  } catch {
    return null;
  }
}
