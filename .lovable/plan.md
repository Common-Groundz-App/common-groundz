# Finish 4.2B.3 consumer cutover

Scheduler and security work is closed. What remains is finishing the last consumer pipeline,
auditing every switched surface against the frozen rules, and writing the record. No v1 routine,
table or column is dropped in this step.

## Scope guards

- No new caller for `get_personalized_entities_v2` — it stays a verified no-op with zero callers.
  Only the already-live personalisation paths that read the new trending value are touched.
- `calculate_user_reputation_v2` likewise stays a verified no-op.
- Nothing in the v4 entity page changes. `NetworkRecommendations.tsx` keeps calling the fallback
  routine directly with its own mapping; that stays as-is and is documented as intentional.

## Work

1. **Personalisation paths** — finish the two flagged corrections in the live paths only:
   - viewer exclusion excludes an item when the viewer has *any* review record for it — draft or
     published, any visibility;
   - interest matching compares the interest type against the item type without a text cast.

2. **Viewer exclusion audit** — apply the same "any review record" rule everywhere an exclusion set
   is built (collaborative, social, discovery), so a draft still hides an item.

3. **Trending readers** — confirm every approved reader orders by the new value with a deterministic
   tie-break and gates on nothing: discovery, fallback suggestions, explore, search ranking,
   personalisation. Fallback keeps the widened candidate pool with one fetch shared across buckets
   and deterministic ordering.

4. **Similarity + collaborative** — confirm no "missing becomes zero" coercion on the similarity
   value, the population is public published canonical reviews only, and every endorsement-shaped
   read uses the stored endorsement flag.

5. **Influence + social** — confirm the browser only reads the new influence store, the endorsement
   flag drives every endorsement read, viewer-specific surfaces follow the frozen Circle visibility
   rule while similarity and candidate discovery stay on the public population, and no legacy
   recommendation rows remain in scoring, candidate, exclusion, ranking or social-proof paths.

6. **Who-to-follow** — on the v2 routine, with the suggestion UI unchanged.

7. **Types** — regenerate the generated database types once the shape is final.

## Close-out audit

- Exactly one trending scheduler and one influence scheduler exist; no browser scheduler or writer
  remains anywhere.
- No secret literal in migrations, SQL, source or docs — only the Vault entry name.
- Each switched surface exercised and returning sensible, non-empty results where it was non-empty
  before, including the influence surface under the "greater than zero" rule.
- Full test suite, typecheck and production build pass.

Then write `docs/verification/phase-4-2b3-consumer-cutover.md` with the three frozen tables
(endorsement eligibility, visibility matrix, influence rule), the measured influence distribution,
the no-caller notes and the fallback-caller exception; tick 4.2B.3 in the roadmap; and report the
remaining v1/legacy dependencies deliberately deferred.

## Expected deferred list (to confirm by audit)

- v1 routines, the v1 trending column and the v1 influence table stay in place → 4.2B.4 proof gate
  and retirement. `calculate_trending_hashtags` referencing the v1 trending routine is inspected
  there, not now.
- Legacy recommendation *listing and display* — profile service, entity page section, feed hook,
  notification targets, the content viewer and the `/recommendations/:id` route → 4.3, removed
  together with the rows.
- `reviews.recommendation_id` / `reviews.is_converted` clearing → 4.3; the schema drop → 4.5.
- Pre-existing security-scan findings are unchanged by this work and tracked separately.
