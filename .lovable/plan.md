# Follow state: consistent look + live sync across surfaces

Three fixes, all scoped to the notification drawer's follow control and the follow hook.

## 1. "Following" pill matches the profile card

The drawer's "Following" state currently uses a flat grey-text pill. Restyle it to the exact treatment used on the profile card (`FollowButton`): soft brand-orange tint with brand-orange text, same rounded shape — just without the icon and at the drawer's compact height.

- Background `bg-brand-orange/10`, text `text-brand-orange`, `text-xs font-medium`, height 7, `px-2.5`.
- Still non-interactive (no unfollow path in the drawer), so it stays a `span` with the same footprint as "Follow back" — the row never shifts when the state flips.

## 2. Live sync of follow state between the drawer and the profile page

Today the profile page reads follow state once on mount, so following someone from the notification drawer while their profile is open shows nothing until a full reload.

- Make the profile follow hook listen for the existing `follow-status-changed` window event and set its own state immediately (not just refetch) when the event applies.
- Make the drawer's follow-back state listen for the same event, so a follow/unfollow performed on the profile page immediately flips the drawer row between "Follow back" and "Following".
- Event payload stays `{ follower, following, action }` and both listeners are strictly scoped: react only when `follower === signed-in user id` **and** `following` matches the profile being viewed / the drawer row's actor. Everything else is ignored, so nothing leaks across accounts or unrelated profiles.

## 3. Fix the duplicate-key error (`follows_follower_id_following_id_key`)

The profile page's follow action does a plain insert. When the same follow already exists — e.g. you followed from the drawer, then pressed Follow on the profile before its stale state caught up — Postgres raises a unique-violation and it surfaces as a red error toast.

- Change the profile follow insert to an idempotent upsert on `(follower_id, following_id)` with duplicates ignored (the same approach the drawer already uses; `follows` has no UPDATE policy, so it must be do-nothing).
- Additionally treat a unique-violation error code as success, so any remaining race resolves to "Following" rather than an error toast.
- Unfollow stays a plain delete (already idempotent).

## 4. Only announce real transitions (Codex's catch — agreed)

This is the one substantive addition, and it matters: `use-profile-follows.ts` increments the follower count whenever it sees `action: 'follow'`. If a duplicate/no-op follow still dispatched the event, the count would be incremented twice for a single real follow.

- Both writers (profile hook and drawer hook) ask the insert to return the affected row (`.select('follower_id')` on the insert-ignore). With `ignoreDuplicates`, a duplicate returns **zero rows** — that's the no-op signal.
- Dispatch `follow-status-changed` and show the "Following" toast **only** when a row was actually inserted. On a no-op the UI still resolves to "Following" silently, with no event, no toast, no count change.
- Unfollow dispatches only when the delete actually removed a row, for the same reason (a no-op unfollow must not decrement).

## Two additions of my own

- **Cache parity on the profile side.** The profile follow path currently touches no react-query cache, so `['user-following', userId]` can stay stale after a profile-side follow/unfollow. Both writers will update/invalidate the same follow caches, so drawer, profile button and counts always agree.
- **A single shared dispatch helper.** Instead of two hand-rolled `window.dispatchEvent` calls with slightly different shapes, both writers go through one small typed helper so the payload can't drift and the "only on real transition" rule lives in one place.

## Technical notes

- Files: `src/components/notifications/NotificationList.tsx` (pill styling), `src/hooks/use-follow.ts` (idempotent write, transition-only dispatch, event listener, cache touch), `src/hooks/notifications/useFollowBackState.ts` (transition-only dispatch + event listener), plus a small shared follow-event helper under `src/utils/`.
- No database migration. No notification/realtime changes, no drawer read/navigation changes, no unfollow path added to the drawer.
- Verification: typecheck plus the existing test suite (220 tests), with unit coverage for the event-scoping and transition-only rules.

## Manual checks

1. Click "Follow back" in the drawer while that profile page is open → profile button flips to Following immediately, counts move by exactly one.
2. Click Follow on the profile while the drawer is open → drawer row flips to "Following" immediately.
3. Unfollow from the profile while the drawer is open → drawer row returns to "Follow back".
4. Follow from the drawer, then quickly press Follow on the stale profile → no duplicate-key toast, no second follower count bump.
5. Drawer "Following" chip visually matches the profile card treatment, minus the icon; row height never shifts when state flips.
