# 4.2B.3 audit result, then 4.2B.4 proof gate and v1 retirement (revision 2)

Both reviews are right, and one of them corrects a factual error in my first draft. Verified now: the
two old Circle routines (`has_network_recommendations`, `get_network_entity_recommendations`) have
**no caller anywhere** — the only references are their own unused service wrappers. The active v4 path
goes through the aggregated discovery routine, which was already migrated in 4.2A. So they are dead
code to retire after proof, not contracts to rebuild. That removes the migration risk entirely.

Both safeguards are accepted: the threshold sweep becomes a semantic audit, and physical drops stop on
any unexpected dependency, never `CASCADE`.

## Audit of 4.2B.3 — complete

Verified directly:

- No source file (outside generated database types) calls any v1 routine: similarity, who-to-follow,
  personalised items, reputation, trending scorer/orchestrator, or the v1 influence table.
- Schedulers: exactly one influence job (`refresh-social-influence-v2-daily`, `12 4 * * *`) and one
  trending scheduler (the daily workflow calling the trending function → v2 orchestrator). No browser
  scheduler and no browser writer of either score.
- Trending readers order by the v2 value with deterministic tie-breaks; the fallback pool is fetched
  once, widened and shared; the "trending" bucket uses greater-than-zero for membership only.
- Similarity/collaborative use the public canonical routine and the stored endorsement flag, with no
  zero-coercion of a missing similarity. Social surfaces use the viewer-scoped routine.
- Verification record and roadmap tick in place.

Three residues remain, none in a path B3 switched, all handled below:

1. **Stale quality scoring** — the discovery quality scorer computes ratings/spam/relevance/social
   proof from legacy recommendation rows and their likes. Its writer has no caller, so the table is
   stale and the reading surface already falls back to neutral defaults.
2. **Dead Circle routines** — the two routines above still read legacy rows with `rating >= 3` / `>= 4`
   cutoffs, but have zero callers.
3. **Two entity-stats refreshers coexist** — the v1 view refresher and the v2 materialized-view
   refresher both run hourly.

## 4.2B.4 — dependency proof gate, then retire v1

Nothing is dropped until the gate passes. Prove, classify, retire, verify.

### Step 1 — the proof gate (evidence only, no changes)

Build one artefact/dependency table covering every v1 artefact: trending scorer, enhanced trending
scorer, trending orchestrator, similarity, who-to-follow, personalised items, reputation, influence
calculator and its refresh path, the v1 trending column, the v1 influence table, the v1 stats view and
its job, the quality-score table, and the two dead Circle routines.

Each row records, with evidence: live source callers, database references (routine bodies, triggers,
policies, indexes, views), scheduler references, and any required historical or display dependency.
An artefact is retirable only when all four are zero, or its only references are themselves being
retired in the same step. **Publish this table before authoring any drop migration.**

Resolve first: the trending-hashtags routine references the v1 trending scorer. Either point it at the
v2 value or prove the whole routine is dead and retire both together. No drop of the v1 scorer before
that is settled.

### Step 2 — decide each residue

- **Quality scoring:** retire reader dependence and the legacy-fed writer together, once the gate
  confirms the surface's neutral-default behaviour is unaffected. No new scoring introduced here.
- **Dead Circle routines:** retire the routines and their unused service wrappers. No rebuild, no
  additive replacement, no change to the v4 page or to the aggregated routine it uses. If the gate
  ever finds a live caller, the routine stops being a retirement candidate and gets an additive,
  exactly-compatible replacement instead — that is the only path that touches a live contract.
- **Entity stats:** keep the v2 refresher; retire the v1 refresher and view only after zero readers is
  proven.

### Step 3 — semantic threshold audit (not a numeric sweep)

Enumerate every remaining old cutoff (`>= 3`, `>= 3.5`, `>= 4`, `>= 4.5`, `>= 5`, `> 0.3`, `> 0.6`)
in scoring, candidate, ranking and social-proof paths and record, per occurrence, what it *means*:

| Meaning | Action |
|---|---|
| rating standing in for "recommended" | remove; use the stored endorsement flag |
| trending value used as an existence gate | remove; v2 ordering replaces it |
| influence value used as an existence gate | remove; greater-than-zero eligibility already applies |
| a genuine rating/quality/confidence product rule | keep, documented as intentional |
| labelled-bucket membership (`trending_score_v2 > 0`) | keep; approved classification rule |

Explicitly flagged for a decision rather than automatic removal: the network service's 3.5
average-rating quality filter, applied *after* results are already endorsed. Two honest options —
keep it as an explicit quality bar, or drop it so every explicit endorsement qualifies. I'll present
the count of items it currently removes and recommend one; it is a product call, not a cleanup.

### Step 4 — retire

One migration family per artefact group, dropping only what the table proved unreferenced. **No
`CASCADE` anywhere.** If Postgres reports a remaining dependency, that artefact's retirement stops and
the dependency is investigated and recorded as new evidence — never worked around. Regenerate
generated database types once, after the final migration.

### Step 5 — verification

- Re-run the reference sweep: zero references to every dropped artefact.
- Exercise every switched surface and confirm sensible results: discovery, explore, search ranking,
  personalisation, collaborative, social, who-to-follow, the v4 entity page Circle block, quality
  new-this-week.
- Re-measure schedulers: one trending, one influence, one entity-stats.
- Full test suite, typecheck and production build pass.
- Write `docs/verification/phase-4-2b4-v1-retirement.md` with the artefact/dependency table, the
  semantic threshold table, the residue decisions, the dead-routine reclassification and the dropped
  list; tick 4.2B.4 in roadmap.md, adding these B4 sub-tasks: proof table, threshold audit,
  hashtags-dependency resolution, dead-Circle retirement, stats-refresher consolidation. Stop before
  4.3.

## Explicitly out of scope

Legacy recommendation listing and display — profile service, entity page legacy section, feed hook,
notification targets, content viewer, the `/recommendations/:id` route — plus clearing the two
conversion fields on reviews, stay 4.3. Table and enum drops stay 4.5. Consensus calibration of
influence remains a separate experiment.

## Technical notes

- Retirement migrations use the established pattern: explicit owner, revoke-then-grant where relevant,
  one family per migration, guarded `cron.unschedule`, no `CASCADE`.
- Both `has_network_recommendations` overloads exist; the proof table treats each overload as its own
  artefact so neither is dropped on the other's evidence.
- Any replacement routine (only if a live caller appears) must be additive with an exactly compatible
  signature and output columns; superset shapes are not treated as compatible.
