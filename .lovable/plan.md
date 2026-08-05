# Phase 3.3B — Follow back

## White poster: no change needed

Confirmed by you: the poster is a faithful frame of a video that genuinely opens on a white frame. The resolver behaved correctly, so nothing to fix. Phase 3.3A stays as-is.

## Phase 3.3A verification (closed)

- `src/utils/notificationThumbnail.ts` — pure resolver, no Supabase/React imports, never returns a raw video URL, Mux goes through `image.mux.com`.
- `src/utils/notificationThumbnail.test.ts` — registered in `vitest.config.ts`; whole suite green.
- `src/hooks/notifications/useNotificationTargets.ts` — bounded chunked batches, `user.id` in the cache key, settled-chunk tracking so a slot never stays reserved.
- `src/components/notifications/NotificationList.tsx` — decorative `aria-hidden` thumbnail, lazy/async, `onError` collapses the slot, read state moved beside the timestamp.
- Roadmap marks 3.3A done and records the two 3.3B prerequisites.

No leftovers, no dead code, no stale flags.

## What 3.3B adds

A "Follow back" action on follow notifications, so the user can reciprocate without leaving the drawer.

Rules:
- Only on **single** follow rows (`entity_type = 'profile'`). Aggregated follow groups get no button.
- Never for yourself, never for an actor whose profile can't be resolved (deleted account).
- Tri-state: while follow state is unknown, no button is rendered (no flicker, no wrong label). Once known: "Follow back" if not following, and a plain non-interactive "Following" label if already following.
- Optimistic on click, reverts with a toast on failure, and disabled while in flight.

## Two prerequisites, handled first

**1. Row structure.** The row today is one big `<button>`; a button inside a button is invalid HTML and `stopPropagation` does not repair it. `NotificationRow` becomes a non-interactive container holding an absolutely-positioned overlay navigation button (the whole row surface) plus the action control as a sibling above it in stacking order. Visual appearance, hover, focus ring, unread tint and the existing thumbnail stay unchanged.

**2. A single follow authority.** There is no cache-aware follow mutation today, and `useUserFollowing` swallows errors into `[]` — meaning "no error" and "not following" are indistinguishable, which is exactly what breaks a tri-state. A new hook `src/hooks/notifications/useFollowBackState.ts` owns this for the drawer:
- one batched query of `follows` for the actor ids currently loaded (chunked, account-scoped cache key, same pattern as `useNotificationTargets`),
- a real error state instead of an empty-array fallback,
- one mutation that inserts the follow row and updates both its own cache and the existing `['user-following', userId]` cache so the rest of the app agrees immediately.

`useUserFollowing` is left untouched — no behaviour change elsewhere in this phase.

## Pure layer + tests

`src/utils/notificationFollowBack.ts`:
- `getFollowBackActorId(group, viewerId)` — returns the actor id when a group qualifies, otherwise `null` (covers aggregated groups, non-follow types, self-follow, missing actor).
- `collectFollowBackActorIds(groups, viewerId)` — distinct, sorted ids for stable cache keys.

`src/utils/notificationFollowBack.test.ts` covers all of it, registered in `vitest.config.ts`.

## Files

- New: `src/utils/notificationFollowBack.ts`, `src/utils/notificationFollowBack.test.ts`, `src/hooks/notifications/useFollowBackState.ts`.
- Edited: `src/components/notifications/NotificationList.tsx` (row restructure + action slot), `vitest.config.ts`, `docs/NOTIFICATION_CENTER_ROADMAP.md`.
- No database migration: `follows` already carries the needed RLS for a self-authored insert.

## Manual check after implementation

1. A follow notification from someone you don't follow shows "Follow back"; clicking it flips to "Following" and the button no longer offers the action.
2. Reopen the drawer and visit that profile — the follow state agrees in both places.
3. Clicking anywhere else on the row still navigates to the profile; clicking the button does not navigate.
4. Grouped follow rows and non-follow rows show no button.
5. Keyboard: Tab reaches the row and the button separately, both with a visible focus ring.
