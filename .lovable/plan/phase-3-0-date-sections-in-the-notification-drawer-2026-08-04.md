# Phase 3.0 — Date sections in the notification drawer

Scope this increment to date sections only. 3.3A and 3.3B stay unimplemented and get their own revised plans after your manual pass on this one.

## Verdict on the two reviews

Both are right, and Codex found real problems. I checked its structural claims against the code rather than accepting them:

- **Nested interactive controls — confirmed, and it kills 3.3B as written.** `NotificationRow` renders the *entire* row as a single `<button onClick=...>` (`NotificationList.tsx:85`). A `Follow back` button inside it is a button inside a button: invalid HTML, and browsers recover unpredictably — keyboard and screen-reader traversal both break. `stopPropagation` does not fix invalid nesting, it only hides the symptom on mouse clicks. So 3.3B genuinely needs a row-structure refactor first, and 3.3A's thumbnail can stay inside the main button because it has no interaction of its own. Noted for later; not this increment.
- **No shared follow write path — accepted.** My earlier wording claimed one exists. Codex says there are several independent implementations and none centrally updates the `user-following` cache. That is a 3.3B problem and I will verify it properly when I plan 3.3B, rather than restate it as fact now.
- **`now` cannot rerender by itself — correct and it applies to *this* increment.** A pure function given `now` is deterministic, but nothing re-invokes it when the clock crosses midnight. Leave the drawer open overnight and yesterday's rows keep saying "Today". Fixed below.
- **"This week" is ambiguous — correct.** Needs a defined week start.
- **Future timestamps should not all become Today — correct, and better than my version.** Clock skew is minutes; a row dated 2031 is corrupt data and labelling it "Today" is worse than labelling it honestly.

One correction to Codex on the sticky-header worry: I checked the drawer. The tabs (`TabsList`) sit *outside* the scroll container, and the scrolling element is `TabsContent` (`NotificationDrawer.tsx:204,223`). So a header with `top-0` sticks to the top of the scroll region and cannot slide under the tabs — no magic offset needed, which also keeps us aligned with the no-magic-margins rule.

## What I'd add beyond both reviews

- **Sections are computed from the grouped array, not the raw rows.** Grouping already ran; re-partitioning raw notifications would let a group's members land in two different sections.
- **Sections must not break the "all caught up" / count-mismatch / pagination footers.** Those render *after* the sections, as siblings, never inside the last one.
- **The label set is capped at five and never pluralised or counted.** No "3 new", no numeric chips — you already rejected event-count chips, and a header showing a number is the same mistake in a different place.

## Behaviour

`src/utils/notificationSections.ts` — new pure module, no React, no dates read from the ambient clock:

```
partitionIntoSections(groups, now) -> { label, groups }[]
```

Bucketing uses the group's **newest event timestamp** — the exact timestamp the row already displays — resolved in the **viewer's local calendar**, not UTC:

| Label | Rule |
| --- | --- |
| Today | same local calendar day as `now` |
| Yesterday | the local calendar day before |
| This week | within the current local week, **week starts Monday**, excluding the two above |
| This month | within the current local calendar month, excluding the above |
| Earlier | everything older |

Edge rules:
- **Near-future (within 5 minutes of `now`):** treated as Today. This is ordinary client/server clock skew.
- **Far-future (beyond 5 minutes):** goes to `Earlier`. Malformed, but visible — never silently dropped.
- **Unparseable / missing timestamp:** goes to `Earlier`. Also never dropped.
- Order inside every section is exactly the incoming order — the utility partitions, it never sorts.
- Empty sections are omitted. A list with one section renders one header.
- Total groups out always equals total groups in. This is asserted in the tests.

**Midnight rollover:** `NotificationList` holds `now` in state and advances it on a `setTimeout` scheduled for the next local midnight (plus a second of slack), rescheduling itself after each fire. Consistent with the project's timers rule — `setTimeout`, never `setInterval` — and it is cleared on unmount. So a drawer left open overnight relabels correctly instead of lying.

## Rendering

In `NotificationList.tsx`, the flat `groups.map(...)` becomes sections → rows. Each header is a real heading (`<h3>`), `sticky top-0` inside the existing scroll region, with a translucent blurred background so rows scrolling under it stay legible. Typography is small, muted, uppercase-tracked — a divider, not a title competing with the rows.

Untouched, verified by reading the file: row markup, grouping, avatars, `formatNotificationTime`, the skeleton/error/empty branches, `PaginationFooter` and its IntersectionObserver sentinel, the count-mismatch strip, the "You're all caught up" line, both lanes, realtime merging, retraction filtering, preferences.

## Tests

New `src/utils/notificationSections.test.ts`, added to `vitest.config.ts`'s explicit include list, with `now` injected — no reliance on the real clock:

- one row just before and just after local midnight → Yesterday vs Today
- Monday-morning `now`: Sunday's row is *not* "This week"
- month boundary: Jul 31 vs Aug 1 with an August `now`
- a grouped row whose events straddle midnight stays in the section of its newest event
- 3-minute future → Today; 400-day future → Earlier
- `null` / `"not-a-date"` → Earlier, still present
- empty input → `[]`; conservation of count across a mixed fixture
- section order is always Today → Yesterday → This week → This month → Earlier

## Files

- new `src/utils/notificationSections.ts`
- new `src/utils/notificationSections.test.ts`
- edit `src/components/notifications/NotificationList.tsx` (section rendering + midnight timer)
- edit `vitest.config.ts` (include the new suite)
- edit `docs/NOTIFICATION_CENTER_ROADMAP.md` (3.0 done; 3.3A/3.3B pending with the row-refactor and follow-mutation prerequisites recorded; 3.1/3.2/3.4–3.7 deferred with revisit triggers)

No migration, no edge function, no service or hook changes.

## Then we stop

I run the suite, you do your manual pass. After that I write the revised 3.3A plan (bounded account-safe media resolution reusing `muxMedia.ts`, image/poster URLs only — never a raw video URL) and then 3.3B (row-structure refactor first, then a single cache-aware follow mutation, tri-state, no button for missing or deleted actors).
