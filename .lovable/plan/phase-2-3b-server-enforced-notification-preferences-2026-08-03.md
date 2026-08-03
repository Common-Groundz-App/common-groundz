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

### Comment edits must preserve precedence (Codex correction 1 — accepted)

Codex found a real hole: the skips only run on INSERT. If Hana comments without mentioning Rishab (he gets the generic comment notification) and *then* edits the comment to add `@rishab`, `update_comment` inserts a mention notification and Rishab holds two rows for one source comment — breaking the stated invariant.

Since Phase 2.5 already gave us a retraction lifecycle, the clean fix is precedence *replacement* rather than suppression. In `update_comment`, for each recipient in the newly-added mention set:

1. resolve `mentions_enabled` for that recipient, and insert the mention notification;
2. **only after** confirming the mention row is active (newly inserted, or already present from an earlier edit) retract that recipient's lower-precedence generic comment row for the **same source comment** — `retracted_at = now()` where `retracted_at IS NULL`. Sibling projections (comment likes, etc.) are untouched.

The ordering matters: never retract first. If the insert is skipped or fails, the user keeps the notification they already had.

Only *downward* transitions are handled, i.e. generic comment → mention. The reverse (a mention removed by an edit) already retracts the mention row per Phase 2.5A and deliberately does **not** resurrect a generic comment notification: resurrecting a notification the user may have already read is worse than losing it, and re-notifying for an old comment is misleading. That asymmetry is stated in the roadmap so it isn't mistaken for an oversight later.

If `mentions_enabled` is false for that recipient, no mention row is inserted and the existing generic comment row is left alone — a disabled category must never *remove* a notification the user legitimately received.

### Dependency guard

The trigger skips call `public.parse_comment_mentions` from Phase 2.5A. Migration B asserts it exists before replacing any function body and aborts with a clear message if not, so environment drift fails loudly instead of installing triggers that error on every comment.

## Server-side enforcement

One authoritative helper so trigger and RPC behavior cannot drift:

```sql
public.notification_allowed(_user_id uuid, _category text) returns boolean
  language plpgsql stable security definer set search_path = public
```

**Correction accepted — PL/pgSQL, not SQL.** Codex is right: `RAISE WARNING` is a PL/pgSQL statement and is invalid in a `LANGUAGE sql` body. Since a producer-side category typo would otherwise silently mute a whole category with no trace, the warning is worth the language change. The body is a `CASE _category WHEN ... ` over the explicit column list, reading the single preference row (`SELECT ... INTO`), applying the documented default when no row exists, and `ELSE RAISE WARNING 'notification_allowed: unknown category %', _category; RETURN false;`. Still `STABLE`, still one unique-index lookup per notification — no N+1, no new realtime or polling work, no change to grouping, retraction, or the drawer.

**Fail closed, and internal only** (both reviewers flagged this):
- an unrecognised `_category` returns `false` **and warns** — a typo like `'comment_like'` must never silently allow *or* silently mute a notification. Returning `false` rather than raising an exception keeps the user's like/comment transaction alive. Tests assert both the exact valid category set and the `'comment_like'` vs `'comment_likes'` pair.
- `REVOKE EXECUTE ... FROM public, anon, authenticated;` and `GRANT EXECUTE ... TO service_role;`. `SECURITY DEFINER` producers invoke it through the function owner, so the browser never needs it — otherwise any signed-in user could probe another user's settings.

Each producer gains the guard in the position that already filters self-notifications:
- triggers: `IF ... AND public.notification_allowed(recipient, 'likes') THEN insert`
- RPC inserts (which are `INSERT ... SELECT ... WHERE NOT EXISTS`): add `AND public.notification_allowed(recipient, '<category>')` to the existing `WHERE`.
- `generate-smart-notifications`: **two bounded bulk queries, not an embedded join.** Codex is right that PostgREST can't embed `notification_preferences` from `user_stuff` — there's no FK between them, only a shared `user_id`. So: fetch watched items → collect distinct user ids → look up `user_id, journey_notifications_enabled` for those ids → build a disabled-user set → filter watched items *before* the expensive per-item loop. Missing row = enabled. No view or RPC needed. This fixes a real bug: the function currently ignores the toggle Settings already exposes. `send-weekly-digest` stays unchanged (missing row = `false` there, by design).
  - **Genuinely bounded (accepted):** a single `.in('user_id', ids)` grows with the watcher base and will eventually exceed URL/row limits, so the distinct ids are **chunked** (200 per request) and the sets merged.
  - **All-or-nothing contract:** if *any* chunk errors, the run aborts with a non-zero/failed result and creates **no** notifications. Delivering to users whose opt-out status is unknown is worse than skipping a run — a cron job retries, an unwanted notification can't be taken back.

Every replaced SQL function body is patched from its **current live `pg_get_functiondef()`** output, not from migration history, preserving auth guards, return contracts, counters, Phase 2.5/2.5A retraction and comment-lifecycle logic, and targeted `ON CONFLICT` inference. `SECURITY DEFINER` and pinned `search_path` are re-declared on each. `CREATE OR REPLACE FUNCTION` resets nothing about grants in Postgres, but because these are security-sensitive we still **re-assert and then re-verify** the intended grant/revoke set on every touched function after the migration, via `pg_proc.proacl` inspection.

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
- `setPreference(key, value)` applies an optimistic update to the **effective** object.
- the two legacy toggles are re-expressed through `setPreference` so there is one write path.

### Overlapping toggles must not corrupt state (Codex correction 2 — accepted)

Codex is right that "adopt the returned row as authoritative" is unsafe once two switches are toggled quickly: an older in-flight response can clobber a newer local value, and a failed request restoring a whole snapshot can undo an unrelated successful toggle. Concretely: disable Likes, disable Mentions before Likes settles, Mentions resolves first, then the stale Likes row re-enables Mentions in the UI.

The write path becomes per-key and merge-based:

- one monotonically increasing sequence per key; a response is applied only if it is the latest for **that key**, older responses are discarded.
- success **merges only that key** (plus server-owned `id`/`updated_at`) from the returned row — it never adopts the whole row over locally-pending keys.
- failure reverts **only that key** to its pre-request value, never a full snapshot, and shows the destructive toast.
- per-key pending set, so each switch shows its own in-flight state while others stay usable — no global lock needed, because ordering is now correct by construction.
- a background refetch is likewise ignored for any key with a write in flight.

### Account switching must not leak preferences across users (accepted)

Codex is right, and confirmed by reading the file: `use-notification-preferences.ts` is a plain `useState` hook whose effect merely reruns when `user` changes. Nothing prevents the previous account's values from staying on screen, or an in-flight fetch/mutation from committing into the next account's UI. The main notification system already uses account-generation guards; preferences will follow the same rule.

- an `accountGeneration` counter (or a captured `user.id` per request, compared on resolve) increments on every `user?.id` change **and on sign-out**.
- on switch, state resets immediately — preferences cleared to the missing-row defaults and the card shows skeletons — rather than showing the prior user's toggles while the new fetch runs.
- every fetch and mutation captures the generation *and* the target `user.id` before it starts; on resolve, a mismatch discards the result silently (no toast, no state write). This also covers sign-out mid-flight.
- `notificationPreferencesService` stops resolving the current auth user *inside* the write. The caller passes the captured `userId`, so a queued mutation can never land on a different account's row. (Server-side, RLS on `notification_preferences` already scopes writes to `auth.uid()`, so a mistargeted write would fail rather than corrupt — this guard prevents the confusing UI state and misleading toast.)
- the per-key sequence counters and pending set are cleared on generation change, so no stale key ownership carries into the next account.



Extend the existing Notifications tab in `src/pages/Settings.tsx` with an "Activity notifications" card above the Journey section (replacing the "coming soon" placeholder), one `Switch` per category:

- **Likes** — "When someone likes your experience or recommendation"
- **Comments** — "When someone comments on your experience or recommendation"
- **Replies** — "When someone replies to your comment"
- **Mentions** — "When someone mentions you in a comment"
- **Comment likes** — "When someone likes your comment"
- **New followers** — "When someone follows you"

Behavior: skeletons while loading (per the project's skeleton standard); optimistic toggle with per-key rollback and a destructive toast on failure; account switch resets state and refetches under the generation guard above; each switch labelled via `id`/`htmlFor` with its description wired through `aria-describedby`.

## Migration and rollout

Ordered, expand-first:

1. Migration A — add the six columns `NOT NULL DEFAULT true`; create `notification_allowed` (PL/pgSQL) with the revoke/grant above.
2. Migration B — assert `parse_comment_mentions` exists, then `CREATE OR REPLACE` the five trigger functions and three RPCs (patched from live definitions), including the comment-precedence skips and the edit-time insert-then-retract precedence replacement.
3. Deploy `generate-smart-notifications` with the two-query bulk `journey_notifications_enabled` filter applied before the per-item loop.
4. Regenerated Supabase types, then service/hook/UI.
5. Verification matrix, then roadmap update.

Post-migration assertions:

```sql
-- 1. no null preference values
select count(*) from public.notification_preferences
where likes_enabled is null or comments_enabled is null or replies_enabled is null
   or mentions_enabled is null or comment_likes_enabled is null or follows_enabled is null;
-- expect 0

-- 2. helper is not reachable by app users
select has_function_privilege('authenticated', 'public.notification_allowed(uuid,text)', 'execute');
-- expect false
```

Existing RLS and grants on `notification_preferences` are re-verified, not changed. No new index needed (`user_id` is already unique). Rollback order matters: **restore the prior producer function bodies first, then drop the columns** — dropping columns while the new bodies are live would break every like and comment. Steps 1–2 are backward compatible with the shipped client.

## Tests

- Producer-by-category DB matrix: for each of the 8 in-database producers — enabled (row created), disabled (**zero** rows), missing preference row (default behavior), self-event (still suppressed).
- Precedence on insert: comment mentioning the content owner → exactly one notification (mention); reply to the owner's comment → exactly one (reply), no generic comment row; mention with `comments_enabled = false` → mention still delivered; reply with `comments_enabled = false` → reply still delivered.
- Precedence on edit: generic comment then edited to add `@owner` → mention row active, prior generic row retracted, total active rows for that comment = 1. With `mentions_enabled = false` → no mention row and the generic row stays active. Mention later removed → mention retracted, no generic row resurrected.
- Helper: unknown category returns `false` and warns; `authenticated` cannot execute it; missing row yields documented defaults (activity + journey true, digest false).
- `system` type inserts regardless of preferences.
- Client unit tests for `setPreference`: missing-row first write; out-of-order responses (stale success must not clobber a newer key); failure reverts only its own key; refetch ignored for in-flight keys.
- Client account-switch tests: a fetch resolving after a user change is discarded; a mutation resolving after switch or sign-out writes no state and shows no toast; state resets to defaults + loading on switch rather than showing the prior account's toggles; per-key sequences/pending are cleared.
- Edge function: chunking splits >200 ids into multiple lookups and merges results; a failing chunk aborts the run with zero notifications created.

## Manual verification

From a second account, with each category off in turn: like, comment, reply, mention, comment-like, follow, journey event. Confirm no drawer row, no badge change, no realtime event, and that pre-existing notifications and their read state are untouched. Re-enable and confirm new events arrive with no backfill. Then toggle three switches in rapid succession and reload — the UI must match the database exactly. Finally, open Settings on account A, toggle a switch, immediately sign out and into account B, and confirm B's card shows B's own values (no flash of A's toggles, no stray toast).


## Documentation

`docs/NOTIFICATION_CENTER_ROADMAP.md` updated with Phase 2.3b, affected files/functions/migration, and deferred items.

## Out of scope

Grouping, realtime, retraction changes, deleting/backfilling notifications, the full `/notifications` page, rich previews, push/email delivery, review/journey coverage expansion, quiet hours, per-actor muting.
