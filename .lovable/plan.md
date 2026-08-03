# Phase 2.3b verification + Phase 3 scope (3.0 and 3.3)

## Verification result: complete, no leftovers

Checked in this turn:
- 170 unit tests pass across 8 suites (including the 14 preference concurrency/account-safety cases).
- No `coming soon` / TODO placeholders left in `Settings.tsx`, the preferences hook, the service, or `ActivityNotificationsCard`.
- `generate-smart-notifications` honours `journey_notifications_enabled` with chunked lookups.
- Roadmap doc records the DB verification (all 8 producers guarded, `notification_allowed` internal-only).

Phase 2.3b is closed.

## Your scope call — agreed

**3.0 (date sections)** — yes. It's the cheapest readability win, it's what Instagram/X both do, and it's pure presentation over rows already loaded.

**3.3 (rich previews + Follow back)** — yes, and it's the item that actually changes behaviour: a thumbnail answers "which post?" without a navigation, and Follow back removes a two-hop trip to a profile.

**Skip 3.2 (`/notifications` page)** — agreed, and for a stronger reason than "Instagram doesn't". X needs a page because it's the primary desktop surface; your drawer already has independent lanes, cursor pagination and infinite scroll, so a page adds a second surface with zero new capability. Keep it as a future item.

**One thing I'd add to 3.3 — mute/skip nothing, but note this:** don't put a Follow-back button on grouped like rows or comment rows. It only belongs on `follow` rows, where the actor is unambiguous.

## Phase 3.0 — Date sections

Pure layer above the existing grouping, no schema change, no new fetches.

- `src/utils/notificationSections.ts` — takes the already-grouped array plus an injected `now`, returns `{ label, groups }[]` with labels Today / Yesterday / This week / This month / Earlier. No ambient `Date.now()` in the pure layer so tests are deterministic.
- Sticky section headers rendered inside the existing scroll region.
- Sections are **presentation only**: unread counts, the mismatch banner and pagination stay event-based over flat server rows, exactly like Phase 2.3 groups.
- Unparseable timestamps fall into `Earlier` — never dropped.
- Section headers must not disturb the pagination sentinel or the lane error/recovery strips.

## Phase 3.3 — Rich previews and contextual actions

### Thumbnails
`notifications.image_url` already exists and is populated on 52 of 113 active rows, so it's an unreliable single source. Design accordingly:

- Render `image_url` when present (fast path, zero requests).
- For rows without one, resolve the target's media in **one batched lookup per rendered page**, keyed by `(entity_type, entity_id)`: `posts.media` (jsonb — first image frame, or a video's poster) and `recommendations.image_url`. Cached in React Query, deduped across groups sharing a target — so a 20-row page issues at most two queries, never one per row.
- Missing/failed media renders **nothing** — no grey box, no letter placeholder. A thumbnail is a bonus, never a layout requirement.
- Thumbnail goes on the right of the row (matching both references), fixed square, `rounded-md`, `loading="lazy"`, decorative (`aria-hidden`) since the sentence already names the target.
- Only for like / comment / reply / mention / comment-like rows. `follow` and `system` rows have no target media.

### Follow back
- Only on singleton `follow` rows.
- Follow state comes from the existing batched `useUserFollowing()` set — **not** `useFollow(id)` per row, which would fire one query per notification.
- Three states: `Follow back` (not following) → optimistic `Following` → nothing rendered when the actor is you.
- Reuses the existing follow social-button variant, `requireAuth()` first, and the email-verification gate — same contract as the profile header. Clicking it must **not** trigger row navigation (`stopPropagation`), and must not mark the row read; those are separate intents.

### Invariants preserved
No change to counts, cursors, retraction, realtime merging or read semantics. Both phases are additive and reversible.

## Deferred, with the trigger that would un-defer each

| Item | Ship when |
| --- | --- |
| 3.1 per-actor / per-thread mute | users ask to silence a specific actor or thread (2.3b covers per-category) |
| 3.2 `/notifications` page | history depth or deep-link sharing becomes a real request |
| 3.4 type filters / mentions view | typical unread counts exceed ~50 |
| 3.5 per-row mark unread / dismiss | needs its own plan — replaces the monotonic `is_read` merge with row versioning |
| 3.6 web push | after retention justifies re-engagement |
| 3.7 virtualization | profiling shows list scroll jank |

## Files this touches

- New: `src/utils/notificationSections.ts`, `src/utils/notificationSections.test.ts`, a batched target-media hook, a small `NotificationThumbnail` and `FollowBackButton`.
- Edited: `NotificationList.tsx` (sections + row slots), `vitest.config.ts` (new suite), `docs/NOTIFICATION_CENTER_ROADMAP.md`.
- No database migration, no edge function change.
