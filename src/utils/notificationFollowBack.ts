/**
 * Phase 3.3B — pure eligibility logic for the "Follow back" action.
 *
 * PURE by design: no React, no Supabase, no toasts. It answers exactly one
 * question — "which actor, if any, may this row offer a Follow back for?" — so
 * the rule is testable without rendering the drawer.
 *
 * Rules (deliberately narrow):
 *  - single follow rows only. An aggregated group shares one action slot but has
 *    several actors, so there is no unambiguous target.
 *  - the actor must be a real uuid sender that is NOT the viewer (no self-follow).
 *  - anything else (likes, comments, mentions, system rows) is never eligible.
 */

import type { NotificationGroup } from '@/utils/notificationGrouping';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value.trim());

/** Follow rows are typed `follow`; `entity_type` is `profile` when present. */
const isFollowRowType = (group: NotificationGroup): boolean => {
  const n = group.representative;
  if (n?.type !== 'follow') return false;
  const entityType = n.entity_type;
  return !entityType || entityType === 'profile';
};

/**
 * The actor a Follow back button would target, or `null` when the row must not
 * render one.
 */
export const getFollowBackActorId = (
  group: NotificationGroup | null | undefined,
  viewerId: string | null | undefined,
): string | null => {
  if (!group || !group.representative) return null;
  if (group.isAggregated || group.notifications.length > 1) return null;
  if (!isFollowRowType(group)) return null;

  const actorId = group.representative.sender_id;
  if (!isUuid(actorId)) return null;

  const actor = actorId.trim();
  // Signed out: no viewer, so no action (the row still navigates).
  if (!isUuid(viewerId)) return null;
  if (actor === (viewerId as string).trim()) return null;

  return actor;
};

/**
 * Distinct actor ids across the loaded rows, sorted so the same loaded set
 * always produces the same react-query cache key.
 */
export const collectFollowBackActorIds = (
  groups: ReadonlyArray<NotificationGroup | null | undefined>,
  viewerId: string | null | undefined,
): string[] => {
  const ids = new Set<string>();
  for (const group of groups) {
    const actorId = getFollowBackActorId(group, viewerId);
    if (actorId) ids.add(actorId);
  }
  return Array.from(ids).sort();
};

export const FOLLOW_BACK_CHUNK_SIZE = 200;

/** Bounded batches — never one request per row. */
export const chunkFollowBackActorIds = (
  ids: ReadonlyArray<string>,
  size: number = FOLLOW_BACK_CHUNK_SIZE,
): string[][] => {
  const step = Math.max(1, Math.floor(size));
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += step) out.push(ids.slice(i, i + step));
  return out;
};
