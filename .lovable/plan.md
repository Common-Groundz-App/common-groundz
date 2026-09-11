# Phase 4.2A verification, then Phase 4.2B (revised after review)

## 4.2A verification result — complete, no leftovers in its scope

Checked in the database, not from notes: every routine 4.2A promised to migrate now contains
**no** read of the old recommendations table (fallback, active Circle discovery, Circle rating,
Circle counts single + batch, Circle activity gate, both global count routines). The new
recommender routine exists with the agreed caller-privileges shape, owned by the database owner
like every other touched routine. Recorded evidence matches (78 reviews / 58 recommended / same
checksum; fixture 3 rows → 2 people → average 3.0; 633 tests, clean typecheck and build).

Nothing from 4.2A is outstanding.

## Both reviews accepted

All three of ChatGPT's clarifications and all three of Codex's points are folded in below. The
double-counting risk Codex raised is real and I confirmed it: the cached stats view counts old
records and mixes their ratings into the average, and Explore/discovery then **add** the modern
people-based count on top of it. Changing the view alone would inflate every recommendation
number on Explore and discovery.

Execution boundary: **4.2B.0 only, then stop.** 4.2B.1 is a written contract delivered for
review as its own artifact. No scoring routine or discovery pipeline changes until it is
approved.

## 4.2B.0 — visible numbers, migrated as one atomic change

Every reader of entity statistics changes in the same deployment, or the numbers double:

- the cached statistics view (rebuilt: old-record count and old ratings removed, keeping its
  unique index, its rating index and its hourly refresh job intact)
- the entity service stats function (its own old-record count removed)
- the entity rating calculation (old ratings removed)
- Explore and discovery enrichment (stop adding a cached count to the modern count — use the
  modern count alone)
- the batch entity fetch and the search edge function, which read the same view

Frozen meaning for these numbers:

- **Recommendation count** — distinct people whose current public published review of that item
  recommends it. One number, one source, never a sum of two sources.
- **Review count** — the same population, stated explicitly: distinct people with a current
  public **published** review of that item, whatever their recommendation answer. Today it is a
  raw row count and one path doesn't even require "published", so the visible review count can
  disagree with the average it sits next to. After this change the three numbers share one
  population: reviewers, reviewers who recommend, and the average over those reviewers.
- **Average rating** — the average of the effective rating (latest timeline rating, else the
  original) of **all** those current visible reviews, including people who answered "no".
  Old-record ratings no longer participate. Never filtered by "recommends".
- **Explore directory count** — the number of items a person currently publicly recommends,
  one per person/item, from a batch routine that picks the current review **before** filtering to
  "recommends", so an older yes cannot survive a newer public no. No private or Circle-only
  activity on a public directory. The visible wording is checked so it reads as review
  endorsements.
- **Feed new-content polling** — the old-record branch is removed. The remaining query polls
  **all** eligible post types (experience, review post, recommendation post, comparison,
  question, tip — no special treatment for any), keeping public visibility, deleted exclusion,
  the following-author filter, the last-check boundary and count meaning. Structured reviews are
  not added here, because this feed does not render them. Legacy feed *rendering* stays until 4.3.

Verification:

- After rebuilding the cached view, refresh it manually once, then confirm the unique index, the
  rating index, the SELECT grants and the hourly refresh job are all present exactly once (no
  duplicate job scheduled), and that every reader returns the expected numbers off the refreshed
  view.
- Before/after number for a handful of real items and people, written down, with all six readers
  named explicitly — including any that need no code change because the view's shape is unchanged.
- Existing suite, typecheck and build green; audit doc and roadmap updated; then stop.


## 4.2B.1 — scoring contract (a document, no code) — approval gate

`docs/verification/phase-4-2b-scoring-contract.md` states, **per signal**, its eligibility rule,
its counting unit, exact weights, normalisation, caps, thresholds, sparse-data result and
privacy rule. Signals: trending, similarity, influence, reputation, who-to-follow, personalised
items. Two rules replace the over-broad defaults from the previous draft:

**Eligibility follows the surface, not one global rule**
- global/public signals → current public published reviews
- viewer-specific / Circle signals → current reviews that viewer is authorised to see under the
  established rule
- private → never contributes outside owner-only logic, never leaks into a global aggregate

**Counting unit is stated per signal, not globally**
- endorsement / population metrics → distinct people
- an item's rating population → distinct reviewing people
- a person's contribution volume → distinct items they reviewed
- trending contributions → eligible contributions in the window, with explicit dedupe and
  per-person caps
- engagement → distinct eligible interaction events, capped per actor
- reputation volume → that author's own eligible reviews/posts (the author is already one person)

Also fixed in the contract: **rating and contribution signals are not restricted to endorsing
reviews.** A two-ring review that says "no" carries real rating and taste information and must
count for averages, similarity and Circle rating. Only endorsement metrics filter to
"recommends".

Trending weights (views/engagement/contributions) only stay as they are once normalisation or
caps are defined — otherwise a thousand likes swamps twenty views whatever the coefficients say.
Consensus calibration for influence stays out of 4.2B entirely; it is a separate experiment with
the safeguards we agreed (leave-one-out consensus, minimum independent raters, symmetric
treatment of agreement, low-variance penalty, modest capped effect).

Machine-readable fixtures accompany the contract so 4.2B.2/4.2B.3 are checked against frozen
expected values rather than re-decided while coding.

**Stop here for review.**

## 4.2B.2 / 4.2B.3 — not authorised yet

After approval: migrate each scoring routine body only (signature, returned columns, owner and
access rules preserved; trending's per-item calculation and its candidate selection in the same
step), then migrate each client pipeline as a complete unit so no pipeline mixes two sources.

## 4.2B.4 — proof

Production rows stay untouched. Proof uses the 4.2A style: transaction-scoped fixtures or a path
where old rows are unavailable to the tested surface, so any surface that goes blank is shown to
still depend on old data. Before/after table per surface, suite + typecheck + build green,
roadmap updated, stop before 4.3.

## Roadmap additions this introduces

4.2B.0 becomes "atomic entity-statistics pipeline migration (view + all six readers, no
double-count)"; 4.2B.1 becomes an approval-gated contract deliverable; 4.2B.2/4.2B.3 are
explicitly blocked on that approval.

## Out of scope

Removing legacy pages, services, route and rows (4.3), the dead routines (4.5), the feed card
redesign (Phase 5). Review endorsement truth itself is untouched.
