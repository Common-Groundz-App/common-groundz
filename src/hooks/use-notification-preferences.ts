import { useState, useEffect, useCallback, useRef } from 'react';
import {
  notificationPreferencesService,
  NotificationPreferences,
  NotificationPreferenceKey,
  NOTIFICATION_PREFERENCE_DEFAULTS,
} from '@/services/notificationPreferencesService';
import {
  EffectiveNotificationPreferences,
  toEffectivePreferences,
  shouldApplyKeyResponse,
  applyKeyValue,
  mergeFetchedPreferences,
  isSameAccountGeneration,
} from '@/utils/notificationPreferences';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type { EffectiveNotificationPreferences };

export function useNotificationPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id ?? null;

  const [preferences, setPreferences] = useState<EffectiveNotificationPreferences>(() => ({
    ...NOTIFICATION_PREFERENCE_DEFAULTS,
  }));
  const [row, setRow] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<NotificationPreferenceKey[]>([]);

  // Account-generation guard: any fetch or mutation resolving after the signed-in
  // user changed (switch or sign-out) is discarded silently.
  const generationRef = useRef(0);
  // Per-key monotonic sequences so an older response can never clobber a newer
  // local value for the same key, and never touch a different key at all.
  const keySeqRef = useRef<Partial<Record<NotificationPreferenceKey, number>>>({});
  const latestAppliedSeqRef = useRef<Partial<Record<NotificationPreferenceKey, number>>>({});
  const pendingRef = useRef<Set<NotificationPreferenceKey>>(new Set());
  // Read inside setPreference without making it depend on `preferences`, so a
  // rapid second toggle always captures the true pre-request value.
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

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
    setIsLoading(true);
    try {
      const data = await notificationPreferencesService.getPreferences(userId);
      if (!isSameAccountGeneration(generation, generationRef.current)) return;

      setRow(data);
      const fetched = toEffectivePreferences(data);
      setPreferences(prev => mergeFetchedPreferences(prev, fetched, pendingRef.current));
    } catch (err) {
      if (!isSameAccountGeneration(generation, generationRef.current)) return;
      console.error('[useNotificationPreferences] Error:', err);
    } finally {
      if (isSameAccountGeneration(generation, generationRef.current)) {
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

      const previousValue = preferencesRef.current[key];
      setPreferences(prev => applyKeyValue(prev, key, value));
      markPending(key, true);

      try {
        const updated = await notificationPreferencesService.setPreference(
          targetUserId,
          key,
          value
        );

        if (!isSameAccountGeneration(generation, generationRef.current)) return;
        if (!shouldApplyKeyResponse(seq, keySeqRef.current[key], latestAppliedSeqRef.current[key])) {
          return;
        }
        latestAppliedSeqRef.current[key] = seq;

        // Merge only this key plus server-owned fields; never adopt the whole
        // returned row over keys that have their own writes in flight.
        setRow(prev =>
          ({
            ...(prev ?? updated),
            id: updated.id,
            user_id: updated.user_id,
            updated_at: updated.updated_at,
            [key]: updated[key],
          }) as NotificationPreferences
        );
        setPreferences(prev => applyKeyValue(prev, key, Boolean(updated[key])));
      } catch (err) {
        if (!isSameAccountGeneration(generation, generationRef.current)) return;
        if ((keySeqRef.current[key] ?? 0) !== seq) return;

        // Revert only this key — never a whole snapshot, which could undo an
        // unrelated successful toggle.
        setPreferences(prev => applyKeyValue(prev, key, previousValue));
        toast({
          title: 'Could not update notification setting',
          description: 'Please try again',
          variant: 'destructive',
        });
      } finally {
        if (isSameAccountGeneration(generation, generationRef.current)) {
          markPending(key, false);
        }
      }
    },
    [userId, markPending, toast]
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
