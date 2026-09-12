# Close out 4.2B.0, then write the 4.2B.1 scoring contract (documents only)

## What I checked (in the live database and the code, not from notes)

The 4.2B.0 cutover itself is in place and its numbers are right:

- The new review-only statistics table exists with 329 item rows, its unique index and rating
  index, its owner set explicitly, and exactly one hourly refresh job (no duplicate).
- Its numbers match a hand-written canonical check exactly: 49 current public published
  reviewers, 36 of whom recommend. The raw table has 78 review rows, so canonicalisation and
  the public/published filter are genuinely being applied before counting.
- Every reader I could find now reads the new source: item page statistics and rating, Explore,
  discovery, batch item fetch, the separately deployed search function. The Explore directory
  count now goes through the new people-based batch routine (invoker-privileged), and the feed
  polling query no longer mentions old records at all.
- The old statistics table is still present and is no longer read by any app code — that is the
  intended additive retirement, cleaned up later.

## What is genuinely left over from 4.2B.0

Only the closing evidence, not behaviour:

1. No written verification document for 4.2B.0 (every earlier phase has one under
   `docs/verification/`).
2. The roadmap still shows 4.2B.0 as unchecked.
3. The test suite, typecheck and build have not been run since the reader switch.

## Step 1 — finish 4.2B.0

- Run the existing suite, typecheck and build; fix anything the switch broke.
- Write `docs/verification/phase-4-2b0-entity-stats-cutover.md` recording: the numbers above with
  the exact canonical query, the index/grant/refresh-job checks, every reader named individually
  (including any that needed no change), and the explicit statement that the old statistics table
  is retained but unread.
- Tick 4.2B.0 in `roadmap.md`.
- One item deliberately stays open and is named as such: search results still *list* old
  standalone records as content. That is legacy rendering, removed in 4.3, and it does not feed
  any count, rating or score.

## Step 2 — 4.2B.1: the scoring contract, as documents only

No routine, no pipeline, no behaviour changes in this step. Two new files:

`docs/verification/phase-4-2b-scoring-contract.md` — for each signal (trending, similarity,
influence, reputation, who-to-follow, personalised items), state on one row each:

- which population is eligible, decided by the surface, not one global rule:
  - public/global signals → current public published reviews
  - viewer-specific / Circle signals → current reviews that viewer is authorised to see
  - private → never contributes outside owner-only logic, never enters a global aggregate
- the counting unit, stated per signal rather than globally:
  - endorsement and population metrics → distinct people
  - an item's rating population → distinct reviewing people
  - a person's contribution volume → distinct items they reviewed
  - trending contributions → eligible contributions in the window, with explicit dedupe and a
    per-person cap
  - engagement → distinct eligible interaction events, capped per actor
  - reputation volume → that author's own eligible reviews and posts
- exact weights, normalisation, caps, thresholds, the sparse-data result, and the privacy rule.

Two rules are stated explicitly because they are easy to get wrong:

- Rating and taste signals are **not** restricted to endorsing reviews. A low-rated review that
  says "no" still carries real rating and taste information and must count towards averages,
  similarity and Circle rating. Only endorsement metrics filter to "recommends".
- Trending weights across views, engagement and contributions are only valid once normalisation
  or caps are defined, otherwise a thousand likes swamps twenty views whatever the coefficients
  are.

Consensus calibration for influence stays out of this contract entirely — a separate experiment
with its own safeguards.

`docs/verification/phase-4-2b-scoring-fixtures.json` — small frozen fixtures with expected values
per signal, so the later migration steps are checked against agreed numbers instead of being
re-decided while coding.

## Hard stop

After the contract and fixtures are written, stop for review. No scoring routine (4.2B.2) and no
client pipeline (4.2B.3) changes until the contract is approved.
