# Phase 0 close-out — duplicates resolved by hand, full-view foundation approved

The master plan stays locked. This step changes nothing you can see in the app. It records the two remaining Phase 0 decisions, waits for you to delete the duplicate reviews yourself, then re-checks and closes Phase 0.

## Decision 1 — duplicate reviews (you delete, we verify)

The two duplicate pairs, both by rishab.devp:

**Pair A — "Zero to One" (book)**
- `01bd8519-fcee-4780-a269-6bcf28a3e098` — created 2025-11-11, rating 4, text "After this you must also read atomic habits by james clear", headline "Must read book.", experience date, book-cover image, no timeline.
- `2dc27d4d-3d2e-434e-8e2a-855a775f8fb8` — created 2026-08-26, rating 3 (latest 2.0), no text, has 1 timeline update, not recommended.

**Pair B — "Classic burger" (food)** — looks like an accidental double-submit, one minute apart:
- `59e96f18-503b-44a6-be85-4a5989a6da0c` — rating 4, text "Very juicy".
- `32a4a951-275d-4b7f-8ffb-fbc90221bf98` — rating 4, text "tender".

No likes, saves, or other dependent records on any of the four rows, so deleting any of them is safe.

What happens:
1. You delete the unwanted rows manually (your call which ones).
2. We re-run the duplicate check and confirm zero duplicate person/entity pairs remain.
3. The Phase 0 findings document records which IDs were removed and by whom.

## Decision 2 — shared full-review view (approved as foundation)

`ReviewTimelineViewer` is approved as the **foundation** of the shared full-review view, with this clarification: it must eventually open for every review — with or without timeline history — show the complete original review and all supported structured answers, and treat the timeline as one section of the full review. It may be renamed or extracted into a general full-review component during Phase 3. Admin preview stays separate. No dedicated link for now.

## Also recorded

- The 17 legacy reviews saved under the wrong type keep their existing compatibility behavior. They are **not** migrated in Phase 1.
- **First implementation gate before Phase 1:** the database rule enforcing one review per person per entity, plus the "Review" → "Update your review" routing, must be in place before Phase 1 is allowed to create more review data. This gate is planned separately and starts only after you approve it.

## What you get back

After your manual deletions: a re-run duplicate check showing zero pairs, an updated findings document, and Phase 0 presented for final approval. Nothing in the app or the data changes in this step.

## Technical notes

- The re-check is the same read-only query as Phase 0 (`reviews` grouped by user_id, entity_id).
- Findings go in `docs/verification/review-phase-0.md`; nothing goes in `AGENTS.md`.
