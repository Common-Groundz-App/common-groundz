// Phase 2 — Pure helpers for resolve-brand-logo, extracted for offline testing.
// No Supabase, no network, no auth. Tested in ./index.test.ts.

export const RATE_LIMIT_PER_HOUR = 30;
export const RATE_WINDOW_MS = 60 * 60 * 1000;

export interface LogoSkipResponse {
  logoUrl: null;
  source: "none";
  cached: false;
  skipReason: string;
}

/** Lowercase + strip non-alphanumeric characters. */
export function normalizeBrand(raw: string): string {
  if (typeof raw !== "string") return "";
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Pure rate-limit decision.
 *   hits: prior hit timestamps for this user (ms epoch), oldest first or unordered.
 *   now:  current timestamp (ms epoch).
 * Returns true if this new hit is allowed (i.e. under the 30/hour rolling limit).
 * Ignores hits older than 1 hour before `now`.
 */
export function checkRateLimit(_userId: string, hits: number[], now: number): boolean {
  const cutoff = now - RATE_WINDOW_MS;
  const recent = hits.filter((t) => t > cutoff);
  return recent.length < RATE_LIMIT_PER_HOUR;
}

export function buildFlagOffResponse(): LogoSkipResponse {
  return { logoUrl: null, source: "none", cached: false, skipReason: "flag_off" };
}

export function buildRateLimitedResponse(): LogoSkipResponse {
  return { logoUrl: null, source: "none", cached: false, skipReason: "rate_limited" };
}
