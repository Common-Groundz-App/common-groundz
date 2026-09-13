# 4.2B.3 consumer cutover — revision 2 (endorsement truth + frozen cutoffs)

Both reviews are right on the substance. Rating thresholds must not become a stand-in for endorsement,
and the influence cutoff has to be frozen from measurement, not carried over. I measured it: the 21
influence rows range from 0.0039 to **0.0637** (average 0.0135) — so the existing 0.3 cutoff would wipe
out the social surface entirely. That is now settled below rather than left to implementation.

4.2B.2 stands as complete. Everything the reviews approved is unchanged; three things change.

## Frozen semantics for every legacy-record read (the main fix)

Each legacy read is classified by what it *meant*, and replaced accordingly. Endorsement comes from
the review's explicit recommendation answer; rating is only ever a taste/ordering input.

| Where | Old read meant | Frozen replacement |
|---|---|---|
| Collaborative: viewer's own items, and the pool of people who touched the same items | "people with overlapping history" — taste, not endorsement | canonical eligible reviews, **all** effective ratings (low and high both count) |
| Collaborative: candidate items from similar people (`rating >= 4`) | "things those people recommend" | canonical eligible review with **explicit recommendation = yes**; effective rating only weights the ordering |
| Collaborative: item-based seeds from the viewer (`rating >= 4`) | "items the viewer endorses" | viewer's canonical review with **recommendation = yes** |
| Collaborative: co-endorsers of those items (`rating >= 4`) | "other people who endorse the same items" | canonical review with **recommendation = yes** |
| Collaborative: viewer exclusions | "already covered by the viewer" | any canonical review by the viewer for that item |
| Social: a person's categories | "what they contribute in" | canonical item types from their eligible reviews |
| Social: influencer candidate items (`rating >= 4`) | "what influential people recommend" | canonical review with **recommendation = yes**, ordered by influence and effective rating |
| Social: extended-network candidates (`rating >= 4.5`) | "strongly endorsed further out" | canonical review with **recommendation = yes**; the extra strictness becomes a *ranking* preference (higher effective rating ranks first), not an eligibility gate — a 4.0-rated explicit yes must not be excluded, and a 5.0 explicit "no" must not be included |
| Social: community candidates (`rating >= 4`) | "what the community recommends" | canonical review with **recommendation = yes** |
| Social: viewer exclusions | "already covered by the viewer" | any canonical review by the viewer for that item |

"Canonical eligible review" is the existing frozen definition: one current review per person per item,
published and visible to the requester, with the effective (latest timeline) rating. No rating
threshold is used anywhere as a proxy for endorsement.

## Frozen influence eligibility (measured, not inherited)

- Current v2 distribution: 21 rows, min 0.0039, avg 0.0135, **max 0.0637** — nothing reaches 0.3.
- Frozen rule: **no absolute cutoff.** Eligible influencers are those with a stored score `> 0`,
  ranked by score descending then id, and the surface takes its top N. Influence keeps weighting
  social proof exactly as before; it no longer decides whether the surface exists.
- Recorded in the cutover document with the distribution above, so the decision is auditable.

## Frozen trending rules (unchanged from the approved revision)

Rank by the new value, never gate a surface on it: the `>= 5` discovery cut is removed in favour of
ordering by the new value then recency then id; the fallback "trending" buckets use "new value > 0" as
bucket membership only, with the remaining buckets filling the surface when empty; every blended score
uses `new value / 1.2` with existing weights untouched.

## Pipelines, in order, each verified before the next

1. **Trending** — apply the rules above across discovery, fallback suggestions, explore, search
   ranking and personalisation; the trending endpoint switches to the incremental v2 orchestrator;
   the server job is scheduled and the browser 30-minute timer plus its production auto-start are
   deleted.
2. **Similarity + collaborative pipeline** — the new similarity routine with `|| 0` / `?? 0` removed
   ("not comparable" never becomes zero), *and* every collaborative legacy read replaced per the table.
3. **Influence + social pipeline** — client becomes read-only against the new store on canonical item
   types with the frozen `> 0` rule; every social legacy read replaced per the table; the refresh
   endpoint is scheduled through the vault-backed job.
4. **Who-to-follow** — switches to the new routine (same output shape, UI unchanged).
5. **Reputation and personalised items** — verified no live callers, recorded as no-ops.
   `get_personalized_entities_v2` has zero callers; the personalisation service is live but only
   consumes the *trending* value through its own path.

## Verification before 4.2B.3 is marked done

- Per-read evidence that endorsement-shaped surfaces select on the explicit recommendation answer, and
  a fixture-style check that a low-rated explicit yes is included while a high-rated explicit no is not.
- Each surface exercised after its own step and shown non-empty where it was non-empty before,
  including the influence surface under the frozen `> 0` rule.
- Acceptance criterion for scheduling (wording corrected): **after deployment, exactly one server
  scheduler exists for each job and no browser scheduler exists** — measured, not asserted as a
  zero-gap transition.
- No browser code writes the influence store; one scheduled run reconciles it as expected.
- Zero legacy-record reads left in the collaborative and social **scoring, candidate, exclusion,
  ranking and social-proof** paths. Legacy record *listing* in search and item pages stays 4.3.
- No secret value in migrations, SQL, source or docs — only the secret's vault entry name.
- Full test suite, typecheck, production build; write
  `docs/verification/phase-4-2b3-consumer-cutover.md` with the two frozen tables, the influence
  distribution, and the no-caller notes; tick 4.2B.3. Nothing dropped — retirement stays 4.2B.4.

## Technical notes

- Files: `discoveryService.ts`, `fallbackRecommendationService.ts`, `enhancedExploreService.ts`,
  `advancedPersonalizationService.ts`, `searchRanking.ts`, `collaborativeFilteringService.ts`,
  `socialIntelligenceService.ts`, `userRecommendationService.ts`, `backgroundService.ts`, Edge
  Functions `update-trending-scores` and `calculate-lifestyle-similarity`.
- Endorsement source is `reviews.is_recommended` on the canonical row (explicit questionnaire intent →
  latest timeline intent, per the frozen resolution order); rating thresholds never substitute for it.
- Scheduling is a tracked migration using guarded `cron.unschedule` + `cron.schedule` with
  `net.http_post`, the header read via `vault.decrypted_secrets` by name — matching the existing
  cleanup jobs.
- `trending_score_v2` is `NOT NULL DEFAULT 0`; normalisation divisor is the contract bound 1.2.
- roadmap.md gains, as explicit 4.2B.3 sub-tasks: the endorsement-semantics mapping, the frozen
  trending rules, the frozen influence rule, and the collaborative/social candidate migration; with a
  note that legacy record listing remains 4.3.
