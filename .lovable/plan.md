# Close out 4.2B.0, then write the 4.2B.1 scoring contract (documents only)

## What I checked (in the live database and the code, not from notes)

The 4.2B.0 cutover itself is in place and its numbers are right:

- The new review-only statistics aggregate (a materialized view) exists with 329 item rows, its
  unique index and rating index, its owner set explicitly, and exactly one hourly refresh job
  (no duplicate).
- Its numbers match a hand-written canonical check exactly: 49 current public published
  reviewers, 36 of whom recommend. The raw table has 78 review rows, so canonicalisation and
  the public/published filter are genuinely being applied before counting.
- Every reader I could find now reads the new source: item page statistics and rating, Explore,
  discovery, batch item fetch, the separately deployed search function. The Explore directory
  count now goes through the new people-based batch routine (invoker-privileged), and the feed
  polling query no longer mentions old records at all.
- The old statistics view is still present and is no longer read by any app code — that is the
  intended additive retirement, cleaned up later.

## What is genuinely left over from 4.2B.0

Only the closing evidence, not behaviour:

1. No written verification document for 4.2B.0 (every earlier phase has one under
   `docs/verification/`).
2. The roadmap still shows 4.2B.0 as unchecked.
3. The test suite, typecheck and build have not been run since the reader switch.

## Step 1 — finish 4.2B.0

- Run the existing suite, typecheck and build; fix anything the switch broke.
- Write `docs/verification/phase-4-2b0-entity-stats-cutover.md`. It records the numbers above
  with the exact canonical query, the index/grant/refresh-job checks, and every reader named
  individually (including any that needed no change). It also:
  - names the new aggregate a **materialized view**, so future cleanup uses the correct DDL and
    refresh semantics;
  - states the closure criteria explicitly: **active readers of the old statistics view = 0**
    and **active readers of old standalone records for visible item statistics = 0**;
  - distinguishes harmless leftover mentions (generated type metadata referencing both views,
    historical migration files, stale comments) from live reads — only live reads would be a
    problem;
  - states that the old view is retained but unread, retired with the rest of legacy cleanup.
- Tick 4.2B.0 in `roadmap.md` only after the evidence exists.
- One item deliberately stays open and is named as such: search results still *list* old
  standalone records as content. That is legacy rendering, removed in 4.3, and it does not feed
  any count, rating or score.

## Step 2 — 4.2B.1: the scoring contract, as documents only

No routine, no pipeline, no behaviour changes in this step. Two new files, versioned together.

`docs/verification/phase-4-2b-scoring-contract.md` — for each signal (trending, similarity,
influence, reputation, who-to-follow, personalised items) it freezes the **actual decisions, not
placeholders**. No "to be decided" anywhere. For every signal, one row each:

- formula, exact weights and output range, written as real numbers
- which population is eligible, decided by the surface, not one global rule:
  - public/global signals → current public published reviews
  - viewer-specific / Circle signals → current reviews that viewer is authorised to see
  - private → never contributes outside owner-only logic, never enters a global aggregate
- canonical selection rule (current review per person/item)
- the counting unit, stated per signal rather than globally:
  - endorsement and population metrics → distinct people
  - an item's rating population → distinct reviewing people
  - a person's contribution volume → distinct items they reviewed
  - trending contributions → eligible contributions in the window, with explicit dedupe and a
    per-person cap
  - engagement → distinct eligible interaction events, capped per actor
  - reputation volume → that author's own eligible reviews and posts
- time windows (view / contribution / engagement windows with exact durations)
- normalisation formula, caps, thresholds
- sparse-data result and null/error result, stated exactly (e.g. minimum shared items for
  similarity, insufficient evidence → NULL, zero-variance behaviour)
- privacy rule, fallback behaviour, and how each consumer should interpret the output
- per-signal specifics already agreed: who-to-follow exclusions (self, already-following),
  personalised-items candidate pool and exclusions, reputation inputs (a negative review is a
  real contribution and is not penalised)

Two rules are stated explicitly because they are easy to get wrong:

- Rating and taste signals are **not** restricted to endorsing reviews. A low-rated review that
  says "no" still carries real rating and taste information and must count towards averages,
  similarity and Circle rating. Only endorsement metrics filter to "recommends".
- Trending weights across views, engagement and contributions are only valid once normalisation
  or caps are defined, otherwise a thousand likes swamps twenty views whatever the coefficients
  are.

Consensus calibration for influence stays out of this contract entirely — a separate experiment
with its own safeguards.

`docs/verification/phase-4-2b-scoring-fixtures.json` — versioned alongside the contract
(`contractVersion` field). Each scenario has a stable id the later database and app tests can
reference (e.g. `similarity_insufficient_overlap`), and includes **expected intermediate values
as well as the final output** — shared items, raw similarity, overlap confidence, then final
similarity — so a later failure points at the step that broke instead of only the total.

## Hard stop

After the contract and fixtures are written, stop for review. No scoring routine (4.2B.2) and no
client pipeline (4.2B.3) changes until the contract is approved.
