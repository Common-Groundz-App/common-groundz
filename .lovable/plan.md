# 4.2B.4A — proof gate only (no drops, no behaviour change)

I agree with the split, and for the reason both reviews give: the previous plan bundled evidence
gathering, two open decisions and irreversible drops into one run. Two of those steps can't honestly be
automated — whether the trending-hashtags routine migrates or retires depends on evidence I don't have
yet, and the 3.5 average-rating filter changes what people actually see. So this stage produces
evidence and recommendations and then stops. Retirement becomes 4.2B.4B, authorised separately.

The one addition I'd make on top of both reviews: the proof table must record *how* each reference was
found (source search, catalogue query, job list), so the evidence can be re-run and re-checked rather
than trusted. A dependency table without a reproducible method is just an assertion.

## 4.2B.3 — accepted as complete

Verified: no source calls any v1 routine; exactly one trending scheduler and one influence scheduler;
no browser scheduler or writer; trending readers order by the v2 value with deterministic tie-breaks;
similarity/collaborative on the public canonical population with the stored endorsement flag and no
zero-coercion; social surfaces on the viewer-scoped routine. Record and roadmap tick in place.

Also verified, correcting my earlier draft: the two old Circle routines have **zero callers** — the
active v4 page uses the aggregated discovery routine, already migrated in 4.2A. They are dead code to
retire, not contracts to rebuild.

## Deliverables of 4.2B.4A

### 1. The artefact/dependency table

One row per v1 artefact, treating each function overload as its own artefact: trending scorer,
enhanced trending scorer, trending orchestrator, similarity, who-to-follow, personalised items,
reputation, influence calculator and refresh path, the v1 trending column, the v1 influence table, the
v1 stats view and its hourly job, the quality-score table, and both `has_network_recommendations`
overloads plus `get_network_entity_recommendations`.

Every reference is classified, with the search or query that found it:

| Blocking (live) | Non-blocking (historical) |
|---|---|
| application source, Edge Functions | past migration files |
| CI/CD workflows, deployment and operational scripts | verification documents, comments |
| root and `scripts/` maintenance commands, SQL outside `supabase/migrations/`, Supabase configuration | generated database types before regeneration |
| test and setup code that invokes live routines | archived plans |
| database function bodies, views, triggers, policies, indexes, plus the catalogue dependency graph | |
| scheduled jobs | |
| any required display or historical data dependency | |

An artefact is a retirement candidate only when every blocking row is zero. Non-blocking mentions are
recorded and explicitly do not block. The trending scheduler being a CI workflow rather than app code
is exactly why the workflow directory is a blocking surface.


### 2. Reachability of the trending-hashtags routine

Show whether it is live (callers, schedulers, triggers) and what it uses the v1 trending scorer for,
then recommend one: migrate the dependency to the v2 value, or retire the routine together with the
scorer. No change made in this stage; the v1 scorer is not a drop candidate until this is settled.

### 3. Impact measurement of the 3.5 average-rating filter

The network service filters already-endorsed Circle results below a 3.5 average rating. Measure, on
live data, how many currently endorsed results it removes and for how many viewers/entities it empties
the surface. Present keep-versus-remove with that number and a recommendation. Change nothing.

### 4. Semantic threshold audit

Enumerate every remaining old cutoff (`>= 3`, `>= 3.5`, `>= 4`, `>= 4.5`, `>= 5`, `> 0.3`, `> 0.6`) in
scoring, candidate, ranking and social-proof paths and classify each by meaning:

| Meaning | Proposed action (for B4B) |
|---|---|
| rating standing in for "recommended" | remove; use the stored endorsement flag |
| trending or influence value used as an existence gate | remove; ordering / greater-than-zero eligibility replaces it |
| a genuine rating, quality or confidence product rule | keep, documented as intentional |
| labelled-bucket membership (`trending_score_v2 > 0`) | keep; approved classification rule |

No numeric pattern is removed just for being a number.

### 5. The proposed retirement list, plus the residue recommendations

- Stale quality scoring: recommend retiring reader dependence and the legacy-fed writer together,
  with the evidence that the reading surface already falls back to neutral defaults.
- Dead Circle routines and their unused service wrappers: recommend retirement, no rebuild. If the
  proof ever finds a live caller, that artefact leaves the drop list and would need an additive,
  **exactly** compatible replacement — superset shapes are not compatible.
- Entity stats: recommend keeping the v2 refresher and retiring the v1 refresher and view, with the
  zero-reader evidence.

Then stop. Output of this stage: `docs/verification/phase-4-2b4a-proof-gate.md` containing all five
deliverables, plus a roadmap update splitting 4.2B.4 into 4.2B.4A (proof, ticked) and 4.2B.4B
(retirement, open, blocked on approval of the two decisions and the drop list).

## Not in this stage

No `DROP` of any kind, no threshold edits, no filter changes, no type regeneration, no scheduler
changes. Legacy recommendation listing and display, and clearing the two conversion fields on reviews,
stay 4.3; table and enum drops stay 4.5.

## 4.2B.4B — retirement (authorised separately, after review)

For the record, so the boundary is explicit: resolve the hashtags dependency as decided, apply the
approved threshold changes and the 3.5-filter decision, drop only the approved artefacts with **no
`CASCADE`** — any unexpected dependency Postgres reports stops that artefact's retirement and is
recorded as new evidence — then regenerate generated types once, re-run the reference sweep, exercise
every switched surface, re-measure schedulers (one trending, one influence, one entity-stats), and run
the full test suite, typecheck and build.

## Technical notes

- Blocking-reference evidence comes from: repository search over `src/` and `supabase/functions/`;
  catalogue queries over `pg_proc` bodies, views, triggers, policies and index definitions; and the
  scheduled-job list. Each row records the method used, so the audit is reproducible.
- Measurement of the 3.5 filter uses read-only queries against canonical endorsed reviews; no writes,
  no fixtures left behind.
