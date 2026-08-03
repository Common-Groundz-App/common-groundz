import { useState, useEffect, useCallback, useRef } from 'react';
import {
  notificationPreferencesService,
  NotificationPreferences,
  NotificationPreferenceKey,
  NOTIFICATION_PREFERENCE_DEFAULTS,
  NOTIFICATION_PREFERENCE_KEYS,
} from '@/services/notificationPreferencesService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type EffectiveNotificationPreferences = Record<NotificationPreferenceKey, boolean>;

/**
 * Builds the always-available effective preference object. A missing row is not
 * an error state — it means "documented defaults", matching
 * `public.notification_allowed` on the server.
 */
export function toEffectivePreferences(
  row: NotificationPreferences | null
): EffectiveNotificationPreferences {
  const effective = { ...NOTIFICATION_PREFERENCE_DEFAULTS };
  if (!row) return effective;
  for (const key of NOTIFICATION_PREFERENCE_KEYS) {
    const value = row[key];
    if (typeof value === 'boolean') {
      effective[key] = value;
    }
  }
  return effective;
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id ?? null;

  const [preferences, setPreferences] = useState<EffectiveNotificationPreferences>(
    () => ({ ...NOTIFICATION_PREFERENCE_DEFAULTS })
  );
  const [row, setRow] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<NotificationPreferenceKey[]>([]);

  // Account-generation guard: any fetch or mutation that resolves after the
  // signed-in user changed (switch or sign-out) is discarded silently.
  const generationRef = useRef(0);
  // Per-key monotonic sequences so an older response can never clobber a newer
  // local value for the same key, and never touch a different key at all.
  const keySeqRef = useRef<Partial<Record<NotificationPreferenceKey, number>>>({});
  const latestAppliedSeqRef = useRef<Partial<Record<NotificationPreferenceKey, number>>>({});
  const pendingRef = useRef<Set<NotificationPreferenceKey>>(new Set());

  const markPending = useCallback((key: NotificationPreferenceKey, pending: boolean) => {
    if (pending) {
      pendingRef.current.add(key);
    } else {
      pendingRef.current.delete(key);
    }
    setPendingKeys(Array.from(pendingRef.current));
  }, []);

  // Reset all per-account state the moment the account changes or signs out, so
  // the previous user's toggles are never on screen for the next one.
  useEffect(() => {
    generationRef.current += 1;
    keySeqRef.current = {};
    latestAppliedSeqRef.current = {};
    pendingRef.current = new Set();
    setPendingKeys([]);
    setPreferences({ ...NOTIFICATION_PREFERENCE_DEFAULTS });
    setRow(null);
    setIsLoading(Boolean(userId));
  }, [userId]);

  const fetchPreferences = useCallback(async () => {
    if (!userId) return;

    const generation = generationRef.current;
    const targetUserId = userId;
    setIsLoading(true);
    try {
      const data = await notificationPreferencesService.getPreferences(targetUserId);
      if (generationRef.current !== generation) return;

      setRow(data);
      const fetched = toEffectivePreferences(data);
      // A background refetch must not stomp a key with a write in flight.
      setPreferences(prev => {
        const next = { ...fetched };
        for (const key of pendingRef.current) {
          next[key] = prev[key];
        }
        return next;
      });
    } catch (err) {
      if (generationRef.current !== generation) return;
      console.error('[useNotificationPreferences] Error:', err);
    } finally {
      if (generationRef.current === generation) {
        setIsLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const setPreference = useCallback(
    async (key: NotificationPreferenceKey, value: boolean) => {
      if (!userId) return;

      const generation = generationRef.current;
      const targetUserId = userId;
      const seq = (keySeqRef.current[key] ?? 0) + 1;
      keySeqRef.current[key] = seq;

      const previousValue = preferences[key];
      setPreferences(prev => ({ ...prev, [key]: value }));
      markPending(key, true);

      try {
        const updated = await notificationPreferencesService.setPreference(
          targetUserId,
          key,
          value
        );

        if (generationRef.current !== generation) return;
        if ((keySeqRef.current[key] ?? 0) !== seq) return;
        if ((latestAppliedSeqRef.current[key] ?? 0) > seq) return;
        latestAppliedSeqRef.current[key] = seq;

        // Merge only this key plus server-owned fields; never adopt the whole
        // returned row over keys that have their own writes in flight.
        setRow(prev => ({
          ...(prev ?? updated),
          id: updated.id,
          user_id: updated.user_id,
          updated_at: updated.updated_at,
          [key]: updated[key],
        }) as NotificationPreferences);
        setPreferences(prev => ({ ...prev, [key]: Boolean(updated[key]) }));
      } catch (err) {
        if (generationRef.current !== generation) return;
        if ((keySeqRef.current[key] ?? 0) !== seq) return;

        // Revert only this key — never a whole snapshot, which could undo an
        // unrelated successful toggle.
        setPreferences(prev => ({ ...prev, [key]: previousValue }));
        toast({
          title: 'Could not update notification setting',
          description: 'Please try again',
          variant: 'destructive',
        });
      } finally {
        if (generationRef.current === generation) {
          markPending(key, false);
        }
      }
    },
    [userId, preferences, markPending, toast]
  );

  const isPending = useCallback(
    (key: NotificationPreferenceKey) => pendingKeys.includes(key),
    [pendingKeys]
  );

  return {
    /** Always-defined effective preferences (defaults applied when no row exists). */
    preferences,
    /** Raw row, or null when the user has never saved a preference. */
    preferencesRow: row,
    isLoading,
    setPreference,
    isPending,
    pendingKeys,
    refetch: fetchPreferences,
  };
}
