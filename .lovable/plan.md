# Phase 4.2B.1 revision — scoring contract v2 (documents only)

Both reviews are right, and the strongest point is the influence one: an average-rating term is a
positivity reward however it is labelled. This revision fixes all four structural problems, adds
the missing fixture branches, and changes **no code** — only
`docs/verification/phase-4-2b-scoring-contract.md` and
`docs/verification/phase-4-2b-scoring-fixtures.json`, bumped together to `contractVersion: 2`.

Hard stop after this. 4.2B.2 (routine bodies) and 4.2B.3 (client pipelines) start only on approval
of v2.

## 1. Influence — drop positivity entirely

New definition, all terms bounded, total in [0, 1]:

- reach `min(followers, 1000) / 1000 × 0.35`
- contribution volume `min(distinct items reviewed + entity-linked posts in category, 100) / 100 × 0.35`
- engagement received `min(avg likes per contribution, 50) / 50 × 0.30`

The 0.30 previously held by "rating quality" is redistributed to reach and contribution (+0.05
each) and engagement (+0.10). No term reads any rating value. A reviewer averaging 1.0 and one
averaging 5.0 with identical reach, volume and engagement score identically — frozen as a fixture
invariant.

**Category attribution** (previously undefined): a review's category is its subject item's
category; a post's category is the category of its linked items, and a post linked to items in
several categories counts once in each. Posts with no linked item contribute to no category.

Judgment/calibration quality stays out — Influence v2, separate experiment.

## 2. Trending — normalise, then weight

Each component is normalised to [0, 1] with an explicit saturation constant before weights apply:

- `views_n = min(capped_views, 500) / 500`
- `engagement_n = min(capped_engagement, 200) / 200`
- `contributions_n = min(capped_contributions, 50) / 50`
- `velocity = 0.5·views_n + 0.3·engagement_n + 0.2·contributions_n` → bounded [0, 1], so the
  weights are real percentages.

Cap and input corrections:

- **Contributions include entity-linked posts.** Per person, per item, per window:
  at most 1 canonical review **plus** at most 1 entity-linked post = max 2. This removes the
  fixture's contradiction with canonicalisation.
- **Contribution recency is the content's own creation time**: a review contributes on its
  canonical `created_at`, a post on its `created_at`. **Timeline updates also contribute**, but the
  per-person-per-item review contribution stays 1: a new review *or* a qualifying timeline update
  (rating, intent, comment or media changed) counts once, never both, and multiple edits in the
  window count once. Living journeys therefore re-trend an item, without becoming a spam channel.
- **Anonymous views are capped in aggregate.** Null-viewer rows count at most
  `min(anon_rows, 2 × identified_capped_views + 50)` and are additionally deduped by
  `(session_id, item)` where a session is recorded. No unbounded input remains.
- **Self activity is narrowed to self-engagement on one's own content**: an author's likes on their
  own review or post, and their own views of it, give no credit. Whoever created the item's
  database row is *not* treated as its owner — their reviews, posts and views count normally.
- Final score `(0.3·base_popularity_n + 0.4·velocity + 0.15·geo_n + 0.15·seasonal_n) × age_factor`,
  with **two-sided clamps** so the [0, 1.2] range is actually guaranteed:
  `base_popularity_n = clamp(popularity_score, 0, 1000) / 1000`,
  `geo_n = clamp(geographic_boost, 0, 1)`, `seasonal_n = clamp(seasonal_boost, 0, 1)`,
  each NULL → 0, `age_factor ∈ {1.0, 1.1, 1.2}` and never NULL. Sources are the existing
  `entities.popularity_score`, `entities.geographic_boost`, `entities.seasonal_boost` columns
  (both boosts currently default 0 and are unpopulated, so they contribute 0 until a later phase
  defines them).
- **Candidate selection is defined explicitly**: items with any view, engagement, review, timeline
  update or entity-linked post in the last 24 h, union items whose stored score is non-zero (so
  decay to 0 is recorded). Full-table scans are not used.
- **Legacy transition**: stored pre-v2 trending scores are on the old unbounded scale. The 4.2B.2
  migration recomputes every stored score in the same transaction that installs the routine, and
  readers clamp defensively (`clamp(stored, 0, 1.2)`), so no old-scale value is ever consumed as a
  v2 normalised value.


## 3. Personalised items — normalise before weighting

- `interest_n = min(interest_score, 5) / 5`
- `social_n = min(distinct followed reviewers in 30 d, 5) / 5`
- `trending_n = stored trending score / 1.2` (already bounded by section 2)
- `score = 0.5·interest_n + 0.3·social_n + 0.2·trending_n`, range [0, 1].

Trending can no longer overwhelm personalisation by scale. Reason precedence unchanged
(interests > follow activity > trending); sparse users fall back to trending-only ranking.

## 4. Who-to-follow — pool, then score once

Frozen interpretation: **the three sources are candidate discovery only.** After deduplication,
every feature (mutual count, 7-day activity, profile quality) is computed for every candidate,
regardless of which source found them, and one global score orders the list. `source` is retained
only for the reason string. Exclusions (self, already followed, 7-day impressions) are unchanged.

## 5. Fixtures — cover every normative branch

`contractVersion: 2` adds, alongside the retained similarity cases:

- influence: positivity invariance (avg 1.0 vs 5.0 → identical score), multi-category post
  attribution, uncategorised post excluded, sparse user
- trending: normalised component maths, review+post contribution cap of 2 per person,
  anonymous-view aggregate cap, self-activity exclusion, candidate-selection membership,
  zero-activity decay
- personalised: normalisation with a high trending score not overwhelming interest, tie-break,
  reviewed/saved exclusion, sparse fallback
- who-to-follow: candidate found by one source but scored on all features, 7-day impression
  exclusion with intermediates, tie-break by id
- reputation: clamp at 1000, deleted/draft/private exclusion, negative review parity
- privacy: private review never in any global aggregate; Circle-visible review counts only in
  viewer-specific surfaces
- canonical selection: duplicate rows collapsed inside scoring inputs
- sparse data returns 0/NULL as specified and is never an error

## Technical notes

- Two files change; `contractVersion` and `contractDocument` stay in sync.
- Section 7 of the contract is updated to record that v2 supersedes v1 and lists the four
  corrections, so the audit trail stays readable.
- No SQL, no routine bodies, no client code, no migrations in this step.
