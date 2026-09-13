# 4.2B.3 consumer cutover — revision 3 (final)

Both corrections are accepted and are real, not cosmetic. Endorsement eligibility is the stored
recommendation flag on the canonical review — not a re-inspection of the questionnaire or timeline
answer, which would quietly rebuild resolution logic in two more services. And "visible to the
requester" was too loose: similarity must stay on the public population so a cached, globally reused
number can't be influenced by private activity.

Also settled by measurement: the 21 influence rows run 0.0039 to **0.0637** (average 0.0135), so
carrying the old 0.3 cutoff over would have emptied the social surface.

4.2B.2 stands as complete. Nothing else in the approved rollout changes.

## Frozen endorsement eligibility

Every endorsement-shaped read becomes:

```text
canonical eligible review  AND  reviews.is_recommended = true
```

The collaborative and social services **never** inspect questionnaire answers or timeline intent
themselves. The stored flag already resolves latest timeline intent → original questionnaire answer →
rating inference per the frozen contract; provenance may explain *why* an endorsement exists, but never
decides eligibility.

| Old read meant | Frozen replacement |
|---|---|
| things similar people recommend | canonical eligible review with `is_recommended = true`; effective rating may affect ordering |
| viewer-endorsed item seeds | viewer's canonical eligible review with `is_recommended = true` |
| co-endorsers of those items | canonical eligible review with `is_recommended = true` |
| influencer recommendations | canonical eligible review with `is_recommended = true` |
| extended-network recommendations (old `>= 4.5`) | `is_recommended = true`; higher effective rating merely ranks higher — never an eligibility gate |
| community recommendations | canonical eligible review with `is_recommended = true` |
| taste overlap / who to compare against | canonical eligible reviews, **all** effective ratings, low and high alike |
| viewer exclusions | any canonical review by the viewer for that item |
| a person's categories | canonical item types from their eligible reviews |

## Frozen visibility matrix (was ambiguous, now separated)

| Population | Visibility rule | Why |
|---|---|---|
| Similarity between people (`calculate_user_similarity_v2`) and any overlap set feeding it | **public published canonical reviews only** | globally reusable and cacheable; private or Circle-only activity must never move it |
| Collaborative candidate discovery and the set of people tested for similarity | **public published canonical reviews only** — same population as similarity | otherwise the client's candidate set can't reproduce a cached similarity result, and private activity would leak into "people like you" |
| Viewer-specific social surfaces (influencer / extended-network / community lists) | reviews the viewer is authorised to see, including Circle-visible ones under the established Circle rule | these are rendered for one viewer and never cached globally |
| The viewer's own exclusion set | all of the viewer's own reviews, any visibility | it is their own data |

## Frozen influence eligibility

No absolute cutoff. Eligible influencers are those with a stored v2 score `> 0`, ranked by score
descending then id, and each surface takes its top N. Influence keeps weighting social proof; it no
longer decides whether the surface exists. The measured distribution above is recorded in the cutover
document, and remeasured after the first scheduled refresh (a note, not a blocker).

## Frozen trending rules (unchanged, already approved)

Rank by the new value, never gate a surface on it: the `>= 5` discovery cut is removed in favour of
ordering by the new value, then recency, then id; the fallback "trending" buckets use "new value > 0"
for bucket membership only, with the remaining buckets filling the surface when empty; every blended
score uses `new value / 1.2` with existing weights untouched.

## Pipelines, in order, each verified before the next

1. **Trending** — apply the rules above across discovery, fallback suggestions, explore, search ranking
   and personalisation; the trending endpoint switches to the incremental v2 orchestrator; the server
   job is scheduled and the browser 30-minute timer plus its production auto-start are deleted.
2. **Similarity + the complete collaborative pipeline** — new similarity routine with `|| 0` / `?? 0`
   removed ("not comparable" never becomes zero), and every legacy read replaced per the two tables
   above, on the public population.
3. **Influence + the complete social pipeline** — client read-only against the new store on canonical
   item types with the `> 0` rule; every legacy read replaced per the tables, on the viewer-authorised
   population; refresh endpoint scheduled through the vault-backed job.
4. **Who-to-follow** — switches to the new routine (same output shape, UI unchanged).
5. **Reputation and personalised items** — verified no live callers, recorded as no-ops.
   `get_personalized_entities_v2` has zero callers; the personalisation service is live but only
   consumes the *trending* value through its own path.

## Verification before 4.2B.3 is marked done

Endorsement fixtures, proving consumers use the stored flag rather than reimplementing resolution:

- low rating + explicit yes → included
- high rating + explicit no → excluded
- high rating, no explicit choice, rating-inferred true → included
- timeline "base on rating" + high rating → included
- timeline "base on rating" + low rating → excluded

Plus:

- Visibility fixtures: a Circle-only review moves a viewer-specific social list but does **not** move
  similarity or the collaborative candidate set.
- Each surface exercised after its own step and shown non-empty where it was non-empty before,
  including the influence surface under the `> 0` rule.
- Scheduling acceptance criterion: **after deployment, exactly one server scheduler exists per job and
  no browser scheduler exists** (measured).
- No browser code writes the influence store; one scheduled run reconciles it as expected.
- Zero legacy-record reads left in the collaborative and social scoring, candidate, exclusion, ranking
  and social-proof paths. Legacy record *listing* in search and item pages stays 4.3.
- No secret value in migrations, SQL, source or docs — only the vault entry name.
- Full test suite, typecheck, production build; write
  `docs/verification/phase-4-2b3-consumer-cutover.md` with all three frozen tables, the influence
  distribution and the no-caller notes; tick 4.2B.3. Nothing dropped — retirement stays 4.2B.4.

## Technical notes

- Files: `discoveryService.ts`, `fallbackRecommendationService.ts`, `enhancedExploreService.ts`,
  `advancedPersonalizationService.ts`, `searchRanking.ts`, `collaborativeFilteringService.ts`,
  `socialIntelligenceService.ts`, `userRecommendationService.ts`, `backgroundService.ts`, Edge
  Functions `update-trending-scores` and `calculate-lifestyle-similarity`.
- Endorsement source is the DB-owned `reviews.is_recommended`; `recommendationResolver.ts` stays a
  display mirror and is not used for eligibility.
- Canonical eligible review = one current review per person per item (`created_at DESC NULLS LAST,
  id DESC`), published, with effective rating `COALESCE(latest_rating, rating)`; visibility per the
  matrix above.
- Scheduling is a tracked migration using guarded `cron.unschedule` + `cron.schedule` with
  `net.http_post`, the header read via `vault.decrypted_secrets` by name — matching the existing
  cleanup jobs.
- `trending_score_v2` is `NOT NULL DEFAULT 0`; normalisation divisor is the contract bound 1.2.
- roadmap.md gains, as explicit 4.2B.3 sub-tasks: the endorsement eligibility rule, the visibility
  matrix, the frozen trending and influence rules, and the collaborative/social candidate migration;
  with a note that legacy record listing remains 4.3.
