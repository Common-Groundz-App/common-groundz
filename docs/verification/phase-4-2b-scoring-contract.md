# Phase 4.2B.1 — scoring contract (version 1)

**Status: frozen for review. Nothing here is implemented yet.** This document is the approval
gate for 4.2B.2 (routine bodies) and 4.2B.3 (client pipelines). Every number below is a decision,
not a placeholder. Fixtures with expected intermediate and final values live in
`phase-4-2b-scoring-fixtures.json` (`contractVersion: 1`), which is versioned together with this
document — change one, change both.

Companion machine-readable file: `docs/verification/phase-4-2b-scoring-fixtures.json`.

---

## 0. Shared rules (apply to every signal)

**Canonical review selection.** Unless a signal says otherwise, "reviews" means: one current row
per `(user_id, entity_id)` chosen by `created_at DESC NULLS LAST, id DESC`, `is_deleted = false`.
Effective rating = `COALESCE(latest timeline rating, original rating)`.

**Eligibility follows the surface, not one global rule.**

| Surface | Eligible input |
|---|---|
| Public / global signals | current **public published** canonical reviews |
| Viewer-specific / Circle signals | current canonical reviews **that viewer is authorised to see** under the established rule (own + public + Circle of followed) |
| Private reviews | never contribute outside owner-only logic; never enter any global aggregate |

**Counting unit is per signal, never globally.**

| Metric kind | Unit |
|---|---|
| Endorsement / population metrics | distinct people |
| An item's rating population | distinct reviewing people |
| A person's contribution volume | distinct items they reviewed |
| Trending contributions | eligible contributions in the window, deduped, per-person cap |
| Engagement | distinct eligible interaction events, capped per actor |
| Reputation volume | the author's own eligible reviews/posts (author is already one person) |

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

## 1. Trending — `calculate_enhanced_trending_score(entity)`

The plain `calculate_trending_score` is retired; the enhanced routine is the single trending
calculation, used for both per-item scoring and candidate selection.

- **Windows:** views 24 h; contributions 24 h; engagement 24 h. Entity-age boost tiers at 7 and
  30 days.
- **Signals and units:**
  - views: rows in `entity_views` in the window, capped at **20 per distinct viewer** (null-viewer
    rows count raw);
  - contributions: canonical public published reviews created in the window, **max 2 per person**
    (a third same-day review by one person adds nothing);
  - engagement: distinct review-like and post-like events on the item's own content in the
    window, **max 5 per actor**.
- **Velocity:** `velocity = 0.5·views + 0.3·engagement + 0.2·contributions` (unchanged weights;
  the caps above are the normalisation that makes them comparable).
- **Final:** `score = (0.3·base_popularity + 0.4·velocity + 0.15·geographic_boost +
  0.15·seasonal_boost) × age_factor`, where `age_factor` = 1.2 if entity < 7 days old, 1.1 if
  < 30 days, else 1.0. Boosts default to 0. Score is unbounded ≥ 0.
- **Candidate selection:** the same score, same windows — no separate candidate query.
- **Sparse data:** no activity in 24 h → velocity 0; score is just the weighted boosts; an item
  with no boosts scores 0 and simply does not trend. Not an error.
- **Privacy:** reads only public published reviews and public interaction rows; private/Circle
  activity never counts.

## 2. Similarity — `calculate_user_similarity(a, b)`

- **Input:** effective ratings from each user's **public published canonical** reviews, inner-joined
  on entity. Circle-visible reviews are *not* used: similarity results surface globally.
- **Core statistic:** Pearson correlation over shared entities.
- **Insufficient evidence:** fewer than **3 shared entities → NULL** (not 0; 0 must remain a real
  value consumers can distinguish from "no data"). Consumers treat NULL as "no similarity signal".
- **Zero variance:** if either side's shared ratings are all identical (Pearson undefined),
  similarity is computed from mean absolute rating difference instead:
  `1 − mean(|aᵢ − bᵢ|) / 4`.
- **Overlap confidence:** for 3–4 shared entities, `confidence = shared / 5`; for ≥ 5, 1.0.
  `final = adjusted_similarity × confidence`, clamped to [0, 1]. (Pearson is mapped
  `(r + 1) / 2` into [0, 1] before confidence is applied.)
- **Output range:** [0, 1] or NULL. Stored rows with NULL are allowed; consumers must handle both.

## 3. Influence — `calculate_social_influence_score(user, category)`

Category-specific, in [0, 1]. Weights unchanged; inputs move to canonical public published
reviews:

- **Reach:** `min(followers, 1000) / 1000 × 0.3`
- **Rating quality:** `avg effective rating over the user's canonical public published reviews in
  the category / 5 × 0.3` (includes "no" reviews — taste quality, not positivity)
- **Activity:** `min(distinct items reviewed in the category, 100) / 100 × 0.2`
- **Engagement:** likes received on the author's reviews and posts **in that category**, per
  distinct actor; `min(avg likes per contribution, 50) / 50 × 0.2`
- **Sparse data:** no reviews in the category → rating-quality and activity terms are 0, the
  score is whatever reach/engagement give; a brand-new user scores near 0. Not an error, never
  negative; clamped [0, 1].
- **Explicitly not included:** consensus calibration (agreement with the crowd) — separate
  experiment, not in this contract.

## 4. Reputation — `calculate_user_reputation(user)`

Integer, [0, 1000], base 100.

- **Eligible contributions (distinct items/records the author created, not deleted):**
  published reviews (canonical — one per item), posts, created entities. Old standalone records
  are excluded. **+5 each.**
- **Flag accuracy:** `helpful_flags_count × 3` from `user_reputation`.
- **Quality bonus:** reserved, currently 0 (no quality term exists today; adding one is a new
  proposal, not this migration).
- `final = clamp(100 + contributions + flag_accuracy, 0, 1000)`.
- **Negative reviews are real contributions and are never penalised.** Rating value plays no
  part in reputation.

## 5. Who-to-follow — `get_who_to_follow(user, limit)`

Three candidate sources, in priority order, each excluding: the viewer themself, anyone already
followed, candidates of earlier sources, and anyone shown to this viewer in the last **7 days**
(`suggestion_impressions`).

1. **fof** — followed by people the viewer follows; carries `mutual_count`.
2. **active** — posted or reviewed in the last 7 days; carries `activity_7d` (posts + public
   published canonical reviews, capped at **10 per candidate** for scoring).
3. **fresh** — joined in the last 14 days.

**Score:** `0.6 × mutual_component + 0.3 × activity_component + 0.1 × profile_quality`, where
`mutual_component = mutuals / max(1, max mutuals across candidates)`,
`activity_component = min(activity_7d, 10) / 10`, and
`profile_quality = (has_username + has_avatar) / 2` (0, 0.5 or 1).
Tie-break: score DESC, then user id ASC. Reason strings unchanged.

## 6. Personalised items — `get_personalized_entities(user, limit)`

- **Candidate pool:** all non-deleted items, **excluding items the viewer has already reviewed
  or saved**.
- **Score:** `interest_score (0 if none) + 0.1 × follow_activity + 0.2 × trending_score`, where
  `follow_activity` = number of **distinct followed people** with a canonical public or
  Circle-visible-to-viewer review of the item in the last **30 days** (viewer-specific surface:
  Circle-visible reviews count here, capped at **5 people** per item).
- **Reason:** interests > follow activity > trending, as today.
- **Sparse-user fallback:** no interests and no follow activity → ranking is purely
  `0.2 × trending_score`, reason "Trending now".

---

## 7. What this contract deliberately does not change

- No routine is altered by this document. 4.2B.2 migrates bodies to these rules; 4.2B.3 migrates
  client pipelines as complete units.
- No production legacy rows are deleted; 4.2B.4 proves independence with transaction-scoped
  fixtures.
- Consensus calibration, quality bonuses in reputation, and any new signal are future proposals.
