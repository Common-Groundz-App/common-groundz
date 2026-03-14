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

// --- Pending Google OAuth intent flag ---
const PENDING_KEY = 'cg_pending_google_auth';
const PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function setPendingGoogleAuth(): void {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify({ timestamp: Date.now() }));
  } catch {
    // silently ignore
  }
}

export function consumePendingGoogleAuth(): boolean {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return false;

    window.localStorage.removeItem(PENDING_KEY);

    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > PENDING_TTL_MS) return false;

    return true;
  } catch {
    return false;
  }
}

export function clearPendingGoogleAuth(): void {
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // silently ignore
  }
}
