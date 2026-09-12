# Phase 4.2B.1 — scoring contract (version 2)

**Status: frozen for review. Nothing here is implemented yet.** This document is the approval
gate for 4.2B.2 (routine bodies) and 4.2B.3 (client pipelines). Every number below is a decision,
not a placeholder. Fixtures with expected intermediate and final values live in
`phase-4-2b-scoring-fixtures.json` (`contractVersion: 2`), which is versioned together with this
document — change one, change both.

Companion machine-readable file: `docs/verification/phase-4-2b-scoring-fixtures.json`.

**v2 supersedes v1.** Section 9 lists every correction and why it was made.

---

## 0. Shared rules (apply to every signal)

**Canonical review selection.** Unless a signal says otherwise, "reviews" means: one current row
per `(user_id, entity_id)` chosen by `created_at DESC NULLS LAST, id DESC`. Effective rating =
`COALESCE(latest timeline rating, original rating)`.

**Eligibility predicates use the columns that actually exist.**

| Table | Deleted / published predicate |
|---|---|
| `reviews` | `status = 'published'` plus `visibility` — **there is no `reviews.is_deleted` column** |
| `posts` | `is_deleted = false` plus `status` and `visibility` |
| `entities` | `is_deleted = false` |

**Fields this contract relies on** (verified against the live schema before freezing):

| Table | Fields used |
|---|---|
| `reviews` | `id, user_id, entity_id, rating, latest_rating, is_recommended, status, visibility, created_at` |
| `review_updates` | `id, review_id, user_id, rating, comment, media, would_recommend, created_at` |
| `posts` | `id, user_id, entity_id, post_type, status, visibility, is_deleted, created_at` |
| `post_entities` | `post_id, entity_id` |
| `entity_views` | `entity_id, user_id, session_id, interaction_type, created_at` |
| `entities` | `id, type, created_at, is_deleted, popularity_score, geographic_boost, seasonal_boost, trending_score` |
| `review_likes`, `post_likes` | actor + target ids, `created_at` |
| `follows`, `profiles`, `user_interests`, `user_reputation`, `suggestion_impressions` | as named per signal |

**Eligibility follows the surface, not one global rule.**

| Surface | Eligible input |
|---|---|
| Public / global signals | current **public published** canonical reviews |
| Viewer-specific / Circle signals | current canonical reviews **that viewer is authorised to see** (own + public + Circle of followed) |
| Private reviews | never contribute outside owner-only logic; never enter any global aggregate |

**Counting unit is per signal, never globally.**

| Metric kind | Unit |
|---|---|
| Endorsement / population metrics | distinct people |
| An item's rating population | distinct reviewing people |
| A person's contribution volume | credited contribution rows (defined in §3) |
| Trending contributions | eligible contributions in the window, deduped, per-person cap |
| Engagement | distinct eligible like events, capped per actor **per item** |
| Reputation volume | the author's own eligible reviews/posts (author is already one person) |

**Post-to-entity linkage — one normalised relation**, used identically by trending contributions,
engagement attribution, influence categories and personalised activity:

```sql
SELECT post_id, entity_id FROM public.post_entities
UNION
SELECT id AS post_id, entity_id FROM public.posts WHERE entity_id IS NOT NULL
```

`UNION`, never `UNION ALL`: a post linked through both representations counts once. Backfilling and
retiring the legacy `posts.entity_id` column is later cleanup, not part of 4.2B.

**Self-activity — only what the data can express.** `entity_views` records entity-page views and
carries no review or post reference, so there is no "self view of a review" to exclude: entity views
count under the viewer/session caps for everyone, including people who reviewed the item. The
implementable exclusions, frozen: **a like on one's own review does not count, a like on one's own
post does not count.** Whoever created an entity's database row is **not** treated as its owner —
their reviews, posts, likes and views count normally. If per-review/per-post view events are
introduced later, author self-view exclusion is added there, in a later contract version.

**Two explicit rules.**

1. Rating and taste signals are **not** restricted to endorsing reviews. A low-rated "no" review
   carries real rating and taste information and counts toward averages, similarity and Circle
   rating. Only endorsement metrics filter to `is_recommended`.
2. Editorial "Recommendation" post type is **not** an endorsement signal. No score reads
   `posts.post_type = 'recommendation'` as endorsement.

**Consensus calibration for influence is out of scope** — a separate later experiment with its
own safeguards (leave-one-out consensus, minimum independent raters, symmetric agreement,
low-variance penalty, modest capped effect).

---

## 1. Saturation constants (all in one place)

Every `min(x, K)` in this contract, with its meaning: K is where a signal stops mattering.
These are tuning knobs, to be re-tuned from real data after 4.2B.4 — not edited silently in SQL.

| Constant | Value | Used by |
|---|---|---|
| views saturation | 500 | trending `views_n` |
| engagement saturation | 200 | trending `engagement_n` |
| contributions saturation | 50 | trending `contributions_n` |
| views cap per identified viewer | 20 / 24 h | trending |
| anonymous view aggregate cap | `2 × identified_capped_views + 50` | trending |
| engagement cap per actor per item | 5 / 24 h | trending |
| contributions cap per person per item | 2 (1 review-side + 1 post) | trending |
| followers saturation | 1000 | influence reach |
| credited-set saturation | 100 | influence contribution volume |
| avg-likes saturation | 50 | influence engagement |
| popularity saturation | 1000 | trending `base_popularity_n` |
| who-to-follow activity cap | 10 / 7 d | who-to-follow |
| personalised follow-activity cap | 5 people | personalised items |
| personalised interest saturation | 5 | personalised items |

---

## 2. Trending — `calculate_enhanced_trending_score(entity)`

The plain `calculate_trending_score` is retired; the enhanced routine is the single trending
calculation, used for both per-item scoring and candidate selection.

**Windows:** views 24 h; contributions 24 h; engagement 24 h. Entity-age boost tiers at 7 and 30 days.

**Signals, units and caps:**

- **views** — qualifying rows in `entity_views` in the window. `entity_views` is a **mixed
  interaction table**, not a view log: `interaction_type` accepts `view`, `like`, `save`, `click`
  (and all 603 live rows are `click`). Frozen: a **view** is `interaction_type IN ('view','click')`
  or NULL — page-level attention. `like` and `save` rows are excluded, because engagement is already
  its own weighted term and counting them here would double-count the same act.
  - identified viewers: capped at **20 per distinct viewer**;
  - anonymous (null `user_id`) rows: deduped by `(session_id, entity_id)` where a session is
    recorded, then capped in aggregate at `min(anon_rows, 2 × identified_capped_views + 50)`.
    No unbounded input remains.
- **contributions** — per person, per item, per window, at most **2**: at most 1 review-side
  contribution **plus** at most 1 entity-linked post. Recency is the content's own creation time
  (`reviews.created_at`, `posts.created_at`). A **qualifying timeline update** (rating, endorsement
  intent, comment or media changed) also counts as the review-side contribution, so a living journey
  can re-trend an item — but a new review *or* a timeline update counts once, never both, and several
  edits in the window count once.
- **engagement** — distinct like events on the item's **canonical** reviews and its entity-linked
  posts, capped at **5 per actor per item per window** (explicitly *not* 5 per content row), excluding
  self-likes. The review side uses the same canonical `(user_id, entity_id)` selection as
  contributions: likes on a superseded duplicate review row do **not** count, so duplicate rows
  cannot inflate engagement.

**Normalise, then weight** — so the coefficients are real percentages:

```text
views_n         = min(capped_views, 500) / 500
engagement_n    = min(capped_engagement, 200) / 200
contributions_n = min(capped_contributions, 50) / 50
velocity        = 0.5·views_n + 0.3·engagement_n + 0.2·contributions_n     -- [0, 1]
```

**Final score**, with null-safe two-sided clamps so the range is guaranteed:

```text
base_popularity_n = clamp(coalesce(popularity_score, 0), 0, 1000) / 1000
geo_n             = clamp(coalesce(geographic_boost, 0), 0, 1)
seasonal_n        = clamp(coalesce(seasonal_boost, 0), 0, 1)
age_factor        = 1.2 if entity < 7 d, 1.1 if < 30 d, else 1.0        -- never NULL
score = (0.3·base_popularity_n + 0.4·velocity + 0.15·geo_n + 0.15·seasonal_n) × age_factor
```

Range **[0, 1.2]**.

**`popularity_score` provenance — audited.** `entities.popularity_score` is NULL for all 353 rows
and no migration or routine writes it, so no legacy standalone-recommendation value can reach
trending through it. `base_popularity_n` is therefore 0 in practice until a later phase defines
popularity from modern sources. `geographic_boost` and `seasonal_boost` are likewise unpopulated
(default 0) and **stay frozen at 0**: populating them requires another contract review, because they
would otherwise contribute 30% of the score without any definition.

**Candidate selection (explicit).** Items with any view, engagement, review, qualifying timeline
update or entity-linked post in the last 24 h, **union** items whose stored score is non-zero (so
decay is recorded, and such items are recomputed until they reach their true no-activity value).
No full-table scan.

**Sparse data:** no activity in 24 h → velocity 0; with all boosts 0 the score is 0 and the item
simply does not trend. Not an error.

**Privacy:** reads only public published reviews/posts and public interaction rows; private/Circle
activity never counts.

## 3. Influence — `calculate_social_influence_score(user, category)`

Category-specific, in [0, 1]. **No term reads any rating value.** Two authors with identical reach,
volume and engagement score identically whether they average 1.0 or 5.0 rings.

**Category domain: the 15 canonical entity types** (`src/services/entityType.ts`) — not the
five-bucket search/filter projection, not the legacy `recommendation_category` enum. A review's
category is its subject item's canonical type; a post's categories are the canonical types of its
linked items. Per-category influence is deliberately **not additive** across categories: a post
spanning three types contributes in all three. Posts with no linked entity contribute to no category.

**The credited set is defined once, and both the volume and engagement terms use exactly it.**
For a given author and category it contains:

- one row per `(author, entity)` for the author's canonical published review of that entity; and
- one row per `(author, entity)` for the author's **earliest eligible** entity-linked post about that
  entity.

So a post linked to three product entities yields three rows in `product` (one per entity), and ten
posts about one entity yield one row. Both terms then read:

```text
reach       = min(followers, 1000) / 1000 × 0.35
volume      = min(|credited set|, 100) / 100 × 0.35
engagement  = min(total likes on the credited set / |credited set|, 50) / 50 × 0.30
score       = clamp(reach + volume + engagement, 0, 1)
```

The engagement numerator counts likes **only on the exact content selected into the credited set**,
excluding likes by the content's own author; the denominator is `|credited set|`, and credited rows
with zero likes stay in it. Ten posts about one item can therefore inflate neither the volume nor
the like average. `|credited set| = 0` → volume and engagement are 0 (never a division error).

**Multi-entity engagement is content-deduped (explicit, not an artefact of SQL `IN` semantics).**
A post linked to three items of the same canonical type produces **three** credited rows for volume,
but the likes on that one underlying post are counted **once** for the type — not once per credited
`(post, entity)` row. So a post with 6 likes linked to three products gives `credited_set_size = 3`,
`credited_likes = 6`, `avg_likes = 2`. This is what the frozen fixture
`infl-multi-entity-post-attribution` already asserts, and it is the intended product rule: tagging
more items can never multiply received engagement. The accepted side-effect is that a multi-item post
dilutes the like average relative to separate posts; that is deliberate, since the multi-item credit
is already rewarded in the volume term.

**Category domain is DB-enforced.** `canonical_type` is the Postgres `public.entity_type` enum,
verified live to contain exactly the 15 canonical labels
(`book, movie, place, product, food, tv_show, course, app, game, experience, brand, event, service,
professional, others`), so no extra CHECK constraint is required to enforce the 15-type rule.


**Sparse data:** a brand-new user scores 0. Never negative; clamped [0, 1].

**Explicitly not included:** consensus calibration / judgment quality — Influence v2, separate
experiment.

## 4. Reputation — `calculate_user_reputation(user)`

Integer, [0, 1000], base 100.

- **Eligible contributions** (distinct records the author created, using the table-specific
  predicates in §0): published canonical reviews (one per item), published non-deleted posts,
  created non-deleted entities. Draft, private and deleted records do not count. Old standalone
  records are excluded. **+5 each.**
- **Flag accuracy:** `helpful_flags_count × 3` from `user_reputation`.
- **Quality bonus:** reserved, currently 0.
- `final = clamp(100 + contributions + flag_accuracy, 0, 1000)` — the upper clamp is tested.
- **Negative reviews are real contributions and are never penalised.** Rating value plays no part.

## 5. Who-to-follow — `get_who_to_follow(user, limit)`

**Candidate sources are discovery only.** Three sources build one pool:

1. **fof** — followed by people the viewer follows;
2. **active** — posted or reviewed in the last 7 days;
3. **fresh** — joined in the last 14 days.

After deduplication, **every feature is computed for every candidate**, regardless of which source
found them. Exclusions: the viewer themself, anyone already followed, anyone shown to this viewer in
the last **7 days** (`suggestion_impressions`).

```text
mutual_component  = mutuals / max(1, max mutuals across candidates)
activity_component= min(activity_7d, 10) / 10        -- posts + public published canonical reviews
profile_quality   = (has_username + has_avatar) / 2  -- 0, 0.5 or 1
score = 0.6·mutual_component + 0.3·activity_component + 0.1·profile_quality
```

Tie-break: `score DESC, user id ASC`. When a candidate belongs to several sources the **reason
follows a frozen priority: fof > active > fresh**, so the explanation is as deterministic as the
ranking.

## 6. Personalised items — `get_personalized_entities(user, limit)`

**Candidate pool:** all non-deleted items, **excluding items the viewer has already reviewed or
saved**.

Every term is null-safe and two-sided clamped, so [0, 1] is guaranteed rather than assumed:

```text
interest_n = clamp(coalesce(interest_score, 0), 0, 5) / 5
social_n   = clamp(coalesce(distinct followed reviewers in 30 d, 0), 0, 5) / 5
trending_n = clamp(coalesce(stored trending score, 0), 0, 1.2) / 1.2
score      = clamp(0.5·interest_n + 0.3·social_n + 0.2·trending_n, 0, 1)
```

`social_n` counts **distinct followed people** with a canonical public or Circle-visible-to-viewer
review of the item in the last 30 days (viewer-specific surface), capped at 5.

**Tie-break:** `score DESC, trending_n DESC, item id ASC` — stable across calls, so pagination cannot
shuffle. **Reason:** interests > follow activity > trending. **Sparse user:** no interests and no
follow activity → ranking is purely `0.2·trending_n`, reason "Trending now".

## 7. Similarity — `calculate_user_similarity(a, b)`

- **Input:** effective ratings from each user's **public published canonical** reviews, inner-joined
  on entity. Circle-visible reviews are *not* used: similarity results surface globally.
- **Core statistic:** Pearson correlation over shared entities, mapped `(r + 1) / 2` into [0, 1].
- **Insufficient evidence:** fewer than **3 shared entities → NULL** (not 0; 0 must remain a real
  value consumers can distinguish from "no data").
- **Zero variance:** if either side's shared ratings are all identical (Pearson undefined),
  similarity is `1 − mean(|aᵢ − bᵢ|) / 4`. This measures rating-level proximity, not pattern
  correlation — an acknowledged v1 approximation; a discrimination penalty is a later proposal.
- **Overlap confidence:** for 3–4 shared entities, `confidence = shared / 5`; for ≥ 5, 1.0.
  `final = adjusted_similarity × confidence`, clamped [0, 1].
- **Output:** [0, 1] or NULL. Callers must preserve NULL — `result || 0` and `result ?? 0` are
  forbidden.

## 8. Deployment cutover — no mixed-version window

- **Trending:** the routine install and the full recompute of every stored score happen in **one
  transaction**, and every reader — old or new — clamps `stored` to [0, 1.2]. Because all boost
  inputs are 0 today, old-scale values only ever existed as velocity output; the recompute removes
  them before any normalised reader runs.
- **Influence:** `social_influence_scores` rows on the legacy category domain are **deleted in the
  same transaction** that installs the routine, then recomputed on canonical types. No stale row
  survives to be mixed with new ones.
- **Similarity:** the routine and every caller migrate as one unit in 4.2B.3; the `|| 0` / `?? 0`
  check is part of that step's definition of done.
- **Boosts stay frozen at 0** until a later contract version defines them.
- **Every routine records the contract version it implements** as a comment in its body, so an audit
  can tell a v2 routine from a v1 one without reading the maths.

## 9. What changed from v1, and what this contract still does not change

Corrections in v2:

1. **Influence** — the `avg rating / 5` term is removed entirely (it was a positivity reward however
   labelled); weights are now reach 0.35 / volume 0.35 / engagement 0.30, and one credited set feeds
   both volume and engagement, with per-`(author, entity)` post credit as the anti-spam rule.
2. **Trending** — components are normalised before weighting; contributions include entity-linked
   posts and qualifying timeline updates; anonymous views are capped in aggregate; the engagement cap
   is per actor **per item**; all inputs are null-safe two-sided clamped; candidate selection is
   defined; `popularity_score` provenance is audited.
3. **Personalised items** — all three terms normalised, null-safe and clamped; deterministic
   tie-break.
4. **Who-to-follow** — sources are discovery only; every feature is computed for every candidate;
   reason priority frozen.
5. **Shared rules** — `reviews.is_deleted` (which does not exist) replaced by `status`/`visibility`;
   post-to-entity linkage normalised across both representations; self-activity narrowed to
   self-likes; category domain fixed to the 15 canonical types.

Unchanged intentions:

- No routine is altered by this document. 4.2B.2 migrates bodies to these rules; 4.2B.3 migrates
  client pipelines as complete units.
- No production legacy rows are deleted; 4.2B.4 proves independence with transaction-scoped fixtures.
- Consensus calibration, quality bonuses in reputation, and any new signal are future proposals.
