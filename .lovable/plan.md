# 4.2B.3 audit result, then 4.2B.4 proof gate and v1 retirement

## Audit of 4.2B.3 — complete, with three residues that belong to 4.2B.4

Verified directly:

- No source file (outside generated database types) calls any v1 routine: similarity, who-to-follow,
  personalised items, reputation, trending scorer/orchestrator, or the v1 influence table. Only the v2
  routines are called.
- Schedulers: exactly one influence job (`refresh-social-influence-v2-daily`, `12 4 * * *`) and one
  trending scheduler (the daily GitHub workflow calling the trending function, which invokes the v2
  orchestrator). No browser scheduler and no browser writer of either score.
- Trending readers all order by the v2 value with deterministic tie-breaks; the fallback pool is
  fetched once, widened, and shared across buckets; the "trending" bucket uses "greater than zero" for
  membership only.
- Similarity/collaborative use the public canonical routine, endorsement via the stored flag, and no
  zero-coercion of a missing similarity value. Social surfaces use the viewer-scoped routine.
- Verification record and roadmap tick are in place.

Three legacy reads remain, none of them in a path 4.2B.3 switched, all correctly in scope for the
sweep below rather than something silently missed:

1. **Entity quality scoring** — the discovery quality scorer computes ratings, spam, relevance and
   social proof from legacy recommendation rows and their likes. Its writer has no caller, so the
   quality table is stale and the surface that reads it falls back to neutral defaults.
2. **Circle recommendation routines for the entity page** — the "does my circle recommend this"
   check and its list routine still read legacy rows and still use the old `rating >= 3` / `>= 4`
   cutoffs. These feed the v4 entity page, which is off-limits by standing decision.
3. **Two entity-stats refreshers coexist** — the v1 view refresher and the v2 materialized-view
   refresher both run hourly.

## 4.2B.4 — dependency proof gate, then retire v1

Nothing is dropped until the gate passes. Order is: prove, then decide, then retire, then verify.

### Step 1 — the proof gate (evidence only, no changes)

For every v1 artefact, record who references it, from where, and whether that reference is live:

- v1 routines: trending scorer, enhanced trending scorer, trending orchestrator, similarity,
  who-to-follow, personalised items, reputation, influence calculator and its refresh path.
- v1 storage: the v1 trending column, the v1 influence table, the v1 entity-stats view and its
  refresher, the quality-score table.
- The three residues above.

Evidence per artefact: source references, database references (other routine bodies, triggers,
policies, indexes, views, scheduled jobs), and live row/usage counts. An artefact is retirable only
when it has zero live references or its only references are themselves being retired in this step.

Known dependency to resolve first: the trending-hashtags routine references the v1 trending scorer.
Inspect it and choose one — point it at the v2 value, or confirm the reference is dead code and drop
it with the routine.

### Step 2 — decide each residue explicitly

- **Quality scoring:** retire the legacy-fed scorer and the reader's dependence on it. The surface
  keeps working on its existing neutral-default path; no new scoring is introduced in this phase.
- **Circle routines for the entity page:** rebuild them on canonical reviews and the stored
  endorsement flag, keeping the exact same call signature and result shape so the v4 page is not
  edited. No rating cutoff — endorsement is the gate, effective rating only ranks.
- **Entity stats:** keep the v2 refresher, remove the v1 refresher and the v1 view once the gate shows
  no reader.

### Step 3 — old-threshold sweep

Remove every remaining absolute cutoff carried over from v1 scoring (`>= 3`, `>= 4`, `>= 4.5`,
`>= 5`, `> 0.3`, `> 0.6`) in scoring, candidate, ranking and social-proof paths. Ordering replaces
gating; "trending"-labelled buckets keep membership-only rules.

### Step 4 — retire

One migration family per artefact group, each dropping only what the gate proved unreferenced: v1
routines, the v1 trending column, the v1 influence table, the v1 stats view and its job, the
quality-score table. Regenerate generated database types once, at the end.

### Step 5 — verification

- Re-run the reference sweep and show zero references to every dropped artefact.
- Every switched surface exercised and still returning sensible results: discovery, explore, search
  ranking, personalisation, collaborative, social, who-to-follow, entity page circle block, quality
  new-this-week.
- Scheduler count re-measured: one trending, one influence, one entity-stats.
- Full test suite, typecheck and production build pass.
- Write `docs/verification/phase-4-2b4-v1-retirement.md` with the gate table, the threshold sweep,
  the residue decisions and the dropped-artefact list; tick 4.2B.4.

## Explicitly out of scope

Legacy recommendation *listing and display* — profile service, entity page legacy section, feed hook,
notification targets, content viewer, the `/recommendations/:id` route — plus clearing the two
conversion fields on reviews, stay 4.3. The recommendation tables and enum drop stays 4.5. Consensus
calibration of influence remains a separate experiment.

## Technical notes

- Retirement migrations use the established pattern: explicit owner, revoke-then-grant, one family per
  migration, guarded `cron.unschedule`.
- Rebuilt circle routines follow the v2 conventions: `SECURITY DEFINER`, pinned search path, viewer
  identity enforced server-side, canonical selection (one current review per person per item,
  `created_at DESC NULLS LAST, id DESC`) before the endorsement flag, then effective rating
  `COALESCE(latest_rating, rating)`, then any cap.
- Return shapes for the rebuilt routines must remain a superset of today's, so no v4 file changes.
