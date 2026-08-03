# Phase 2.3b — Server-enforced notification preferences

Both reviews are right, and the audit confirms the core premise: **nothing in `notification_preferences` is enforced at the notification-producer level today.** This phase makes per-category preferences authoritative at the database boundary — a disabled category creates no row, no unread count, no realtime event, no retraction lifecycle.

## Current-state audit (verified)

**Table `public.notification_preferences`** — columns: `id`, `user_id`, `weekly_digest_enabled` (default `false`), `journey_notifications_enabled` (default `true`), `created_at`, `updated_at`. Rows are created lazily by upsert (many users have no row at all).

**Producers that insert into `public.notifications`:**

| Producer | Kind | Notification | Reads prefs today |
|---|---|---|---|
| `create_post_like_notification` | trigger on `post_likes` | post like | No |
| `create_recommendation_like_notification` | trigger on `recommendation_likes` | recommendation like | No |
| `create_post_comment_notification` | trigger on `post_comments` | top-level comment | No |
| `create_recommendation_comment_notification` | trigger on `recommendation_comments` | top-level comment | No |
| `create_follow_notification` | trigger on `follows` | new follower | No |
| `add_comment` | RPC | mention (`metadata.event='mention'`), reply (`event='reply'`) | No |
| `update_comment` | RPC | newly added mentions | No |
| `toggle_comment_like` | RPC | comment like | No |
| `generate-smart-notifications` | edge fn | `journey_watched` | **No — bug** |
| `send-weekly-digest` | edge fn | `journey_digest` | Yes (`weekly_digest_enabled`) |

So `journey_notifications_enabled` is **stored and shown in Settings but never enforced** — the smart-notifications function ignores it. That gets fixed here.

**Client surfaces:** `src/services/notificationPreferencesService.ts` (upsert-based), `src/hooks/use-notification-preferences.ts`, and one toggle in the Notifications tab of `src/pages/Settings.tsx` ("Other Notifications — coming soon" placeholder). No obsolete duplicate preference code found; the service/hook will be extended, not replaced.

## Categories and defaults

New boolean columns on `notification_preferences`, all `NOT NULL DEFAULT true` (preserves today's behavior):

| Column | Covers |
|---|---|
| `likes_enabled` | post likes, recommendation likes |
| `comment_likes_enabled` | likes on your comments |
| `comments_enabled` | top-level comments on your post/recommendation |
| `replies_enabled` | replies to your comment |
| `mentions_enabled` | `@you` in a comment (new or edited) |
| `follows_enabled` | new followers |

Existing `journey_notifications_enabled` (default true) and `weekly_digest_enabled` (default false) stay as-is.

**Not disableable:** `system` type — moderation, security, account, and admin messages. No control is exposed and no producer is gated for it.

## Comment precedence — a real bug this phase must fix first

Codex is right, and I verified it against the live definitions. `create_post_comment_notification` / `create_recommendation_comment_notification` fire on **every** `post_comments` / `recommendation_comments` insert and check only "don't notify yourself". They do **not** look at `parent_id` and do **not** look at mentions, and they run *before* `add_comment` inserts its mention/reply rows. So today a content owner who is replied to and mentioned can receive up to three notifications for one comment, and preference checks alone would let a disabled `mentions_enabled` leak through as a generic comment notification.

So the rule is **one category per recipient per source comment**, not per producer. The two comment triggers gain two skips before inserting:

1. `IF NEW.parent_id IS NOT NULL THEN RETURN NEW;` — replies are owned by `add_comment`'s reply notification (which also correctly targets the parent comment's author, not the content owner).
2. skip if the content owner appears in `public.parse_comment_mentions(NEW.content, NEW.user_id)` — mentions are owned by `add_comment`'s mention notification.

Only after those skips is `comments_enabled` consulted. This makes the documented precedence (mention > reply > generic comment) true in the database rather than aspirational, and is a strict de-duplication improvement independent of preferences.

## Server-side enforcement

One authoritative helper so trigger and RPC behavior cannot drift:

```sql
public.notification_allowed(_user_id uuid, _category text) returns boolean
  language sql stable security definer set search_path = public
```

It left-joins the single preference row and returns the column for `_category`, falling back to the documented default when the row is missing. One unique-index lookup per notification — no N+1, no new realtime or polling work, no change to grouping, retraction, or the drawer.

**Fail closed, and internal only** (both reviewers flagged this):
- an unrecognised `_category` returns `false` — a typo like `'comment_like'` must never silently allow a notification. (A `RAISE` would abort the user's like/comment transaction, so `false` is the safer failure mode; the category set is also asserted in tests.)
- `REVOKE EXECUTE ... FROM public, anon, authenticated;` and `GRANT EXECUTE ... TO service_role;`. `SECURITY DEFINER` producers invoke it through the function owner, so the browser never needs it — otherwise any signed-in user could probe another user's settings.

Each producer gains the guard in the position that already filters self-notifications:
- triggers: `IF ... AND public.notification_allowed(recipient, 'likes') THEN insert`
- RPC inserts (which are `INSERT ... SELECT ... WHERE NOT EXISTS`): add `AND public.notification_allowed(recipient, '<category>')` to the existing `WHERE`.
- `generate-smart-notifications`: filter watchers by `journey_notifications_enabled` (missing row = enabled) before insert, mirroring `send-weekly-digest`. This is a real fix — the function currently ignores the toggle Settings already exposes.

Every replaced SQL function body is patched from its **current live `pg_get_functiondef()`** output, not from migration history, preserving auth guards, return contracts, counters, retraction guards, and targeted `ON CONFLICT` inference. `SECURITY DEFINER` and pinned `search_path` are re-declared on each.

Self-notification suppression logic is untouched.


## Semantics

- Missing preference row = today's behavior via explicit column defaults.
- Disabling affects **future events only** — no retraction, no read-state change, no deletion of existing notifications.
- Re-enabling never backfills skipped events.
- Unread counts and the retraction lifecycle are unaffected, since skipped rows never exist.

## Settings UI and the missing-row hook bug

Codex's third point is correct and confirmed: `use-notification-preferences.ts` stores `null` when no row exists, and its toggles do `prev ? {...prev, x} : null` — so a user's *first* toggle succeeds on the server but leaves local state `null` until a refetch. The new generic setter must not inherit that.

Fixes in `use-notification-preferences.ts` / `notificationPreferencesService.ts` (extended, not replaced — single state owner):
- an `effectivePreferences` object is always available: the six activity categories `true`, `journey_notifications_enabled` `true`, `weekly_digest_enabled` `false` when the row is absent.
- `setPreference(key, value)` applies an optimistic update to the **effective** object, and on success adopts the row returned by the upsert as authoritative (so the first write materialises real state).
- rollback restores the previous **effective** object, never `null`.
- the two legacy toggles are re-expressed through `setPreference` so there is one write path.

Extend the existing Notifications tab in `src/pages/Settings.tsx` with an "Activity notifications" card above the Journey section (replacing the "coming soon" placeholder), one `Switch` per category:

- **Likes** — "When someone likes your experience or recommendation"
- **Comments** — "When someone comments on your experience or recommendation"
- **Replies** — "When someone replies to your comment"
- **Mentions** — "When someone mentions you in a comment"
- **Comment likes** — "When someone likes your comment"
- **New followers** — "When someone follows you"

Behavior: skeletons while loading (per the project's skeleton standard); optimistic toggle with rollback plus a destructive toast on failure; the individual switch disabled while its save is in flight; refetch on account switch (the hook already keys on `user`); each switch labelled via `id`/`htmlFor` with its description wired through `aria-describedby`.

## Migration and rollout

Ordered, expand-first:

1. Migration A — add the six columns `NOT NULL DEFAULT true`; create `notification_allowed` with the revoke/grant above.
2. Migration B — `CREATE OR REPLACE` the five trigger functions and three RPCs (patched from live definitions), including the two comment-precedence skips.
3. Deploy `generate-smart-notifications` with the `journey_notifications_enabled` filter.
4. Regenerated Supabase types, then service/hook/UI.
5. Verification matrix, then roadmap update.

Post-migration assertion (per ChatGPT's safeguard):

```sql
select count(*) from public.notification_preferences
where likes_enabled is null or comments_enabled is null or replies_enabled is null
   or mentions_enabled is null or comment_likes_enabled is null or follows_enabled is null;
-- expect 0
```

Existing RLS and grants on `notification_preferences` are re-verified, not changed. No new index needed (`user_id` is already unique). Rollback = drop the columns and restore the prior function bodies; steps 1–2 are backward compatible with the shipped client.

## Tests

- Producer-by-category DB matrix: for each of the 8 in-database producers — enabled (row created), disabled (**zero** rows), missing preference row (default behavior), self-event (still suppressed), concurrent preference update.
- Precedence: comment that mentions the content owner → exactly one notification (mention); reply to the owner's comment → exactly one (reply), no generic comment row; mention with `comments_enabled = false` → mention still delivered; reply with `comments_enabled = false` → reply still delivered.
- Helper: unknown category returns `false`; `authenticated` cannot execute it.
- `system` type inserts regardless of preferences.
- Client unit tests for `setPreference`: missing-row first write, optimistic update, rollback to the effective object (not `null`).

## Manual verification

From a second account, with each category off in turn: like, comment, reply, mention, comment-like, follow, journey event. Confirm no drawer row, no badge change, no realtime event, and that pre-existing notifications and their read state are untouched. Re-enable and confirm new events arrive with no backfill.


## Documentation

`docs/NOTIFICATION_CENTER_ROADMAP.md` updated with Phase 2.3b, affected files/functions/migration, and deferred items.

## Out of scope

Grouping, realtime, retraction changes, deleting/backfilling notifications, the full `/notifications` page, rich previews, push/email delivery, review/journey coverage expansion, quiet hours, per-actor muting.
