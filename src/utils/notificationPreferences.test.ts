import { describe, it, expect } from 'vitest';
import {
  toEffectivePreferences,
  shouldApplyKeyResponse,
  applyKeyValue,
  mergeFetchedPreferences,
  isSameAccountGeneration,
  EffectiveNotificationPreferences,
} from './notificationPreferences';
import {
  NOTIFICATION_PREFERENCE_DEFAULTS,
  NotificationPreferences,
} from '@/services/notificationPreferencesService';

const row = (overrides: Partial<NotificationPreferences>): NotificationPreferences =>
  ({
    id: 'pref-1',
    user_id: 'user-1',
    weekly_digest_enabled: false,
    journey_notifications_enabled: true,
    likes_enabled: true,
    comment_likes_enabled: true,
    comments_enabled: true,
    replies_enabled: true,
    mentions_enabled: true,
    follows_enabled: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }) as NotificationPreferences;

describe('toEffectivePreferences', () => {
  it('applies documented defaults when the user has no preference row', () => {
    const effective = toEffectivePreferences(null);
    expect(effective).toEqual(NOTIFICATION_PREFERENCE_DEFAULTS);
    // Explicitly pin the missing-row contract shared with notification_allowed.
    expect(effective.likes_enabled).toBe(true);
    expect(effective.journey_notifications_enabled).toBe(true);
    expect(effective.weekly_digest_enabled).toBe(false);
  });

  it('reflects stored values over defaults', () => {
    const effective = toEffectivePreferences(
      row({ likes_enabled: false, weekly_digest_enabled: true })
    );
    expect(effective.likes_enabled).toBe(false);
    expect(effective.weekly_digest_enabled).toBe(true);
    expect(effective.mentions_enabled).toBe(true);
  });

  it('falls back to the default for a column missing from the payload', () => {
    const partial = { id: 'p', user_id: 'u' } as unknown as NotificationPreferences;
    expect(toEffectivePreferences(partial).comments_enabled).toBe(true);
  });
});

describe('shouldApplyKeyResponse — per-key ordering', () => {
  it('applies the newest request for a key', () => {
    expect(shouldApplyKeyResponse(2, 2, 1)).toBe(true);
  });

  it('discards a stale success that resolved after a newer toggle', () => {
    // Toggle #1 resolves late while toggle #2 is already the current request.
    expect(shouldApplyKeyResponse(1, 2, undefined)).toBe(false);
  });

  it('discards an out-of-order response when a newer one already applied', () => {
    expect(shouldApplyKeyResponse(2, 3, 3)).toBe(false);
  });

  it('treats an untracked key as sequence zero', () => {
    expect(shouldApplyKeyResponse(1, 1, undefined)).toBe(true);
  });
});

describe('applyKeyValue — single-key merges only', () => {
  it('changes only the named key', () => {
    const prev = { ...NOTIFICATION_PREFERENCE_DEFAULTS };
    const next = applyKeyValue(prev, 'likes_enabled', false);
    expect(next.likes_enabled).toBe(false);
    expect(next.mentions_enabled).toBe(true);
    expect(next.comments_enabled).toBe(true);
    expect(prev.likes_enabled).toBe(true); // no mutation
  });

  it('reverting one key never undoes another key that succeeded', () => {
    let state: EffectiveNotificationPreferences = { ...NOTIFICATION_PREFERENCE_DEFAULTS };
    state = applyKeyValue(state, 'likes_enabled', false); // optimistic, will fail
    state = applyKeyValue(state, 'mentions_enabled', false); // succeeds
    state = applyKeyValue(state, 'likes_enabled', true); // revert only likes
    expect(state.likes_enabled).toBe(true);
    expect(state.mentions_enabled).toBe(false);
  });
});

describe('mergeFetchedPreferences — refetch respects in-flight keys', () => {
  it('adopts server values for keys with no write in flight', () => {
    const prev = { ...NOTIFICATION_PREFERENCE_DEFAULTS };
    const fetched = toEffectivePreferences(row({ comments_enabled: false }));
    const next = mergeFetchedPreferences(prev, fetched, []);
    expect(next.comments_enabled).toBe(false);
  });

  it('keeps the optimistic value for a key with a write in flight', () => {
    const prev = applyKeyValue({ ...NOTIFICATION_PREFERENCE_DEFAULTS }, 'likes_enabled', false);
    const fetched = toEffectivePreferences(row({ likes_enabled: true, follows_enabled: false }));
    const next = mergeFetchedPreferences(prev, fetched, new Set(['likes_enabled'] as const));
    expect(next.likes_enabled).toBe(false); // pending local value survives
    expect(next.follows_enabled).toBe(false); // non-pending key adopts server
  });
});

describe('isSameAccountGeneration — account switch safety', () => {
  it('accepts a resolution from the current account', () => {
    expect(isSameAccountGeneration(3, 3)).toBe(true);
  });

  it('discards a fetch that resolves after an account switch', () => {
    expect(isSameAccountGeneration(3, 4)).toBe(false);
  });

  it('discards a mutation that resolves after sign-out', () => {
    // Sign-out bumps the generation exactly like a switch does.
    expect(isSameAccountGeneration(1, 2)).toBe(false);
  });
});
