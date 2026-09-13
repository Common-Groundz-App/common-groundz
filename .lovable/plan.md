# Finish 4.2B.3 consumer cutover

Scheduler and security work is closed. What remains is finishing the last unswitched consumer,
auditing every switched surface against the frozen rules, and writing the record. No v1 routine,
table or column is dropped in this step.

All three review corrections are accepted, and two of them are settled by measurement:

- **The type cast stays.** Verified in the live path: the interests column is text and the item type
  is the canonical enum, so comparing enum-as-text to text is correct. Nothing to change — the
  earlier "remove the cast" line was wrong and is withdrawn.
- **Draft-inclusive exclusion is narrowed.** It applies only where the set already means "the viewer
  has this covered": personalised items, and the collaborative and social recommendation exclusions.
  Generic browse and discovery lists keep their existing behaviour and do not start hiding items the
  viewer has reviewed.
- **Trending wording is split in two.** No overall surface may require a positive trending value to
  exist. A bucket explicitly labelled "trending" may still use "greater than zero" for membership
  only; when it is empty the other buckets fill the surface.

## Scope guards

- No new caller for `get_personalized_entities_v2` — zero callers, verified no-op.
- `calculate_user_reputation_v2` likewise stays a verified no-op.
- The v4 entity page is untouched. Its fallback call keeps its own mapping, documented as intentional.

## Work

1. **Lifestyle similarity (the one real gap)** — the scheduled similarity job still calls the v1
   similarity routine and coerces a missing value to zero. Switch it to the v2 routine and preserve
   "not comparable" as absent rather than zero, so an incomparable pair never reads as maximally
   dissimilar. Weighting and output shape unchanged.

2. **Viewer exclusion** — draft-inclusive "any review record, any visibility" applied to exactly the
   three sets named above, each confirmed by reading its use before changing it.

3. **Trending readers** — every approved reader orders by the new value with a deterministic
   tie-break; no overall surface gated on it; the labelled trending bucket keeps its membership rule.
   Fallback keeps the widened candidate pool fetched once and shared across buckets.

4. **Similarity + collaborative** — no zero-coercion of the similarity value, public published
   canonical population only, endorsement reads on the stored endorsement flag.

5. **Influence + social** — browser read-only against the new store, endorsement flag everywhere,
   viewer-specific surfaces under the frozen Circle visibility rule while similarity and candidate
   discovery stay public-only, and no legacy recommendation rows in scoring, candidate, exclusion,
   ranking or social-proof paths.

6. **Who-to-follow** — on the v2 routine, suggestion UI unchanged.

7. **Types** — regenerate generated database types once the shape is final.

## Close-out audit

- Exactly one trending scheduler and one influence scheduler; no browser scheduler or writer anywhere.
- No secret literal in migrations, SQL, source or docs — only the Vault entry name.
- Each switched surface exercised and still returning sensible results, including the influence
  surface under the "greater than zero" rule, and a fixture proving a Circle-only review moves a
  viewer-specific social list but not similarity or the candidate set.
- Fixtures for draft-inclusive exclusion on the three named sets, and for a browse list that
  deliberately still shows reviewed items.
- Full test suite, typecheck and production build pass.

Then write `docs/verification/phase-4-2b3-consumer-cutover.md` with the three frozen tables
(endorsement eligibility, visibility matrix, influence rule), the measured influence distribution,
the verified type-cast note, the narrowed exclusion scope, the trending surface-versus-bucket
distinction and the no-caller notes; tick 4.2B.3 in the roadmap; and report the deferred list below,
confirmed by audit.

## Deferred, deliberately

- v1 routines, the v1 trending column and the v1 influence table stay → 4.2B.4 proof gate and
  retirement; the trending-hashtags routine's reference to the v1 trending routine is inspected there.
- Legacy recommendation listing and display — profile service, entity page section, feed hook,
  notification targets, content viewer and the `/recommendations/:id` route → 4.3, removed with rows.
- `reviews.recommendation_id` / `reviews.is_converted` clearing → 4.3; schema drop → 4.5.
- Pre-existing security-scan findings, unchanged by this work and tracked separately.
