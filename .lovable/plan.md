## Verdict

Implement now. All three corrections are accepted — no further planning round.

- **Comment error contract (Codex #1) — confirmed real.** `fetchComments()` in `src/services/commentsService.ts` catches everything and returns `[]`. Without fixing that, "That comment is no longer available" would fire on any network/RPC/RLS failure. This is now a prerequisite, not a nice-to-have.
- **Pure, root-relative parsing (both) — accepted.** No `window` inside the resolver, and the raw value must begin with exactly one `/` so `../post/<id>` can't climb into an allowlisted pathname.
- **UUID/username validation on allowlisted routes (ChatGPT #2) — accepted.**

## Phase 2.2B — Destination resolver

### Migration (minimal patch against live definitions)

Three `CREATE OR REPLACE FUNCTION` statements reproducing the live `pg_get_functiondef()` bodies verbatim except the noted delta. Preserved exactly: `SECURITY DEFINER`, `SET search_path`, the `auth.uid() != p_user_id` guard, self-notification skips, mention dedup + 5-mention cap, `comment_mentions` inserts, 1-level threading validation, `comment_count` updates, `NOT EXISTS` dedup subqueries, all titles/messages/recipients, `RETURN NEW` / `RETURN true`. No grants, triggers, or schema touched.

- `create_post_comment_notification` — add `'comment_id', NEW.id::text` to the existing `jsonb_build_object`; `action_url` → `'/post/' || NEW.post_id || '?commentId=' || NEW.id`.
- `create_recommendation_comment_notification` — same; `action_url` → `'/recommendations/' || NEW.recommendation_id || '?commentId=' || NEW.id`.
- `add_comment` — one line, `'/recommendation/'` → `'/recommendations/'` (line 96 of the live body). Mention and reply notifications already carry `comment_id`; only the URL is wrong.

No backfill — the 25 existing plain-comment rows can't recover a comment id and will open the parent without a false highlight.

### `src/utils/notificationDestination.ts` (new, pure, no `window`)

```ts
const PARSE_ORIGIN = 'http://internal.invalid'; // fixed placeholder, never emitted

export type NotificationDestination =
  | { kind: 'viewer'; contentType: 'post' | 'recommendation'; id: string; commentId: string | null }
  | { kind: 'route'; path: string }
  | { kind: 'none'; reason: 'missing-target' | 'unsupported-type' | 'unsafe-url' };
```

`isUuid()` — RFC-shaped, version-agnostic (matches `generateUUID()` output). Applied to `entity_id`, `sender_id`, `metadata.comment_id`. A bad `comment_id` becomes `null`; a bad `entity_id` falls through to `action_url`.

**`normalizeInternalPath(raw)`:**
1. Reject unless `raw` starts with exactly one `/` (`raw[0] === '/' && raw[1] !== '/'`). Kills `//evil.com`, `https://`, `javascript:`, and relative climbs in one gate.
2. Reject on backslash or control char: `/[\x00-\x1f\x7f\\]/`.
3. Parse `new URL(raw, PARSE_ORIGIN)` in try/catch; reject on throw or if `url.origin !== PARSE_ORIGIN`. Fixed origin — no environment dependence, no jsdom/Node divergence, testable directly.
4. Normalize legacy `/recommendation/<id>` → `/recommendations/<id>` on `url.pathname` only, leaving `url.search` intact.
5. Allowlist `url.pathname` against real `App.tsx` routes, **with id validation**: `/post/:uuid`, `/recommendations/:uuid`, `/profile/:uuid`, `/u/:username` where username is `^[a-zA-Z0-9._-]{1,30}$`, and exact `/my-stuff`. No match → reject.
6. Rebuild search via `URLSearchParams`, keeping only `commentId` (UUID-valid) and `focus=comment`. Structural rebuild means the `?` vs `&` join can't be malformed and foreign params are dropped.

**Resolution order:**
1. `entity_type` post/recommendation + UUID `entity_id` → `viewer` + validated `commentId`.
2. `entity_type === 'profile'` or `type === 'follow'` → `/profile/<entity_id ?? sender_id>`, first UUID wins; neither → fall through.
3. `entity_type === 'journey'` / journey types → `/my-stuff`. Defensive; not currently emitted.
4. `entity_type === 'review'` → **no viewer**, falls to step 5. `ContentViewerModal` renders "Unsupported content type" for it.
5. `action_url` via `normalizeInternalPath` → `route`, else `none: 'unsafe-url'`.
6. Else `none: 'missing-target'` (or `'unsupported-type'` for recognized-but-unroutable, e.g. review).

`getContentUrl()` in `notificationService.ts`: singular → plural; drop the `/review/:id` arm.

### `NotificationDrawer`

Three branches: `viewer` → `openContent(...)`; `route` → `navigate(path)`; `none` → reason-specific toast. `markAsRead` fires first, unconditionally, including for `none`.

### Tests — `src/utils/notificationDestination.test.ts`

Fixtures are the eight shapes confirmed in the database: post like, recommendation like, legacy post comment (no id), legacy recommendation comment, mention, reply, comment-like, follow. Plus: missing/non-UUID `entity_id`; non-UUID `comment_id` → `null`; follow with only `sender_id`; `/recommendation/<uuid>?commentId=<uuid>` → plural, query preserved; `https://evil.com`; `//evil.com`; `javascript:alert(1)`; `../post/<uuid>`; `/post/<uuid>?next=https://evil.com` → param stripped; `/post/not-a-uuid` → rejected; `/u/bad name` → rejected; `/unknown/route` → rejected; `review`.

## Phase 2.2C — Unavailable targets

No probe service. Three states, never collapsed.

**Comment load contract (prerequisite).** `fetchComments()` gains a result shape instead of a bare array — `{ status: 'ok' | 'error'; comments: CommentData[] }` (or a sibling `fetchCommentsResult()` with the current signature retained as a thin wrapper, so existing callers are unaffected). Only `status === 'ok'` with no matching row may render "That comment is no longer available"; `status === 'error'` shows "Couldn't load comments" + Retry.

**Shared classifier.** One helper classifies a Supabase single-row outcome as `not-found` (zero rows, or `PGRST116`/not-found error — deletion and RLS-hidden are indistinguishable client-side and both map here) vs `transient` (network/transport). Used identically by both viewers.

- **`PostContentViewer` / `RecommendationContentViewer`** — split today's single `error || !recommendation` branch: `not-found` → "This content is no longer available", no retry; `transient` → "Couldn't load" + Retry. `RecommendationContentViewer.handleRefresh` currently sets `loading`/clears `error` without re-fetching — it will actually re-run the fetch. Styling follows `PublicContentNotFound`.
- **Comment level** — `InlineCommentThread` renders the missing-comment line only under the ok-status condition above. Existing auto-expand / scroll-to-`comment-<id>` / highlight behaviour untouched.
- **Profile** — `/profile/:id` for a missing or deleted user shows an unavailable state, not a blank shell.
- Read state applies regardless of target outcome.

## Cleanup

- Remove the orphaned JSDoc block trailing `NotificationListProps`.
- Create `docs/NOTIFICATION_CENTER_ROADMAP.md` (`docs/` does not yet exist), Phases 1 → 2.2A marked complete.

## Post-implementation audit

A concrete diff/runtime audit, not another planning cycle. One row per emitted shape: resolved destination, missing-id behaviour, deleted-target behaviour, comment-context behaviour, and any unsatisfied case (currently only `review`, which is never emitted).

## Out of scope

Aggregation, realtime, filters, per-row actions, a `/notifications` page, rich previews, preferences, date grouping, virtualization, web push.

## Technical notes

- One migration; three function replacements; no schema/RLS/grant/trigger changes.
- Files: migration (via tool), `src/utils/notificationDestination.ts` + `.test.ts` (new), `src/services/notificationService.ts`, `src/services/commentsService.ts`, `src/components/notifications/NotificationDrawer.tsx`, `NotificationList.tsx`, `src/components/content/PostContentViewer.tsx`, `RecommendationContentViewer.tsx`, `src/components/comments/InlineCommentThread.tsx`, `docs/NOTIFICATION_CENTER_ROADMAP.md` (new).
- Phase 2.1 / 2.2A invariants — lane ownership, cursors, sticky reads, mutation gates, recovery — untouched. This phase changes only what happens after a click.
