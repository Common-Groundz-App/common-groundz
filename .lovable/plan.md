# Phase 4 reset: audit and retire the old standalone "recommendation post" feature

## Why this plan changed

The original Phase 4 said: widen the standalone recommendation feature's five categories to the canonical fifteen. Both reviewers (ChatGPT and Codex) correctly pointed out that this target is a leftover from before Phase 3. Since Phase 3, recommending is not a separate post type at all — it is an answer inside a review:

1. Explicit answer in the review questionnaire ("Would you recommend it?").
2. Later answer on the review's timeline ("Would you still recommend it?").
3. Rating as a fallback when no explicit answer exists.

These resolve to a stored flag (`is_recommended`) on the review itself. That works for all fifteen entity kinds today. So the claim "you cannot recommend a TV show" was wrong — you can, through a review. What you cannot do is create the old separate recommendation post for a TV show. Upgrading that old post type would modernise a system the newer review model has effectively replaced.

So this plan does NOT widen the old category list. It audits the old feature precisely, then retires it in safe stages.

## The two systems, side by side

New system (keep, this is the product):

- Lives on the review: `reviews.is_recommended`, questionnaire answers, timeline events on `review_updates`.
- Has full precedence logic, undo, tests, and close-out documentation from Phases 3C/3D.

Old system (the subject of this plan):

- A separate `recommendations` table with its own title/description/rating/category/visibility, plus its own likes, comments, saves, notifications, form (`RecommendationForm`), card (`RecommendationCard`), detail page, search result type, and a set of database routines.
- Its category field is a database enum with only five values: food, movie, book, place, product. The TypeScript enum additionally declares seven values (Drink, Activity, Music, Art, TV, Travel, Brand) that the database can never store — dead vocabulary.

## Audit findings so far (read-only, verified this session)

Data:

- 9 recommendation rows exist. All 9 belong to a single account. The newest was created 2025-05-20 — over a year ago. The feature is dormant.
- 4 of the 9 rows are linked to an entity; 5 are unlinked free-text posts.
- They carry real social data: 20 likes, 17 comments, 3 saves, and 16 notifications reference them.
- 6 of the 78 reviews carry a historical `recommendation_id` link.
- All 9 rows already use correct lowercase canonical-looking category values, so no data migration would ever be needed for the content itself.

Code wiring:

- Creation is still reachable from three places: both entity detail pages (`EntityDetail`, `EntityDetailV2`) and the feed compose button (`SmartComposerButton`).
- Reading/rendering: entity pages, profile "recommendations" tab (`ProfileRecommendations`), the recommendation detail view (`RecommendationContentViewer`), search results (`RecommendationResultItem`), notification targets, and the home feed's legacy branch (`FeedItem` still has a recommendation-item path).
- Server side: roughly a dozen database routines mention recommendations — trending and reputation scoring, user similarity, who-to-follow, personalized entities, network/circle discovery, and like/comment notification triggers. Several discovery routines appear to reference both the old table and the new review flag, which is the double-counting risk.
- The main entity-recommenders surface (`entityRecommendationService.getEntityRecommendersWithContext`) already reads only reviews with `is_recommended = true` — proof the new model is already the primary source on the entity page.

## Decision and reasons

Recommendation: retire the old standalone recommendation post. Do not upgrade its taxonomy.

Why remove rather than keep:

1. Duplication. "I recommend this" is already fully expressible via a review, with richer evidence (rating, written experience, structured answers, evolving timeline). Two parallel ways to recommend the same thing will confuse users.
2. Split metrics. Counts, rankings, trust scores and discovery that read both sources become ambiguous; some already do.
3. Dormancy. One author ever, nothing new in 15+ months, five of nine not even linked to an entity. It is not load-bearing.
4. Wasted investment. Widening the category enum spends effort strengthening something we intend to delete, and enum values cannot be cleanly removed afterwards.

The honest case for keeping it: a lightweight "recommend without writing a review" action is a legitimate product idea. If that desire ever becomes real, the right build is a short-form review (the questionnaire already supports minimal answers), not a second content model. Usage data says nobody wants it today.

Safety: nothing is deleted until the final step, and the first two steps are trivially reversible.

## The plan, step by step

### Step 4.0 — Complete the audit (no code or database changes)

- For each of the ~12 database routines, read the function body and record whether it genuinely reads the old table or merely has "recommendation" in its name. Flag every routine that mixes the old table and the review flag in one result.
- Inventory every screen that reads the old records and decide per screen: switch to review-based data, or keep rendering history.
- Inspect the 9 rows and their 17 comments: real user content or demo data? This decides whether history stays visible in step 4.3.
- Output: `docs/verification/phase-4-recommendations-audit.md` with a classification table — NEW SYSTEM / LEGACY BUT REQUIRED / LEGACY DEAD / GENUINELY SEPARATE — one row per consumer, table, routine and component.
- Gate: the audit must be written before any removal work starts.

### Step 4.1 — Stop new creation (user-visible, reversible)

- Remove the recommend entry points: the form trigger on both entity pages and in the feed compose menu. Where a user would have tapped "Recommend", route them to the review composer on the same subject instead.
- The `RecommendationForm` component and its write service stay in the codebase, unreferenced, for exactly one step so reverting is a one-line change.
- Verify: the full test suite, typecheck and build green; the entity page and feed compose menu still offer reviews correctly.

### Step 4.2 — Make discovery single-source

- Every routine/query that counts or ranks "recommendations" for feeds, explore, entity pages, trust or who-to-follow reads only the review flag, never the old table.
- For each changed routine, record before/after counts for the affected surfaces so nothing silently changes beyond the known 9 rows.
- Database routine changes go through the migration tool with review, one migration per logical group.

### Step 4.3 — Preserve history, then remove the code

- Existing recommendation records stay readable at their own detail page (and in profile history if the audit says the content is real), so old links, shares and the 16 notifications never dead-end.
- Delete: `RecommendationForm`, the recommendation create/update/delete service, the legacy feed branch if unused after 4.2, the `RecommendationCategory` TypeScript enum and its hand-written maps (`entityService.ts`, `hooks/feed/api/recommendations.ts`), and any other consumers the audit classifies as LEGACY DEAD.
- Whatever rendering survives uses the canonical type label helpers already shared across the app.
- Verify: full suite, typecheck, build, plus a grep audit proving no remaining imports of the deleted modules.

### Step 4.4 — Database clean-up (last, and a separate decision)

- Only after zero consumers remain: decide — based on the 4.0 audit — whether to archive the 9 rows and their likes/comments/saves into a log/backup or leave the table in place read-only.
- No table, column or enum is dropped inside this plan. Dropping is a future, separately approved migration.
- The historical `reviews.recommendation_id` link column is kept untouched; it is history and nothing reads it for logic.

## Technical notes

- The old database enum `recommendation_category` is never widened; Postgres enum additions are additive but not cleanly reversible, which is one more reason not to touch it.
- Notification targets pointing at recommendation records must keep resolving through step 4.3 — the detail route stays alive until the very end.
- Each step ships independently and ends with: full Vitest suite, `tsgo --noEmit`, production build, and updated evidence in the audit doc.
- The canonical type list in `src/services/entityType.ts` and the provider/offering registry remain the single source of vocabulary; surviving surfaces consume them rather than restating category lists.
- On approval, first action: rewrite the Phase 4 entry in `roadmap.md` from "recommendations taxonomy alignment" to this staged audit-and-retire sequence.

## Explicitly out of scope

- The new review-based recommendation model (Phases 3C/3D) — no changes.
- Deferred items already on the roadmap (Phase 2.5B wizard consolidation, legacy unlinked review remediation).
- Dropping any table, column or enum.
