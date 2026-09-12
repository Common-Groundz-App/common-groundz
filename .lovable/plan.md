# Phase 4.2B.2 is only part-built — finish it before 4.2B.3

## What I checked

Live database and project files:

- Trending family (family 1) is in place: the new `trending_score_v2` value on items, plus the three
  internal routines (score calculator, candidate selector, updater), with the frozen access rules.
- Nothing else from 4.2B.2 exists: no new influence storage table, no influence calculator or
  refresh routine, no new similarity / reputation / who-to-follow / personalised routines, no
  `refresh-social-influence-v2` background job, and no influence bootstrap.
- Nothing in the app reads the new trending value yet, which is correct for this step.
- The roadmap still shows 4.2B.2 open, which matches reality.

So 4.2B.3 (switching the app over) cannot start: there is nothing to switch to for five of the six
score families. This plan finishes 4.2B.2 exactly as frozen, still with no app-visible change.

## What gets built (each family separately, same rules as trending)

1. **Influence** — new storage table beside the old one, one row per person per canonical item type,
   keyed uniquely on that exact pair (person + canonical type), only the 15 approved types allowed,
   score kept inside 0–1, internal write access only. Pure calculator that returns a score without
   writing. Engagement here is the **lifetime** measure from the frozen contract: eligible non-self
   likes on the exact credited set divided by the size of that set, saturating at an average of 50 —
   there is **no 24-hour window and no per-actor like cap** in influence; those belong only to
   trending. Refresh routine's candidate population is **people with current eligible contributions
   union people who already have a row in the new table** — this union is what lets a person who loses
   their last eligible contribution still be refreshed. Per-person reconciliation: compute the current
   eligible type pairs, upsert those, delete that person's new-table rows not in the current set
   (stale cleanup in the new table only — nothing old or source data is ever deleted). One-time full
   bootstrap.
2. **Similarity** — new routine returning the frozen result, including "not comparable" instead of
   zero when there is too little shared history.
3. **Reputation** — new routine on the frozen base/step/clamp values.
4. **Who-to-follow** — new viewer-scoped routine: one candidate pool, all reasons computed for every
   candidate, frozen reason priority, deterministic tie-break.
5. **Personalised items** — new viewer-scoped routine with the frozen weights, normalisation and
   tie-break.
6. **Influence refresh endpoint** — `refresh-social-influence-v2`, protected at its entry point
   (signed-in admin or shared internal secret only; never reachable anonymously), deployed but
   deliberately **left unscheduled** in this step. Scheduling it is 4.2B.3 work, not B2. A new secret
   is needed for it.


## Rules kept from the approved spec

- Everything is additive. No existing routine, column, threshold, caller or browser timer changes.
- Viewer-scoped routines evaluate visibility, follows and exclusions as the requested viewer, never as
  the routine owner or internal role.
- Internal-role detection uses the request identity, never `current_user` / `session_user`.
- All new routines: owned correctly, fixed search path, public execute revoked, access granted only to
  the roles the spec allows. Re-check access after each migration — this project grants new routines to
  visitors by default.
- Boost inputs stay frozen at zero.

## Verification before marking complete

- Replay the frozen fixtures for each family (transaction-scoped, rolled back), comparing to 6 decimals.
- Prove access rules live: anonymous blocked, ordinary signed-in blocked where required, viewer-scoped
  routines return the requested viewer's view.
- Prove bootstrap coverage and stale-row cleanup for influence, including the specific case: a person
  with an existing influence row loses their last eligible contribution, a refresh runs, and the stale
  row is gone.
- Confirm no new routine reads the legacy records table.
- Regenerate the generated database types; run the test suite, type check and build.
- Write `docs/verification/phase-4-2b2-scoring-routines.md`. 4.2B.2 is only ticked in the roadmap once
  the migrations, bootstrap, evidence, regenerated types and green checks are all in place — not when
  the migrations merely exist.

## Technical notes

- One migration per family, in order: influence storage → influence calculator/refresh → similarity →
  reputation → who-to-follow → personalised.
- Influence storage key is exactly `UNIQUE (user_id, canonical_type)`, with `canonical_type` constrained
  to the 15 canonical entity types — not a person/item key.
- Influence credited-set is the frozen one: one canonical published public review per author/item plus
  the earliest eligible public item-linked post, shared by both the volume and engagement terms.
  Engagement is lifetime average likes on that set (self-likes excluded), saturating at 50. The 24-hour
  window and 5-likes-per-actor cap stay exclusive to trending.
- Trending stays as built; only the contract-version comment is added if missing.

Hard stop at the end of 4.2B.2: no consumer cutover, no scheduling, no threshold rescaling.

