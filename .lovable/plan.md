# 4.2B.3 consumer cutover — revised after review

Both reviews are right, and I checked their claims against the project rather than accepting them.
4.2B.2 stands as complete (all six score families live with the frozen access rules, new trending
value on 329 live items, 21 bootstrapped influence rows across 7 canonical types, refresh endpoint
deployed and deliberately unscheduled, nothing reading v2 yet). Three changes to B3, plus two
additions of my own.

## What the reviews got right (verified)

- **Legacy record reads really are inside the pipelines B3 migrates.** Confirmed: the collaborative
  pipeline reads the old standalone records in six places for candidate discovery, matching and
  exclusions, and the social-intelligence pipeline reads them for a person's categories, viewer
  exclusions and every candidate list, with old `>= 4` / `>= 4.5` rating cut-offs. Switching only the
  score source would leave "new score, old candidates", and would make a person with modern reviews
  but no legacy record invisible. So candidate discovery in **these two services** moves in B3.
  (Legacy record *listing* in search and item pages still belongs to 4.3 — that is display, not
  scoring.)
- **A literal secret in scheduling SQL is unacceptable**, and the project already has the right
  pattern: existing scheduled jobs read the secret from the encrypted secret store at run time and
  never contain the value. B3 uses that same pattern, added as a tracked migration (idempotent:
  unschedule-if-exists then schedule), not an untracked one-off statement.
- **Thresholds must be frozen before coding**, not written up afterwards. Done below.
- **Personalised items**: `get_personalized_entities_v2` has zero live callers. The personalisation
  service is live but only consumes the *trending* value through its own path — recorded explicitly so
  4.2B.4 isn't confused by it.

## Frozen trending cutover rules (no arithmetic rescaling, no guessed cut points)

Old and new trending values come from different formulas, and every new value is currently 0, so any
positive cut point would empty a surface today. The rule for every reader: **rank by the new value,
never gate a surface's existence on it.**

| Surface | Today | Frozen B3 behaviour |
|---|---|---|
| Discovery "trending" list (`>= 5` cut) | absolute cut then order | cut removed. Order by new value DESC, then the surface's existing secondary order (recency), then id. If no item has a non-zero new value, the list is the secondary order alone — never empty |
| Other discovery / explore lists ordering by trending | order by old value | order by new value DESC, same deterministic tiebreak |
| Fallback suggestions `> 0.5` "trending" bucket | absolute cut | bucket membership becomes "new value > 0"; when nothing qualifies the bucket is skipped and the remaining buckets fill the surface, as they already do when empty |
| Fallback suggestions `> 0.6 && rating < 4.5` split | absolute cut | same rule: `> 0` on the new value, rating condition unchanged |
| Fallback blended score (`+ trending * 0.3`) | raw old value | normalised `new value / 1.2` (so it is 0–1), weight unchanged |
| Search ranking trend term | raw old value | normalised `new value / 1.2`, weight unchanged |
| Personalisation contextual/temporal terms | raw old value | normalised `new value / 1.2`, weights unchanged |

Two consequences stated up front and accepted: while activity is absent, trending contributes 0 to
blended scores (identical to today's behaviour for items with no old score), and trending buckets stay
empty until real 24-hour activity exists — surfaces stay populated through their fallback ordering.

## Pipelines, in order, each verified before the next

1. **Trending** — apply the table above across discovery, fallback suggestions, explore, search
   ranking and personalisation; the trending updater endpoint switches to the v2 orchestrator
   (incremental candidates, not bootstrap); schedule it server-side; **delete the browser 30-minute
   timer and its production auto-start** so a single scheduler exists. Old value and old updater left
   in place.
2. **Similarity** — both callers switch to the new routine with `|| 0` / `?? 0` removed, so "not
   comparable" never collapses to zero; each downstream consumer handles the absent case explicitly.
3. **Collaborative candidate discovery** — the collaborative pipeline's candidate pool, matching set
   and viewer exclusions move from legacy records to canonical published public reviews (effective
   rating, one per person per item), keeping its existing rating intent. Same step as similarity's
   consumer, since they are the same pipeline.
4. **Influence** — the social path becomes read-only against the new store on canonical item types;
   the browser stops computing and writing scores; its 0.3 minimum is re-expressed on the new 0–1
   score; the refresh endpoint is scheduled via the vault-backed job. Its candidate discovery and
   viewer exclusions also move to canonical reviews, with the `>= 4` / `>= 4.5` intent preserved
   against effective ratings.
5. **Who-to-follow** — switches to the new routine (same output shape, UI unchanged).
6. **Reputation and personalised items** — verified no live callers; recorded as no-ops, not skipped
   silently.

## Two additions of mine

- **Deterministic ordering everywhere.** Every switched list gets an explicit final tiebreak on id, so
  the all-zero trending period cannot produce shuffling results between page loads.
- **Guard against double scheduling.** Both scheduled jobs are created with unschedule-then-schedule
  and verified as exactly one job each; the browser timer removal happens in the same step as enabling
  the server job, so there is never a window with two updaters or none.

## Verification before 4.2B.3 is marked done

- Each surface exercised after its own step, proving it is non-empty where it was non-empty before.
- Exactly one trending scheduler and one influence scheduler live; browser timer gone.
- No browser code writes the influence store; a scheduled run reconciles it as expected.
- No similarity consumer collapses "not comparable" to zero.
- Zero legacy-record reads left in the collaborative and social-intelligence *scoring/candidate*
  paths (listing elsewhere still deferred to 4.3, stated as such).
- No secret value in migrations, SQL, source or documents — only the secret's name.
- Full test suite, typecheck, production build; write
  `docs/verification/phase-4-2b3-consumer-cutover.md` recording the frozen table above as implemented,
  plus the personalised-routine zero-caller note; tick 4.2B.3 in the roadmap. Nothing is dropped —
  retirement stays 4.2B.4.

## Technical notes

- Files: `discoveryService.ts`, `fallbackRecommendationService.ts`, `enhancedExploreService.ts`,
  `advancedPersonalizationService.ts`, `searchRanking.ts`, `collaborativeFilteringService.ts`,
  `socialIntelligenceService.ts`, `userRecommendationService.ts`, `backgroundService.ts`, Edge
  Functions `update-trending-scores` and `calculate-lifestyle-similarity`.
- Scheduling migration uses `cron.unschedule` (guarded) + `cron.schedule` with `net.http_post`, the
  header value read via `(select decrypted_secret from vault.decrypted_secrets where name = ...)`,
  matching the existing cleanup jobs. The influence endpoint's secret is already stored; only its
  vault entry name appears in SQL.
- `trending_score_v2` is `NOT NULL DEFAULT 0`, so no null handling on sorts; normalisation divisor is
  the contract bound 1.2.
- roadmap.md gains: the frozen trending mapping as part of 4.2B.3, the collaborative/social candidate
  migration as an explicit 4.2B.3 sub-task, and a note that legacy record *listing* remains 4.3.
