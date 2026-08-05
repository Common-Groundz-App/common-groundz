import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAuthPrompt } from '@/hooks/useAuthPrompt';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import {
  chunkFollowBackActorIds,
  collectFollowBackActorIds,
  getFollowBackActorId,
} from '@/utils/notificationFollowBack';
import {
  FOLLOW_STATUS_CHANGED_EVENT,
  dispatchFollowStatusChanged,
  isUniqueViolation,
  parseFollowStatusChanged,
} from '@/utils/followEvents';
import type { NotificationGroup } from '@/utils/notificationGrouping';

/**
 * Phase 3.3B — the drawer's single follow authority.
 *
 * Why not `useUserFollowing`: that hook collapses loading AND error into `[]`,
 * so "not following" is indistinguishable from "we don't know". That ambiguity
 * is exactly what produces a wrong "Follow back" label on someone you already
 * follow, so this hook exposes a real tri-state instead.
 *
 * Contract:
 *  - batched, account-scoped reads in bounded chunks (never one per row);
 *  - `unknown` until the owning chunk conclusively settles, and `unknown` again
 *    (not `not_following`) when the chunk errored — no button is rendered then;
 *  - gates run in the same order as `use-follow.ts`: requireAuth, then email
 *    verification;
 *  - the insert is ON CONFLICT DO NOTHING (`ignoreDuplicates`), so a duplicate
 *    follow is a success and never needs UPDATE privileges on `follows`;
 *  - one in-flight follow per actor;
 *  - viewer id is captured before every read/mutation and re-checked after, so a
 *    sign-out or account switch mid-request can never toast or leak state;
 *  - on success it updates its own cache, touches the shared follow caches and
 *    dispatches `follow-status-changed` so profile counts stay in sync.
 *
 * Deliberately NOT a toggle: the drawer can follow, never unfollow.
 */

export type FollowBackStatus = 'unknown' | 'following' | 'not_following';

export interface FollowBackState {
  /** Tri-state per actor id. Unresolved/errored actors are absent -> `unknown`. */
  getStatus: (actorId: string | null | undefined) => FollowBackStatus;
  isPending: (actorId: string | null | undefined) => boolean;
  followBack: (actorId: string) => void;
  /** Eligibility helper so the row doesn't re-derive the rule. */
  getActorId: (group: NotificationGroup) => string | null;
}

type ChunkResult = { ids: string[]; followingIds: string[] };

const fetchChunk = async (viewerId: string, ids: string[]): Promise<ChunkResult> => {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', viewerId)
    .in('following_id', ids);
  if (error) throw error;
  return {
    ids,
    followingIds: (data ?? []).map((row) => (row as { following_id: string }).following_id),
  };
};

export function useFollowBackState(
  groups: ReadonlyArray<NotificationGroup | null | undefined>,
): FollowBackState {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { requireAuth } = useAuthPrompt();
  const { canPerformAction, showVerificationRequired } = useEmailVerification();

  // Optimistic overrides survive across refetches until the server agrees.
  const [optimistic, setOptimistic] = useState<Record<string, FollowBackStatus>>({});
  const [pending, setPending] = useState<Record<string, true>>({});
  // Coalesces repeated presses without waiting for a state flush.
  const inFlight = useRef<Set<string>>(new Set());

  const actorIds = useMemo(
    () => collectFollowBackActorIds(groups, viewerId),
    [groups, viewerId],
  );

  const chunks = useMemo(
    () => (viewerId ? chunkFollowBackActorIds(actorIds) : []),
    [actorIds, viewerId],
  );

  const results = useQueries({
    queries: chunks.map((ids) => ({
      // viewerId in the key: follow state is per-account, never shared.
      queryKey: ['notification-follow-back', viewerId, ids.join(',')],
      queryFn: () => fetchChunk(viewerId as string, ids),
      enabled: !!viewerId && ids.length > 0,
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
    })),
  });

  const serverStatus = useMemo(() => {
    const map = new Map<string, FollowBackStatus>();
    results.forEach((result, index) => {
      const ids = chunks[index];
      if (!ids) return;
      // Pending OR errored -> leave every id unresolved. An errored chunk must
      // not read as "not following".
      if (result.isPending || result.isError) return;
      const data = result.data as ChunkResult | undefined;
      const following = new Set(data?.followingIds ?? []);
      for (const id of ids) map.set(id, following.has(id) ? 'following' : 'not_following');
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks, results.map((r) => `${r.status}:${r.dataUpdatedAt}`).join('|')]);

  const getStatus = useCallback(
    (actorId: string | null | undefined): FollowBackStatus => {
      if (!actorId || !viewerId) return 'unknown';
      return optimistic[actorId] ?? serverStatus.get(actorId) ?? 'unknown';
    },
    [optimistic, serverStatus, viewerId],
  );

  const isPending = useCallback(
    (actorId: string | null | undefined): boolean => !!actorId && !!pending[actorId],
    [pending],
  );

  const getActorId = useCallback(
    (group: NotificationGroup) => getFollowBackActorId(group, viewerId),
    [viewerId],
  );

  // Live mirror of the signed-in id, readable from inside an async closure.
  const supabaseViewerRef = useRef<string | null>(viewerId);
  supabaseViewerRef.current = viewerId;

  const followBack = useCallback(
    (actorId: string) => {
      if (!actorId) return;
      if (!requireAuth({ action: 'follow', surface: 'notification_drawer' })) return;
      if (!canPerformAction('canFollowUsers')) {
        showVerificationRequired('canFollowUsers');
        return;
      }

      const currentViewerId = viewerId;
      if (!currentViewerId || currentViewerId === actorId) return;
      if (inFlight.current.has(actorId)) return;

      inFlight.current.add(actorId);
      setPending((prev) => ({ ...prev, [actorId]: true }));
      setOptimistic((prev) => ({ ...prev, [actorId]: 'following' }));

      void (async () => {
        // Captured before the request; re-checked after so a sign-out or account
        // switch mid-flight neither toasts nor writes stale state.
        const isSameAccount = () => {
          const live = supabaseViewerRef.current;
          return live === currentViewerId;
        };

        try {
          const { data, error } = await supabase
            .from('follows')
            .upsert(
              { follower_id: currentViewerId, following_id: actorId },
              // DO NOTHING, not DO UPDATE: `follows` has no UPDATE policy, and a
              // duplicate follow must not mutate the existing row's timestamp.
              { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
            )
            .select('follower_id');
          // A residual race that still raises a unique violation is a success.
          if (error && !isUniqueViolation(error)) throw error;

          if (!isSameAccount()) return;

          // Zero returned rows == the follow already existed. State still
          // resolves to "following", but nothing changed, so we must not
          // announce it: count listeners treat every event as a +1.
          const inserted = !error && (data ?? []).length > 0;

          queryClient.setQueryData<string[]>(['user-following', currentViewerId], (prev) =>
            prev ? (prev.includes(actorId) ? prev : [...prev, actorId]) : prev,
          );
          void queryClient.invalidateQueries({
            queryKey: ['notification-follow-back', currentViewerId],
          });
          void queryClient.invalidateQueries({ queryKey: ['followers', actorId] });
          void queryClient.invalidateQueries({ queryKey: ['following', currentViewerId] });

          if (inserted) {
            // Non-react-query consumers (profile header/button, counts) listen.
            dispatchFollowStatusChanged({
              follower: currentViewerId,
              following: actorId,
              action: 'follow',
            });
            toast({ title: 'Following', description: 'You are now following this user.' });
          }
        } catch (error: any) {
          if (!isSameAccount()) return;
          setOptimistic((prev) => {
            const next = { ...prev };
            delete next[actorId];
            return next;
          });
          toast({
            title: 'Error',
            description: error?.message || 'Failed to follow this user',
            variant: 'destructive',
          });
        } finally {
          inFlight.current.delete(actorId);
          setPending((prev) => {
            const next = { ...prev };
            delete next[actorId];
            return next;
          });
        }
      })();
    },
    [
      canPerformAction,
      queryClient,
      requireAuth,
      showVerificationRequired,
      toast,
      viewerId,
    ],
  );

  // Drop optimistic overrides that belong to another account.
  const lastViewerRef = useRef<string | null>(viewerId);
  if (lastViewerRef.current !== viewerId) {
    lastViewerRef.current = viewerId;
    if (Object.keys(optimistic).length > 0) setOptimistic({});
    if (Object.keys(pending).length > 0) setPending({});
    inFlight.current = new Set();
  }

  // Live sync: a follow/unfollow performed elsewhere (profile header) flips the
  // matching drawer row immediately. Account-scoped: only the signed-in user's
  // own actions matter, and the override is keyed by the target actor id.
  useEffect(() => {
    if (!viewerId) return;
    const handler = (event: Event) => {
      const detail = parseFollowStatusChanged(event);
      if (!detail) return;
      if (detail.follower !== viewerId) return;
      if (detail.following === viewerId) return;
      setOptimistic((prev) => ({
        ...prev,
        [detail.following]: detail.action === 'follow' ? 'following' : 'not_following',
      }));
      void queryClient.invalidateQueries({
        queryKey: ['notification-follow-back', viewerId],
      });
    };
    window.addEventListener(FOLLOW_STATUS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(FOLLOW_STATUS_CHANGED_EVENT, handler);
  }, [viewerId, queryClient]);

  return { getStatus, isPending, followBack, getActorId };
}
