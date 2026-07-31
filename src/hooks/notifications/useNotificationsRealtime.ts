import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  validateRealtimePayload,
  createTrailingScheduler,
  type TrailingScheduler,
} from '@/utils/notificationRealtime';
import type { Notification } from '@/services/notificationService';

/**
 * Phase 2.4 — Steps 4-6: the realtime TRANSPORT.
 *
 * This hook owns exactly one user-scoped channel and nothing else. It does not
 * own rows, counts, cursors, or any reconciliation policy — it hands validated
 * rows and "please reconcile" signals to its owner (`useNotifications`).
 *
 * STATE MACHINE
 *   disabled     — kill switch off / signed out / offline. No channel exists and
 *                  the caller stays on its normal polling cadence.
 *   disconnected — a channel exists but has not joined (or dropped). Events
 *                  cannot be trusted; polling remains the delivery path.
 *   reconciling  — just joined or rejoined. Anything that happened while we were
 *                  not listening is invisible to us, so a reconcile runs BEFORE
 *                  any live event is trusted.
 *   ready        — joined and reconciled. Live events are applied as hints.
 *
 * Events that arrive while not `ready` are intentionally dropped: the reconcile
 * that gates `ready` is a superset of them.
 */

export type RealtimeStatus = 'disabled' | 'disconnected' | 'reconciling' | 'ready';

/** Trailing window for coalescing a burst into a single reconcile. */
const COALESCE_MS = 250;

export interface UseNotificationsRealtimeOptions {
  userId: string | undefined;
  /** Kill switch AND auth/online gate, resolved by the caller. */
  enabled: boolean;
  /** Fold a validated INSERT into local state. Delivery hint only. */
  onInsert: (row: Notification) => void;
  /** Apply a validated UPDATE to already-loaded rows. */
  onUpdate: (row: Notification) => void;
  /**
   * Authoritative catch-up: head refresh + unread count. Runs on every join and
   * rejoin, and on the trailing edge of every event burst. MUST resolve even on
   * failure — the state machine advances on settle, not on success.
   */
  onReconcile: () => Promise<void>;
}

// Dev-only guard against a second provider mounting a duplicate channel, which
// would double-apply every event. Keyed by the channel token, so switching users
// (a legitimate second channel for a different token) never trips it.
const activeChannelTokens = new Map<string, number>();

export function useNotificationsRealtime({
  userId,
  enabled,
  onInsert,
  onUpdate,
  onReconcile,
}: UseNotificationsRealtimeOptions): { status: RealtimeStatus } {
  const [status, setStatus] = useState<RealtimeStatus>('disabled');

  // Latest callbacks without re-subscribing: putting these in the effect deps
  // would tear down and rebuild the socket on nearly every render.
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const onReconcileRef = useRef(onReconcile);
  onReconcileRef.current = onReconcile;

  useEffect(() => {
    if (!enabled || !userId) {
      setStatus('disabled');
      return;
    }

    const token = `notifications:${userId}`;
    let disposed = false;
    // Only events observed while ready are trusted. A ref (not state) because
    // socket callbacks fire outside React's render cycle.
    const readyRef = { current: false };
    let scheduler: TrailingScheduler | null = null;

    if (import.meta.env.DEV) {
      const next = (activeChannelTokens.get(token) ?? 0) + 1;
      activeChannelTokens.set(token, next);
      if (next > 1) {
        console.error(
          `[notifications] duplicate realtime channel for ${token} (${next} active). ` +
            'Realtime must be owned by exactly one provider — see NotificationsContext.'
        );
      }
    }

    /** Run the authoritative catch-up, then trust live events. */
    const reconcileThenReady = async () => {
      if (disposed) return;
      readyRef.current = false;
      setStatus('reconciling');
      try {
        await onReconcileRef.current();
      } catch {
        // Swallowed on purpose: the caller surfaces its own fetch/count errors.
        // Realtime must not add a second error channel for the same failure.
      }
      if (disposed) return;
      readyRef.current = true;
      setStatus('ready');
    };

    scheduler = createTrailingScheduler(() => {
      if (disposed || !readyRef.current) return;
      // Reconcile is the source of truth; the merged hint above just makes the
      // row appear immediately.
      void onReconcileRef.current();
    }, COALESCE_MS);

    const channel = supabase
      .channel(token)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          // Server-side scoping. RLS already restricts the publication; this
          // keeps other users' rows off the wire entirely.
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (disposed || !readyRef.current) return;
          const row = validateRealtimePayload(payload.new, userId);
          // An unparseable payload is not ignored — it becomes a reconcile
          // request, so a schema drift degrades to polling latency, not silence.
          if (row) onInsertRef.current(row);
          scheduler?.schedule();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (disposed || !readyRef.current) return;
          const row = validateRealtimePayload(payload.new, userId);
          if (row) onUpdateRef.current(row);
          scheduler?.schedule();
        }
      )
      // DELETE is deliberately not subscribed: notifications are never hard
      // deleted by the app, and DELETE payloads carry only the replica identity.
      .subscribe((subscriptionStatus) => {
        if (disposed) return;
        if (subscriptionStatus === 'SUBSCRIBED') {
          // Covers both the first join and every rejoin after a drop.
          void reconcileThenReady();
          return;
        }
        // CHANNEL_ERROR / TIMED_OUT / CLOSED — stop trusting events; the
        // caller's polling keeps working untouched.
        readyRef.current = false;
        setStatus('disconnected');
      });

    return () => {
      disposed = true;
      readyRef.current = false;
      scheduler?.cancel();
      void supabase.removeChannel(channel);

      if (import.meta.env.DEV) {
        const remaining = (activeChannelTokens.get(token) ?? 1) - 1;
        if (remaining <= 0) activeChannelTokens.delete(token);
        else activeChannelTokens.set(token, remaining);
      }
    };
  }, [enabled, userId]);

  return { status };
}
