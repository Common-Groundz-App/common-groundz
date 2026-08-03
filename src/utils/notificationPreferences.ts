import {
  NotificationPreferences,
  NotificationPreferenceKey,
  NOTIFICATION_PREFERENCE_DEFAULTS,
  NOTIFICATION_PREFERENCE_KEYS,
} from '@/services/notificationPreferencesService';

export type EffectiveNotificationPreferences = Record<NotificationPreferenceKey, boolean>;

/**
 * Pure preference-state helpers. Kept out of the React hook so the concurrency
 * rules (per-key ordering, refetch merging, account-generation guards) can be
 * unit tested without a DOM, a renderer, or a Supabase client.
 */

/**
 * Builds the always-available effective preference object. A missing row is not
 * an error state — it means "documented defaults", matching
 * `public.notification_allowed` on the server.
 */
export function toEffectivePreferences(
  row: NotificationPreferences | null | undefined
): EffectiveNotificationPreferences {
  const effective = { ...NOTIFICATION_PREFERENCE_DEFAULTS };
  if (!row) return effective;
  for (const key of NOTIFICATION_PREFERENCE_KEYS) {
    const value = (row as Record<string, unknown>)[key];
    if (typeof value === 'boolean') {
      effective[key] = value;
    }
  }
  return effective;
}

/**
 * A response is applied only when it is the newest request issued for that key
 * and no newer response for the key has already been applied. This is what
 * stops a slow "Likes" write from re-enabling a category the user just turned
 * off, and keeps each key's ordering independent of every other key's.
 */
export function shouldApplyKeyResponse(
  seq: number,
  currentSeq: number | undefined,
  latestAppliedSeq: number | undefined
): boolean {
  if ((currentSeq ?? 0) !== seq) return false;
  if ((latestAppliedSeq ?? 0) > seq) return false;
  return true;
}

/** Merges exactly one key — never a whole server row over pending local keys. */
export function applyKeyValue(
  prev: EffectiveNotificationPreferences,
  key: NotificationPreferenceKey,
  value: boolean
): EffectiveNotificationPreferences {
  return { ...prev, [key]: value };
}

/**
 * A background refetch is authoritative for every key EXCEPT those with a write
 * in flight, whose optimistic local value must survive.
 */
export function mergeFetchedPreferences(
  prev: EffectiveNotificationPreferences,
  fetched: EffectiveNotificationPreferences,
  pendingKeys: Iterable<NotificationPreferenceKey>
): EffectiveNotificationPreferences {
  const next = { ...fetched };
  for (const key of pendingKeys) {
    next[key] = prev[key];
  }
  return next;
}

/**
 * Guards every async resolution against account switches and sign-out. A
 * mismatch means the result belongs to a previous account and must be dropped
 * silently — no state write, no toast.
 */
export function isSameAccountGeneration(
  capturedGeneration: number,
  currentGeneration: number
): boolean {
  return capturedGeneration === currentGeneration;
}
