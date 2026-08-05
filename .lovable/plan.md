# Follow state: consistent look + live sync across surfaces

Three fixes, all scoped to the notification drawer's follow control and the follow hook.

## 1. "Following" pill matches the profile card

The drawer's "Following" state currently uses a flat grey-text pill. Restyle it to the exact treatment used on the profile card (`FollowButton`): soft brand-orange tint with brand-orange text, same rounded shape — just without the icon and at the drawer's compact height.

- Background `bg-brand-orange/10`, text `text-brand-orange`, `text-xs font-medium`, height 7, `px-2.5`.
- Still non-interactive (no unfollow path in the drawer), so it stays a `span` with the same footprint as "Follow back" — the row never shifts when the state flips.

## 2. Live sync of follow state between the drawer and the profile page

Today the profile page reads follow state once on mount, so following someone from the notification drawer while their profile is open shows nothing until a full reload.

- Make the profile follow hook listen for the existing `follow-status-changed` window event and update its own following state when the event's follower is the signed-in user and the target matches the profile being viewed.
- Make the drawer's follow-back state listen for the same event, so an unfollow performed on the profile page immediately flips the drawer row back to "Follow back" (and a follow elsewhere flips it to "Following") without waiting for a refetch.
- Keep both listeners account-scoped: ignore events whose follower is not the current viewer.

## 3. Fix the duplicate-key error (`follows_follower_id_following_id_key`)

The profile page's follow action does a plain insert. When the same follow already exists — e.g. you followed from the drawer, then pressed Follow on the profile before its stale state caught up — Postgres raises a unique-violation and it surfaces as a red error toast.

- Change the profile follow insert to an idempotent upsert on `(follower_id, following_id)` with duplicates ignored (the same approach the drawer already uses; `follows` has no UPDATE policy, so it must be do-nothing).
- Additionally treat a unique-violation error code as success, so any remaining race resolves to "Following" rather than an error toast.
- Unfollow stays a plain delete (already idempotent).

## Technical notes

- Files: `src/components/notifications/NotificationList.tsx` (pill styling), `src/hooks/use-follow.ts` (idempotent write + event listener), `src/hooks/notifications/useFollowBackState.ts` (event listener).
- No database migration; no changes to follower-count logic, which already reacts to `follow-status-changed`.
- Verification: typecheck plus the existing notification test suite.
