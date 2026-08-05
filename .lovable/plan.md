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
- Tri-state: while follow state is unknown or errored, no button is rendered (no flicker, no wrong label). Once known: "Follow back" if not following, and a plain non-interactive "Following" label if already following.
- Optimistic on click, reverts with a toast on failure, disabled while in flight.
- Clicking the button never navigates and never marks the row read; clicking anywhere else on the row keeps today's navigation + read behaviour exactly.

## Prerequisite 1 — Row structure, done accessibly

The row today is one big `<button>`; a button inside a button is invalid HTML and `stopPropagation` does not repair it. `NotificationRow` becomes a non-interactive container holding a full-surface overlay navigation button plus the action control as a sibling above it in stacking order.

The overlay button is not an unlabelled hit area:
- it carries an explicit `aria-label` built from the row's own sentence, e.g. `Open notification: Hana Li started following you`;
- Tab reaches the row navigation and "Follow back" as two separate stops, each with a visible focus ring;
- Enter/Space on the row opens the destination; Enter/Space on the button follows and does not navigate.

Visual appearance, hover, unread tint and the 3.3A thumbnail stay unchanged.

## Prerequisite 2 — A single follow authority for the drawer

`useUserFollowing` collapses loading and error into `[]`, so "no error" and "not following" are indistinguishable — exactly what breaks a tri-state. New hook `src/hooks/notifications/useFollowBackState.ts`:

- **Batched read.** One chunked, account-scoped query of `follows` for the actor ids currently loaded (same pattern as `useNotificationTargets`), exposing a real `unknown` / `error` state instead of an empty-array fallback.
- **Gates, in this order.** `requireAuth()` first, then `canPerformAction('canFollowUsers')` with `showVerificationRequired(...)` — matching `use-follow.ts`. UX never depends on an RLS failure to explain itself.
- **Duplicate is success.** If the row already exists (another surface followed first, or a double click), the unique-violation resolves to `Following` with no error toast.
- **Account safety.** Viewer id + account generation + actor id are captured before the read and before the mutation; stale results are discarded, pending state clears, and no toast fires after a sign-out or account switch.
- **Cache + event fan-out.** On success: update the hook's own cache and `['user-following', userId]`, invalidate `['followers', actorId]` / `['following', viewerId]`, and dispatch the existing `follow-status-changed` window event with `action: 'follow'` — `use-viewed-profile.ts` and `profile/use-profile-follows.ts` listen for it, so profile counts cannot lag behind the drawer.

`useUserFollowing` and `use-follow.ts` themselves are left untouched — no behaviour change anywhere else in this phase.

## Two additions of my own

- **No unfollow from the drawer.** The button follows only; it never becomes a toggle. An accidental unfollow from a notification list is a bad trade, and Instagram behaves the same way.
- **One in-flight follow per actor.** Repeated presses coalesce instead of firing parallel inserts, which is what makes the duplicate path rare rather than routine.

## Pure layer + tests

`src/utils/notificationFollowBack.ts`:
- `getFollowBackActorId(group, viewerId)` — actor id when a group qualifies, otherwise `null` (aggregated groups, non-follow types, self-follow, missing actor).
- `collectFollowBackActorIds(groups, viewerId)` — distinct, sorted ids for stable cache keys.

`src/utils/notificationFollowBack.test.ts` covers all of it, registered in `vitest.config.ts`.

## Files

- New: `src/utils/notificationFollowBack.ts`, `src/utils/notificationFollowBack.test.ts`, `src/hooks/notifications/useFollowBackState.ts`.
- Edited: `src/components/notifications/NotificationList.tsx` (row restructure + action slot), `vitest.config.ts`, `docs/NOTIFICATION_CENTER_ROADMAP.md`.
- No database migration: `follows` already allows a self-authored insert under existing RLS.

## Manual checks

1. Follow notification from someone you don't follow shows "Follow back"; clicking it flips to "Following" and the action is gone.
2. Open that profile — it agrees, including follower/following counts, without a manual refresh.
3. An actor you already follow shows "Following" or nothing, never "Follow back".
4. Grouped follow rows and non-follow rows show no button.
5. Clicking the row still navigates and marks read; clicking the button does neither.
6. Keyboard: two separate Tab stops, visible focus rings, Enter/Space does the right thing on each.
7. Unverified email → verification toast, no optimistic flip.
8. Sign out or switch accounts mid-request → no stale toast, no leaked state.
