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
- contribution volume `min(|credited set|, 100) / 100 × 0.35`
- engagement received `min(total likes on the credited set / |credited set|, 50) / 50 × 0.30`,
  excluding likes by the contribution's own author

**The credited set is defined once and both terms use exactly it** — this removes the ambiguity the
last review found. For a given author and category, the credited set contains:

- one row per `(author, entity)` for the author's canonical published review of that entity, and
- one row per `(author, entity)` for the author's **earliest eligible** entity-linked post about that
  entity — a post linked to three product entities yields three product rows (one per entity), and
  ten posts about one entity yield one row.

Engagement's numerator counts likes **only on the exact content selected into that set**, and its
denominator is `|credited set|`, so ten posts about one item can neither inflate volume nor inflate
the like average. Credited rows with zero likes stay in the denominator.

Per-category influence is deliberately not additive across categories: a post spanning three types
contributes to all three. Posts with no linked entity contribute to no category. The category domain
is the **15 canonical entity types** (`src/services/entityType.ts`) — not the five-bucket
search/filter projection and not the legacy recommendation-category enum. Existing
`social_influence_scores` rows on the old domain are deleted and recomputed, not translated.

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
- **Engagement cap scope is per actor, per item, per window** — one actor contributes at most 5
  qualifying likes to an item in 24 h, no matter how many reviews and posts attached to that item
  they like. It is explicitly *not* 5 per content row.
- **Anonymous views are capped in aggregate.** Null-viewer rows count at most
  `min(anon_rows, 2 × identified_capped_views + 50)` and are additionally deduped by
  `(session_id, item)` where a session is recorded. No unbounded input remains.

- **Self activity is narrowed to what the data can actually express**: `entity_views` records
  entity-page views only (`entity_id, user_id, session_id, interaction_type, created_at`) and
  carries no review or post reference, so there is no "self view of a review" to exclude — entity
  views count under the viewer/session caps for everyone, including people who have reviewed the
  item. The exclusions that *are* implementable and frozen: a like on one's own review does not
  count, a like on one's own post does not count. Whoever created the item's database row is **not**
  treated as its owner; their reviews, posts, likes and views count normally. If per-review or
  per-post view events are ever introduced, author self-view exclusion is added there, in a later
  contract version.
- Final score `(0.3·base_popularity_n + 0.4·velocity + 0.15·geo_n + 0.15·seasonal_n) × age_factor`,
  with **null-safe two-sided clamps** so the [0, 1.2] range is actually guaranteed:
  `base_popularity_n = clamp(coalesce(popularity_score, 0), 0, 1000) / 1000`,
  `geo_n = clamp(coalesce(geographic_boost, 0), 0, 1)`,
  `seasonal_n = clamp(coalesce(seasonal_boost, 0), 0, 1)`,
  `age_factor ∈ {1.0, 1.1, 1.2}` and never NULL.
- **`popularity_score` provenance — audited, and the answer is clean**: `entities.popularity_score`
  is NULL for all 353 rows and no migration or routine writes it, so no legacy standalone-record
  value can leak into trending through it. The contract records this evidence and freezes
  `base_popularity_n = 0` in practice until a later phase defines popularity from modern sources.
  `geographic_boost` / `seasonal_boost` are likewise unpopulated (default 0) and contribute 0.
- **Post-to-entity linkage is one frozen normalised relation**, used identically by trending
  contributions, engagement attribution, influence categories and personalised activity:
  `SELECT post_id, entity_id FROM post_entities UNION SELECT id, entity_id FROM posts WHERE
  entity_id IS NOT NULL` — `UNION`, never `UNION ALL`, so a post linked both ways counts once.
  Backfilling and retiring the legacy column is named as later cleanup, not part of 4.2B.
- **Review eligibility uses the columns that exist.** `reviews` has no `is_deleted`: eligibility is
  `status = 'published'` plus `visibility`. `posts` and `entities` do have `is_deleted = false` and
  keep using it. The shared-rules section of v1 is corrected accordingly — this was a real defect
  that would have made the 4.2B.2 migration fail.
- **Candidate selection is defined explicitly**: items with any view, engagement, review, timeline
  update or entity-linked post in the last 24 h, union items whose stored score is non-zero (so
  decay to 0 is recorded and recomputed until it reaches its true no-activity value). Full-table
  scans are not used.
- **Legacy transition**: stored pre-v2 trending scores are on the old unbounded scale. The 4.2B.2
  migration recomputes every stored score in the same transaction that installs the routine, and
  readers clamp defensively (`clamp(stored, 0, 1.2)`), so no old-scale value is ever consumed as a
  v2 normalised value.

## 3. Personalised items — normalise before weighting

Every term is null-safe and two-sided clamped, so [0, 1] is guaranteed rather than assumed:

- `interest_n = clamp(coalesce(interest_score, 0), 0, 5) / 5`
- `social_n = clamp(coalesce(distinct followed reviewers in 30 d, 0), 0, 5) / 5`
- `trending_n = clamp(coalesce(stored trending score, 0), 0, 1.2) / 1.2`
- `score = clamp(0.5·interest_n + 0.3·social_n + 0.2·trending_n, 0, 1)`
- **Deterministic tie-break**: `score DESC, trending_n DESC, item id ASC` — stable across calls, so
  pagination cannot shuffle.


Trending can no longer overwhelm personalisation by scale. Reason precedence unchanged
(interests > follow activity > trending); sparse users fall back to trending-only ranking.

## 4. Who-to-follow — pool, then score once

Frozen interpretation: **the three sources are candidate discovery only.** After deduplication,
every feature (mutual count, 7-day activity, profile quality) is computed for every candidate,
regardless of which source found them, and one global score orders the list. Exclusions (self,
already followed, 7-day impressions) are unchanged. When a candidate is found by several sources,
the **reason follows a frozen priority: friends-of-friends > active > fresh**, so the explanation is
as deterministic as the ranking. Tie-break stays `score DESC, user id ASC`.


## 5. Fixtures — cover every normative branch

`contractVersion: 2` adds, alongside the retained similarity cases:

- influence: positivity invariance (avg 1.0 vs 5.0 → identical score), multi-type post attribution
  counted once per canonical type, uncategorised post excluded, ten posts about one item crediting
  one, self-like on own contribution excluded, sparse user
- trending: normalised component maths, review+post contribution cap of 2 per person, a timeline
  update counting once (and not twice with the review), anonymous-view aggregate cap, entity-page
  view by a reviewer of that item *counted*, self-like on own review/post excluded, entity-creator
  contribution *included*, NULL and negative popularity/boost inputs clamped to 0, legacy stored
  score clamped, post linked via both `post_entities` and `posts.entity_id` counted once,
  candidate-selection membership, zero-activity decay
- personalised: high trending score not overwhelming interest, NULL interest score yielding a real
  score rather than NULL, exact tie-break order, reviewed/saved exclusion, sparse fallback
- who-to-follow: candidate found by one source but scored on all features, multi-source reason
  priority, 7-day impression exclusion with intermediates, tie-break by id
- similarity: both users constant at 5, one constant 5 vs one constant 1, both constant at
  different levels; and a NULL-preservation note for callers (`x ?? 0` is forbidden in 4.2B.3)
- reputation: clamp at 1000, unpublished/private/deleted exclusion using the real predicates,
  negative review parity
- privacy: private review never in any global aggregate; Circle-visible review counts only in
  viewer-specific surfaces
- canonical selection: duplicate rows collapsed inside scoring inputs
- sparse data returns 0/NULL as specified and is never an error


## 6. Deployment cutover — no mixed-version window

Frozen in the contract so 4.2B.2 and 4.2B.3 cannot expose half-migrated semantics:

- **Trending**: the routine install and the full recompute of every stored score happen in one
  transaction, and every reader — old or new — clamps `stored` to [0, 1.2]. Because all boost inputs
  are 0 today, old-scale values only ever existed as velocity output; the recompute removes them
  before any normalised reader runs.
- **Influence**: `social_influence_scores` rows on the legacy category domain are deleted in the same
  transaction that installs the routine, then recomputed on canonical types. No stale row survives to
  be mixed with new ones.
- **Similarity**: NULL means "no evidence". 4.2B.3 migrates the routine and every caller as one unit;
  `result || 0` and `result ?? 0` are forbidden and checked for before that step is called done.
- **Boosts stay frozen at 0**: `geographic_boost` and `seasonal_boost` remain unwritten until a later
  contract version defines them, so activity velocity — not dormant inputs — drives trending today.
  Populating them requires another contract review, because they would otherwise be 30% of the score.

## 7. Two additions of my own

- **Saturation constants are named and reviewable.** Every `min(x, K)` constant (500 views, 200
  engagement, 50 contributions, 1000 followers, 100 items, 50 likes, 1000 popularity) is listed in
  one table in the contract, with the note that they set where a signal stops mattering and should
  be re-tuned from real data after 4.2B.4 rather than silently edited in SQL.
- **Every routine records the contract version it implements**, as a comment in the routine body,
  so a future audit can tell a v2 routine from a v1 one without reading the maths.
- **Every column the contract names is verified to exist** before v2 is frozen — the
  `reviews.is_deleted` defect is exactly what that check catches, and the contract will carry a
  short "fields this contract relies on" table so the next review can confirm it at a glance.

## Technical notes


- Two files change: `docs/verification/phase-4-2b-scoring-contract.md` and
  `docs/verification/phase-4-2b-scoring-fixtures.json`; `contractVersion` and `contractDocument`
  stay in sync.
- The contract's closing section records that v2 supersedes v1 and lists every correction, so the
  audit trail stays readable.
- No SQL, no routine bodies, no client code, no migrations in this step. Hard stop for review.

