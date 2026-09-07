# Phase 4 reset: audit the old standalone recommendations, then retire it in stages

The reviewers are right and my earlier Phase 4 framing was wrong. Saying "you can't recommend a TV show" was inaccurate: since Phase 3 anyone can recommend any of the fifteen kinds by answering "Would you recommend it?" inside a review. The real limitation applies only to the **old separate "recommendation" post**, which is a different feature with its own table, form, card, likes, comments, saves and notifications. So the enum widening is off the table.

## What I found (read-only, this turn)

Two systems exist side by side:

- New: a review carries the recommend answer — explicit answer in the review, later answer on the timeline, rating as fallback — resolved into a stored flag on the review.
- Old: a standalone recommendation post with its own record, its own five-kind category, and its own social interactions.

Facts from the live database:

- 9 standalone recommendations exist. All 9 were written by a **single** account, and the newest is dated **2025-05-20** — over a year old. The feature is effectively dormant.
- 4 of the 9 are linked to an entity; 5 are not.
- They carry real social data: 20 likes, 17 comments, 3 saves, and 16 related notifications.
- 6 of 78 reviews still point at a recommendation record (a historical link).
- The database category list has only five values (food, movie, book, place, product), and all 9 rows already use correct lowercase values, so no data cleanup is needed.

Where it is still wired into the product:

- Creation is still reachable: the recommend form opens from the entity page (both versions) and from the main compose button on the feed.
- Reading/rendering: the entity page, a person's profile tab, the recommendation detail view, search results, and notification targets.
- Server-side: about a dozen database routines mention it — trending scores, reputation, user similarity, "who to follow", personalized entities, network/circle discovery, and the like/comment notification triggers. Several discovery routines appear to reference **both** the old table and the new review flag, which is exactly the double-counting risk the reviewers flagged.

## My recommendation

Retire the standalone recommendation post, in stages, and do not modernise its taxonomy. Reasons:

- It duplicates the new model. A review with a positive recommend answer already says "I recommend this", with better evidence (rating, written experience, structured answers, and updates over time).
- It splits the numbers. If discovery counts both sources, recommendation counts, rankings and trust signals become ambiguous — and some routines already touch both.
- It is dormant, not load-bearing. One author, nothing new in over a year, five of nine not even attached to an entity.
- Widening its category list would spend effort making a system we intend to drop better supported, and enum values cannot be cleanly removed later.

Reasons to keep it would be a genuine "recommend without writing a review" job. That is a real product idea, but it should then be rebuilt as a lightweight review, not preserved as a second content model — and today nothing suggests users want it, since only one person ever used it.

Nothing is deleted in the first steps, so this is reversible until the very last one.

## Plan

Step 4.0 — Finish the audit precisely (no code or database changes)
- For each of the roughly dozen database routines, confirm whether it really reads the old table or merely has "recommendation" in its name, and record which ones mix both sources.
- List every screen that reads the old records and decide, per screen, whether it should read reviews instead or keep showing history.
- Confirm what the 9 rows and their 17 comments represent (real user content vs demo data) before deciding whether to keep them visible.
- Output: a short classification table — new system / legacy but still needed / legacy dead / genuinely separate — written to `docs/verification/phase-4-recommendations-audit.md`.

Step 4.1 — Stop new creation (user-visible, easily reversible)
- Remove the entry points: the recommend form on both entity pages and in the feed compose menu, replacing them with the review flow on the same subject.
- Keep the form component and write service in place but unreferenced for one step, so reverting is a one-line change.

Step 4.2 — Make discovery single-source
- Any routine or query that counts or ranks "recommendations" reads only the review-based flag, so counts stop mixing the two.
- Anything left reading the old table for discovery is either switched or removed, with before/after counts recorded for the surfaces involved.

Step 4.3 — Preserve history, then remove the code
- Existing records stay readable at their own detail page (and in profile history if the audit says they are real content), so old links and notifications do not break.
- Delete the write service, the form, and the old five-value category vocabulary in TypeScript; the read path keeps working from canonical types.

Step 4.4 — Database clean-up, last and separately
- Only after all consumers are gone: decide per the audit whether to archive the 9 rows and their social data or leave the table read-only in place. No table or type is dropped in this plan.

## Technical notes

- The old category list stays untouched; the TypeScript enum with its extra invented values (Drink, Activity, Music, Art, TV, Travel, Brand) is dead vocabulary that can never be stored and gets deleted in 4.3.
- The historical link from a review to a recommendation record is kept; it is only history and nothing reads it for logic.
- Notification targets that point at recommendation records must keep resolving through 4.3, otherwise old notifications dead-end.
- Adding to a Postgres enum is additive but not cleanly reversible — another reason not to widen it.
- Each step ends with the full test suite, a typecheck and a build, and ships independently.
- Roadmap: Phase 4 is rewritten from "align recommendation taxonomy" to "audit and retire standalone recommendations"; I will record this in `roadmap.md` as the first action once the plan is approved.
