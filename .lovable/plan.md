## Phase 2.2A — Independent Unread pagination (FINAL — implement as written)

Both reviewers say implement. This is the frozen version, folding in Codex's last three safety corrections: comparator exceptions must never reach a React updater, mutation-discarded validations must queue a trailing retry, and comparator direction must be explicit in code rather than in prose notation. No further planning rounds.

---

### 1. Cursor ordering — precision-safe and exception-safe

`compareCursorKeys` becomes the single ordering authority in `notificationService.ts`, used for display sort, merge, head-window classification, and revalidation targeting.

**Normalized key, no `Date`.** `toCursorKey(created_at)` parses with the existing `TIMESTAMP_RE` (0–9 fractional digits, `Z` or offset), applies the UTC offset with integer arithmetic on the Y/M/D/h/m/s components, right-pads the fraction to 9 digits, and emits a fixed-width `YYYYMMDDhhmmssfffffffff` string. Fixed width + single timezone means lexicographic comparison is genuinely chronological across `.123Z` vs `.123000+00:00` vs `+05:30`. Keys are memoized per `id + raw string`.

Cursors sent to PostgREST still carry the **exact original string**, byte for byte. Normalization is local-comparison-only, never on the wire — microsecond precision on the boundary is preserved.

**Direction is explicit, never inferred (Codex #3).** No prose like "keys >= B". The service exports named helpers and everything reads through them:

```ts
compareCursorKeys(a, b)      // <0 when a is NEWER (sorts first in DESC order)
isNewerOrEqual(key, boundary) // compareCursorKeys(key, boundary) <= 0
isOlderThan(key, boundary)    // compareCursorKeys(key, boundary) > 0
```

Head-window membership is written as `isNewerOrEqual(rowKey, boundaryKey)`; revalidation targeting as `isOlderThan(...)`. Tests assert the sign convention directly so a future refactor can't silently invert it.

**Malformed input never throws inside React (Codex #1).** A comparator exception raised from a functional `setRows` or a render-time sort escapes the lane's async try/catch and takes down the drawer or the app error boundary. So:

- `toCursorKey` has two forms: `tryCursorKey(s): string | null` (never throws) and `cursorKeyOrThrow(s)` (service boundary only).
- **Validation happens at the fetch boundary, before state commit.** Every page/head/membership response runs each row through `tryCursorKey`. If any row fails, the *fetch* rejects with a normal lane error (`pageError: 'network'` / lane `fetchError`) and **no state is committed**. Bad server data surfaces as a recoverable lane error, exactly like a network failure.
- Because only validated rows ever enter state, `compareCursorKeys` in the merge/sort path operates on known-good input. As a belt-and-braces guard it is total anyway: a row with an unkeyable timestamp sorts last and never throws.

### 2. Service — `notificationService.ts`

- `fetchNotifications({ limit, cursor, unreadOnly })` — when `unreadOnly`, `.eq('is_read', false)` is applied **before** the keyset `.or()`. Cursor shape, over-fetch-by-one, `(created_at DESC, id DESC)` ordering, and `InvalidCursorError` all unchanged. Rows validated per §1 before return.
- **`fetchUnreadMembership(ids: string[], userId: string): Promise<Set<string>>`**
  - `userId` is an **explicit required parameter**, passed from the hook (which already holds it, tied to the same auth generation). The service never calls `getUser()`/`getSession()` — that would mean redundant auth work per chunk and would decouple the query from the hook's generation token. A dev invariant rejects empty/undefined rather than emitting a filter on `undefined`. RLS stays the authorization boundary; the explicit predicate is for index selection.
  - `ids.length === 0` ⇒ empty `Set`, **zero queries**.
  - Chunks of 200: `select('id').eq('user_id', userId).eq('is_read', false).in('id', chunk)`.
  - **All-or-nothing**: any chunk rejection rejects the whole call. Partial results are never returned — a failed chunk must never be misread as "none of these are unread".

### 3. Shared mechanics, injected reconciliation

New `src/hooks/notifications/useNotificationLane.ts` owns request plumbing only: rows + `rowsRef`, `serverCursorRef`, `hasMore`, `isLoadingMore`, `pageError`, `fetchError`, sequence + `pageOwnerRef`, `refreshHead`, `loadMore({ force })`, `recoverPagination`, `reset()`, and controlled writes `patchRowsById` / `replaceRows` / `dropRowsById`. **No raw `setRows` escapes the hook.**

Reconciliation is injected per lane:
- **All lane** — `mergeNotifications`: accumulated pages preserved, `is_read: true` monotonic.
- **Unread lane** — authoritative head window + membership revalidation (§5).

`useNotifications` retains global concerns: count lane, `markAsRead`, `markAllAsRead`, mutation gates, poll orchestration, `generationRef`, `userId`.

### 4. Canonical cross-lane read state

The same id can sit in both lanes with transiently different read state; a union that depends on iteration order can double-decrement or resurrect unread on rollback.

**Rule: read is monotonic across projections — if either lane says `is_read === true`, canonical local state is read.** One `canonicalRowsById()` helper builds that union and is the only thing consulted for mutation eligibility, rollback, and mark-all eligibility. Valid only while the app has no mark-as-unread action — commented beside this and `mergeNotifications` (revisit if 3.5 ships one).

### 5. Unread convergence beyond the head page

Every authoritative unread refresh, under one sequence token:

1. **Head-window reconciliation.** `boundaryKey` = cursor key of the oldest row in the refreshed head page. Loaded non-sticky rows where `isNewerOrEqual(rowKey, boundaryKey)` are inside the authoritative window: those absent from the page are removed. Older rows are untouched here. **Empty head page ⇒ no boundary exists**, so nothing is in-window and *every* accumulated non-sticky id goes to membership validation before retention.
2. **Membership revalidation.** For loaded non-sticky ids where `isOlderThan(rowKey, boundaryKey)` (or all of them in the empty-head case), call `fetchUnreadMembership(ids, userId)` and drop `ids − stillUnread`.

Converges externally-read rows on any page while preserving pagination depth and scroll position. Triggers: unread-tab activation/return, poll tick while the lane is active, post-mark-all reconcile, explicit Refresh. Skipped when nothing older than the boundary is loaded (the common one-page case).

**Atomic commit.** Chunk results accumulate in memory and commit once via a single `dropRowsById`, only if **all** hold at commit time: every chunk resolved, lane sequence token current, `generationRef` unchanged, no mutation holding the lane. Ids that turned sticky mid-flight are excluded from removal. Otherwise the entire validation is discarded — a stale row beats deleting a live one.

`serverCursorRef` is still set **only** from the last row of a successful server page. Dropping stale rows never moves the cursor.

### 6. Membership staleness — applicable failures only, with a trailing retry

`historyStale: boolean` on the unread lane, **separate from `pageError`** (this is not a Load-more failure and must not render pagination UI or block `loadMore`).

**Discarded ≠ failed (Codex #2 from the prior round).** An obsolete request performs *no* current state write, `historyStale` included; otherwise a superseded validation can raise a warning over data a newer refresh already verified.

- Set **only** when validation genuinely failed (network/server rejection) **and** still applicable at settle time: sequence token current, generation unchanged, lane not reset, no newer validation already committed, older rows still loaded.
- Discarded because superseded / user changed / lane reset / tab closed ⇒ no write at all.
- Cleared on the next successful commit, on `reset()`, and on mark-all reset.

**Mutation-discarded validations queue a trailing retry (Codex #2, this round).** If a validation is discarded specifically because a mutation owned the lane, silently waiting up to a full poll interval leaves older rows unverified with no indicator. Instead, set `pendingRevalidationRef = true` and, following the count lane's existing **release-before-reconcile** pattern, fire exactly one trailing revalidation immediately after the mutation gates release (coalesced — many discards produce one retry, and it is dropped if the lane reset or generation changed meanwhile). This reuses the pattern already proven for the count lane rather than inventing a second one.

**Own retry state.** `isRevalidating` + `revalidationOwnerRef`, distinct from `isLoadingMore` and head refresh. Refresh is disabled while owned and shows "Checking…", so rapid clicks can't launch duplicate head+membership operations.

UI: a quiet inline strip below the older rows on the Unread tab — "Some older items may already be read" + Refresh. Non-blocking, no layout jump.

### 7. Sticky reads — visual only, removed atomically

`stickyReadIdsRef: Set<string>` (cap 50). A row read while the Unread tab is open stays rendered dimmed so the list doesn't jump.

Excluded from: cursor, `loadedUnreadCount`, mismatch detection, mark-all eligibility, and membership id sets. **`loadedUnreadCount` = unread-lane rows with `is_read === false`** — never `rows.length`.

**Clearing a sticky id always removes its row in the same commit** (`dropRowsById(stickyIds)` + clear the set together), at every boundary: successful head refresh, `reset()`, tab switch away from Unread, drawer close, auth generation change. Sticky rows never survive a tab switch or drawer close; returning to Unread revalidates the head before retained rows are trusted.

### 8. Global, de-duplicated mutation ownership

Eligibility comes from one global `mutationOwnersRef: Map<id, opToken>` over `canonicalRowsById()` — never a concatenation of both lanes.

- `markAsRead(ids)`: filter to unowned + canonically unread, claim owners, compute the delta from the deduped set, `patchRowsById` both lanes. Rollback restores only op-owned ids in both lanes, then releases (and triggers any queued revalidation per §6).
- `markAllAsRead()`: RPC stays global. Optimistically patch both lanes read. **On success, reset the Unread lane outright** — rows, cursor, sticky ids, `hasMore`, `historyStale` — since success is authoritative that the unread dataset is empty. Applies whether the lane is active or retained-inactive, so reopening Unread can't flash stale rows. On failure, restore op-owned rows in both lanes.
- Updaters stay pure: derive from refs, then set (the 2.1 rule).

### 9. Gates and errors scoped correctly

- `isRecovering = allLane.isRecovering || unreadLane.isRecovering`; mutual exclusion (`markingAsRead` ⟷ `markAllPending` ⟷ `isRecovering`) stays app-wide. Request-ownership tokens and `recoverPagination` are per-lane.
- The global `fetchError` is replaced by per-lane error state. **The drawer renders only the active lane's error**: a background All failure must not blank a healthy Unread list, and vice versa. The bell badge keeps using the count lane's status, independent of both.

### 10. Polling scoped to actual use

The unread lane is active only while **the drawer is open and the Unread tab is selected**. Activation fetches; switching to All or closing the drawer deactivates while retaining rows/cursor for the session; returning revalidates (head + membership) before trusting them. One timer throughout — no permanent second list query.

### 11. UI

- Unread tab renders the unread lane's rows / `hasMore` / `isLoadingMore` / `pageError` / `historyStale` / `isRevalidating` / `loadMore` / `recoverPagination`.
- Delete `unloadedUnreadMessage` and the shared-pagination comment in `NotificationDrawer.tsx`.
- **Honest empty state**, exact strictness — "No unread notifications" only when: no unread rows, `hasMore === false`, `countStatus === 'ready'`, `unreadCount === 0`, `historyStale === false`, and no mutation/recovery/revalidation gate held. If the count is unknown or errored, show "No unread notifications loaded" instead of asserting certainty.
- `showCountMismatch` scoped to the Unread tab only (exhausted lane, count ready, not stale, nothing in flight); dropped from the All tab.
- Tab label keeps the authoritative global `unreadCount`.

### 12. Database — profile first

No index now. After the change I'll run `supabase--slow_queries`; if the unread keyset or membership query surfaces, add a **plain** `CREATE INDEX` (not `CONCURRENTLY` — the migration tool runs in a transaction):

```sql
CREATE INDEX idx_notifications_user_unread_created
  ON public.notifications (user_id, created_at DESC, id DESC)
  WHERE is_read = false;
```

No RLS, grant, or RPC changes; both queries ride the existing SELECT policy.

### 13. Verification

- Typecheck + lint clean; provider-only ESLint import guard passes.
- **Comparator unit tests** (isolated, exhaustive): `.123Z` vs `.123000+00:00` vs `.123000456+00:00`; `2026-07-29T15:30:00.123000+05:30` vs `2026-07-29T10:00:00.123000Z` (same instant); missing vs present fraction; microsecond ties falling through to the id tiebreak; explicit sign-convention assertions for `compareCursorKeys` / `isNewerOrEqual` / `isOlderThan`; `tryCursorKey` returns null on malformed input and never throws.
- **Malformed-timestamp safety**: inject a bad `created_at` into a mocked page response → the fetch rejects, the lane shows its error, **no state commits**, no exception escapes to the error boundary, drawer stays mounted.
- `fetchUnreadMembership([], uid)` performs **zero** queries; a rejected chunk rejects the whole call; empty `userId` is rejected rather than sent as `undefined`.
- Unread tab issues exactly one `is_read=eq.false` query on activation; Load more returns only unread rows.
- **External-read test**: load 3 unread pages, mark a page-2 row read directly in the DB, refresh → membership drops it; pages 1–3 and scroll position survive.
- **Empty-head test**: mark every head row read externally → head returns empty → all accumulated ids are membership-validated, not blindly preserved.
- **Atomicity**: force a second-chunk failure → no rows removed, `historyStale` strip shows, `pageError` stays null, Load more still works; next tick recovers.
- **Applicability**: start a validation, let a newer refresh succeed, then let the old one reject → **no** stale strip appears.
- **Queued revalidation**: discard a validation via an in-flight mutation → exactly one trailing revalidation fires right after the gates release (not one per discard), and none fires if the lane reset meanwhile.
- **Generation safety**: switch accounts mid-validation → results discarded, no rows removed from the new user's lane, no stale flag written.
- **Revalidation ownership**: five rapid Refresh clicks → one head+membership operation, button disabled with a visible "Checking…" state.
- **Canonical state**: force All=read / Unread=unread for one id → exactly one RPC send, count decrements once, rollback doesn't resurrect unread.
- Mark a row read on Unread → dimmed, count −1, All shows read without refetch, next refresh removes row + sticky id together.
- Switch away from Unread and back, and close/reopen the drawer → no dimmed rows survive either boundary.
- Mark-all from **All** with Unread retained-inactive → reopening Unread shows the empty state immediately, no stale flash.
- Force an All-lane failure while on Unread → Unread healthy, no error strip; and the inverse.
- Poll with drawer closed → one head query + one count, **no unread query**.
- Sign out → both lanes reset; no cursor, sticky id, or stale flag survives.

---

**Files** — new: `src/hooks/notifications/useNotificationLane.ts`, plus comparator tests. Edited: `useNotifications.ts`, `NotificationsContext.tsx`, `NotificationDrawer.tsx`, `NotificationList.tsx`, `notificationService.ts`. DB: none now.

**Out of scope**: destination resolver (2.2B), deleted-target handling (2.2C), aggregation, realtime, filters, per-row actions, `/notifications` route, rich previews, preferences, date sections, virtualization, web push.
