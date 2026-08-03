# Phase 3 — scoped to 3.0 and 3.3, split into three increments

## Verdict on the review

Both reviews are right, and I verified both technical objections against the live project rather than taking them on trust:

**1. `notifications.image_url` is the actor's avatar — confirmed.** Queried every active row grouped by type:

| type | active rows | image_url set | image_url equals the actor's avatar |
| --- | --- | --- | --- |
| like | 38 | 24 | 24 |
| comment | 62 | 20 | 20 |
| follow | 13 | 8 | 7 |

Every populated value except one legacy follow row is literally the sender's `profiles.avatar_url`. My earlier "render `image_url` as the fast path" was wrong — it would have painted the same avatar twice on most rows. Dropping that entirely: the column is never used as a target thumbnail.

**2. `useUserFollowing()` cannot back Follow back — confirmed.** It sets `initialData: []` and swallows query errors into `return []`, so "still loading" and "query failed" are both indistinguishable from "follows nobody". It also has no mutation and no optimistic cache write. Using it directly would flash `Follow back` at people you already follow. Needs its own state layer.

**3. Ship as three increments — agreed.** 3.0 is render-only, 3.3A is a read-only fetch, 3.3B introduces a mutation. Separate phases, separate verification passes.

## What I'd add on top of their notes

- **`image_url` is not just unused — it's a trap.** Once thumbnails ship, the next person will see a populated `image_url` and wire it in. So Phase 3.3A adds a comment on the field in `notificationService.ts` recording that it is actor-avatar data with mixed legacy semantics and is not content media. Cheaper than re-litigating this later.
- **A group's section is decided by one timestamp, chosen explicitly.** Grouped rows already carry many events. The section uses the group's newest event (the same timestamp the row displays), so the header and the visible "3 hours ago" can never disagree.
- **Tri-state follow state, not boolean.** `unknown | following | not_following`. `unknown` renders **no button at all** — never a wrong one. This is the single rule that makes 3.3B safe.
- **Follow back needs the account-generation guard we already built for preferences.** Same failure mode: switch accounts mid-flight and a resolved follow set leaks across users. Reuse the pattern.
- **From your `follow_avatar.png`:** that row is currently avatar + sentence + timestamp with dead space on the right — exactly where the button goes. Its vertical rhythm must not change when the button appears, so the row reserves the action slot rather than growing.

---

## Phase 3.0 — Date sections (render layer only)

- New `src/utils/notificationSections.ts`: takes the already-grouped array plus an injected `now`, returns `{ label, groups }[]` with **Today / Yesterday / This week / This month / Earlier**.
- Section chosen from each group's newest event timestamp. Order inside a section is untouched. Empty sections never render.
- Unparseable or future timestamps land in a defined bucket (`Earlier` / `Today` respectively) — a row is never dropped.
- Sticky headers inside the existing scroll region, `top` offset below the fixed All/Unread tabs so a header never slides under them. Rendered as real headings for screen-reader order.
- Applies identically to both lanes. **No change** to counts, cursors, the pagination sentinel, error/recovery strips, realtime merging, retraction or preferences.
- Tests: boundary cases at midnight, week and month edges; a group whose events straddle a boundary stays in one section; empty and single-section lists.

## Phase 3.3A — Target thumbnails (read-only)

- New batched hook: collect the distinct `(entity_type, entity_id)` targets of the rows currently rendered, resolve media in **at most two queries per page** — `posts.media` (jsonb; first image frame, or a video's poster; never a playing video) and `recommendations.image_url`. React Query cached and deduped across groups sharing a target.
- Rows eligible: like, comment, reply, mention, comment-like. Not follow, not system.
- Missing, deleted, RLS-hidden, or failed media renders **nothing** — no placeholder, no grey box, no row-height change. The slot is fixed-size and reserved, so a late-arriving image never reflows the list.
- `notifications.image_url` is not read. A comment on the field records why.
- Clicking the thumbnail does nothing special — the whole row still navigates to its canonical destination.

## Phase 3.3B — Follow back (mutation)

- New `useNotificationFollowState`: one batched `follows` lookup for the distinct actors of visible singleton `follow` rows, returning tri-state per actor and exposing a follow mutation.
- `unknown` (loading, error, or not yet fetched) renders no button. `following` renders `Following`, inert. `not_following` renders `Follow back`.
- Own-account actor: no button.
- Mutation goes through the existing shared follow write path so profile pages and the drawer cannot disagree; optimistic flip to `Following`, revert on failure with a toast.
- `requireAuth()` first, then the email-verification gate — same contract as the profile header.
- `stopPropagation` on click: does **not** navigate the row and does **not** mark it read. Reading stays tied to opening the row.
- Account-generation guard so a switch or sign-out discards in-flight resolutions.
- No DB, edge function, realtime, cursor or count changes.

## Deferred, with the trigger to revisit

| Item | Ship when |
| --- | --- |
| 3.1 per-actor / per-thread mute | users ask to silence a specific actor or thread |
| 3.2 `/notifications` page | history depth, deep links, or search/filter justify a second surface |
| 3.4 type filters / mentions view | typical unread counts exceed ~50 |
| 3.5 per-row mark unread / dismiss | needs row versioning to replace the monotonic `is_read` merge |
| 3.6 web push | after retention justifies re-engagement |
| 3.7 virtualization | profiling shows scroll jank |

## Order

Implement **3.0 alone** and stop for your manual pass. Then 3.3A. Then 3.3B. Nothing bundled.

## Files

- 3.0: new `src/utils/notificationSections.ts` + test; edit `NotificationList.tsx`, `vitest.config.ts`, roadmap doc.
- 3.3A: new batched target-media hook + `NotificationThumbnail`; edit `NotificationList.tsx`, comment in `notificationService.ts`.
- 3.3B: new `useNotificationFollowState` + test + `FollowBackButton`; edit `NotificationList.tsx`.
- No migration, no edge function change, in any of the three.
