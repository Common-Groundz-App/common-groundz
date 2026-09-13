# Finish 4.2B.3 consumer cutover

Scheduler and security work is closed. What remains is fixing two real correctness defects in the
already-switched code, finishing the one unswitched consumer, auditing every surface against the
frozen rules, and writing the record. No v1 routine, table or column is dropped in this step.

## Settled review points

- **The type cast stays.** Verified in the live path: the interests column is text and the item type
  is the canonical enum, so comparing enum-as-text to text is correct. The earlier "remove the cast"
  line was wrong and is withdrawn.
- **Draft-inclusive exclusion is narrowed** to sets that already mean "the viewer has this covered":
  personalised items, and the collaborative and social recommendation exclusions. Generic browse and
  discovery lists keep their current behaviour and do not start hiding reviewed items.
- **Trending is split in two.** No overall surface may require a positive trending value to exist. A
  bucket explicitly labelled "trending" may use "greater than zero" for membership only; when empty,
  the other buckets fill the surface.
- **Both new findings are real and accepted.** Confirmed by reading the live access rules: the only
  read policy on reviews is "public, or your own". There is no Circle grant, so no browser query can
  honestly claim Circle coverage today, and the ordering defect below is present as described.

## Defect 1 — endorsement filtered before canonical selection

Two paths filter on the endorsement flag (and apply a row cap) *before* reducing to one current
review per person per item. An older "yes" can therefore outlive a newer "no" — exactly the stale
endorsement bug fixed earlier for entity pages — and a cap applied pre-reduction can silently drop
candidates.

Fix by moving canonical selection into SQL, so the correct order is enforced by the database and
never re-implemented in the browser: reduce to the current review per person and item, then inspect
the endorsement flag, then take the effective rating, then apply any cap. The client stops filtering
and stops capping pre-reduction.

## Defect 2 — Circle visibility must be enforced, not assumed

The frozen matrix requires viewer-specific social surfaces (influencer, extended-network, community)
to include Circle-visible reviews, while similarity and collaborative candidate discovery stay on the
public population. The access rules cannot deliver that, so these surfaces move to a viewer-scoped
routine that enforces identity server-side: the caller may only request their own viewer id, and the
routine returns public reviews plus Circle-visible reviews by authors the viewer follows plus the
viewer's own. Same ownership, revoke-then-grant and viewer-gate conventions as the other v2 routines.

This also removes the ambiguity in the earlier wording: collaborative candidate discovery and
similarity are public-only; viewer-specific social sourcing is viewer-authorised.

## Scope guards

- No new caller for `get_personalized_entities_v2` — zero callers, verified no-op.
- `calculate_user_reputation_v2` likewise stays a verified no-op.
- The v4 entity page is untouched; its fallback call keeps its own mapping, documented as intentional.

## Remaining work

1. The two fixes above (canonical-first endorsement routine, viewer-scoped social routine).
2. **Lifestyle similarity** — the scheduled job still calls the v1 similarity routine and coerces a
   missing value to zero. Switch to v2 and keep "not comparable" as absent, never zero. Weighting and
   output shape unchanged.
3. **Viewer exclusion** — draft-inclusive "any review record, any visibility" on exactly the three
   named sets, each confirmed by reading its use first.
4. **Trending readers** — order by the new value with a deterministic tie-break, no overall surface
   gated on it, labelled trending bucket keeps its membership rule, fallback pool fetched once and
   shared across buckets.
5. **Similarity + collaborative** — no zero-coercion, public published canonical population only,
   endorsement reads via the canonical-first routine.
6. **Influence + social** — browser read-only against the new influence store, no legacy
   recommendation rows in scoring, candidate, exclusion, ranking or social-proof paths.
7. **Who-to-follow** — on the v2 routine, suggestion UI unchanged.
8. **Types** — regenerate generated database types last, after the routines above are final.

## Close-out audit

- Zero remaining paths that filter on endorsement or cap rows before canonical selection.
- Endorsement fixtures: newer "no" over older "yes" excluded; low rating with explicit yes included;
  high rating with explicit no excluded; rating-inferred yes included.
- Visibility fixtures: a Circle-only review moves a viewer-specific social list and does **not** move
  similarity or the collaborative candidate set; a non-follower sees nothing from it.
- Draft-inclusive exclusion fixtures on the three named sets, plus one browse list that deliberately
  still shows reviewed items.
- Exactly one trending scheduler and one influence scheduler; no browser scheduler or writer anywhere.
- No secret literal in migrations, SQL, source or docs — only the Vault entry name.
- Every switched surface exercised and still returning sensible results, including influence under the
  "greater than zero" rule.
- Full test suite, typecheck and production build pass.

Then write `docs/verification/phase-4-2b3-consumer-cutover.md` with the three frozen tables, the
measured influence distribution, both defect fixes and their fixtures, the verified type-cast note,
the narrowed exclusion scope, the trending surface-versus-bucket distinction and the no-caller notes;
tick 4.2B.3; and report the deferred list below. Stop before 4.2B.4.

## Deferred, deliberately

- v1 routines, the v1 trending column and the v1 influence table stay → 4.2B.4 proof gate and
  retirement; the trending-hashtags routine's reference to the v1 trending routine is inspected there.
- Legacy recommendation listing and display — profile service, entity page section, feed hook,
  notification targets, content viewer and the `/recommendations/:id` route → 4.3, removed with rows.
- `reviews.recommendation_id` / `reviews.is_converted` clearing → 4.3; schema drop → 4.5.
- Pre-existing security-scan findings, unchanged by this work and tracked separately.
