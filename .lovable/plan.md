# Phase 2.3b verification + what to do with Phase 3

## Verification result: complete, no leftovers

Checked in this turn:
- 170 unit tests pass across 8 suites (including the 14 new preference concurrency/account-safety cases).
- `notification_preferences` categories, the `notification_allowed` authority, all 8 in-database producers, comment precedence and the edit-time asymmetry are documented as verified in `docs/NOTIFICATION_CENTER_ROADMAP.md` and confirmed against the live functions last turn.
- No `coming soon` / TODO placeholders left in `Settings.tsx`, the preferences hook, service, or `ActivityNotificationsCard`.
- `generate-smart-notifications` honours `journey_notifications_enabled` with chunked lookups.

Nothing left to clean up. Phase 2.3b is closed.

## My view on Phase 3: do not build all of it

Phases 1 through 2.5A were **correctness** work — without them the drawer lies about state. Phase 3 is almost entirely **product polish**, and polish should be earned by usage, not shipped speculatively. Three of the items also carry real cost:

- **3.5 (per-row mark unread / dismiss / mute)** requires replacing the monotonic `is_read` merge with row versioning. That touches every invariant Phases 2.1–2.5 established. Very high risk, and almost nobody uses these controls.
- **3.6 (web push)** adds a permissions surface, service worker, token lifecycle and delivery retries. It only makes sense once you have users who leave the app and come back.
- **3.7 (virtualization)** is explicitly measurement-gated. With 20-row pages there is nothing to virtualize.

So: build the two items that make the existing feature usable at scale, then stop and let real usage pick the next one.

## Recommended next step — Phase 3.0 + 3.2 together

These two belong in one pass because they share the same list rendering.

**Phase 3.0 — Date sections**
Add a pure grouping layer above `notificationGrouping`: Today / Yesterday / This week / Earlier, computed from the rows a lane has already loaded. Sticky section headers inside the existing scroll region. No schema change, no new fetches, no change to counts or pagination — sections are presentation only, exactly like Phase 2.3 groups.

**Phase 3.2 — Full-page `/notifications` route**
The drawer is the wrong surface for reading months of history on mobile. A route reuses `NotificationList`, both lanes and the same context — no second state owner. Adds a "See all" link in the drawer footer, `noindex` (private route), and the back-button fallback pattern already used elsewhere.

Both are additive, reversible, and touch no invariant.

## Deferred, with the trigger that would un-defer each

| Item | Ship when |
| --- | --- |
| 3.1 mute controls | users ask to silence a specific actor or thread (2.3b already covers per-category) |
| 3.3 rich previews / Follow back | engagement data shows notification click-through is the bottleneck |
| 3.4 type filters / mentions view | typical unread counts exceed ~50 |
| 3.5 per-row actions | a genuine complaint about accidental reads — this one needs its own plan for row versioning |
| 3.6 web push | after retention justifies re-engagement |
| 3.7 virtualization | profiling shows list scroll jank |

## Technical notes for the 3.0 + 3.2 build

- New pure module `src/utils/notificationSections.ts` — takes the already-grouped array, returns `{ label, groups }[]`. Unit tested with fixed clock injection (no ambient `Date.now()` in the pure layer), covering timezone boundaries and unparseable timestamps (which fall to `Earlier`, never dropped).
- `NotificationList` renders sections when given them and stays backwards-compatible for the flat case, so the drawer and the page share one component.
- New page `src/pages/Notifications.tsx` + route in `App.tsx`, reading `useNotificationsContext()` only — no second `useNotifications()` instance, so the ESLint rule stays satisfied.
- Section headers must not break the existing infinite-scroll sentinel or the lane error/recovery strips.
