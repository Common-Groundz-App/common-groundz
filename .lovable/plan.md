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

## Settings UI

Extend the existing Notifications tab in `src/pages/Settings.tsx` with a single "Activity notifications" card above the current Journey section. One `Switch` per category, reusing `use-notification-preferences.ts` (extended with a generic `setPreference(key, value)`); no second state owner.

Labels / descriptions:
- **Likes** — "When someone likes your experience or recommendation"
- **Comments** — "When someone comments on your experience or recommendation"
- **Replies** — "When someone replies to your comment"
- **Mentions** — "When someone mentions you in a comment"
- **Comment likes** — "When someone likes your comment"
- **New followers** — "When someone follows you"

Behavior: skeleton rows while loading; optimistic toggle with rollback and a destructive toast on failure; switches disabled during in-flight save; preferences refetch on account switch (hook already keys on `user`); each switch labelled via `id`/`htmlFor` with the description as `aria-describedby`.

## Migration and rollout

Single expand-only migration: `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT true` (six columns), then `CREATE OR REPLACE` for the helper and the five trigger functions and three RPCs (re-declared `SECURITY DEFINER` with pinned `search_path`, matching existing hardening). Adding columns with defaults is backward compatible — the old client keeps working before the UI ships. `GRANT EXECUTE` on the helper to `authenticated`, `service_role`. Existing RLS and grants on `notification_preferences` are re-verified, not changed. No new index needed (`user_id` is already unique). Rollback = drop columns and restore prior function bodies; Supabase types regenerate after the migration.

## Tests

- Producer-by-category DB matrix (via `supabase--read_query` against seeded fixtures): for each of the 8 in-DB producers — enabled, disabled (asserts **zero** rows inserted), missing preference row (default), self-event, and concurrent preference update.
- Precedence tests: mention-inside-a-reply, mention with `comments_enabled = false`.
- `system` type still inserts regardless of preferences.
- Client unit tests for the optimistic `setPreference` update and rollback path.

## Manual verification

Toggle each category off, trigger the event from a second account, confirm: nothing appears in the drawer, badge count unchanged, no realtime event, existing notifications untouched; then re-enable and confirm no backfill and that new events arrive.

## Documentation

`docs/NOTIFICATION_CENTER_ROADMAP.md` updated with Phase 2.3b, affected files/functions/migration, and deferred items.

## Out of scope

Grouping, realtime, retraction changes, deleting/backfilling notifications, the full `/notifications` page, rich previews, push/email delivery, review/journey coverage expansion, quiet hours, per-actor muting.
