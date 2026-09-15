# Phase 4.3 close-out audit — result and the one remaining step

Audited against the live codebase, the live database catalogues, deployed function sources, the schedulers, and the six evidence files. Not from the roadmap.

## Verdict per gate

| Gate | Result |
|---|---|
| 0 — bookkeeping | PASS |
| 1 — write freeze | PASS |
| 2 — client/Edge cutover | PASS |
| 3 — audit manifest | PASS |
| 4 — destructive cleanup | PASS |
| 5 — last app references | PASS |
| 6 — preservation + zero-dependency | PASS with BLOCKED signed-in checks (see below) |

No leftovers found. No defect-level reference to the retired system remains.

## Evidence confirmed live

- All four retired tables are empty; no review carries a conversion marker; no notification points at a retired link; no orphaned comment likes or mentions; 58 endorsements intact.
- Privileges: `anon` and `authenticated` hold read only; `service_role` holds read + delete only; owner unchanged. Only read policies remain on the four tables; every write policy is gone.
- The six retired-only routines are executable by the owner only. The seven shared comment routines are executable exactly as before and contain no reference to the retired layer at all (verified in the live function bodies) — so retired input is rejected server-side, both `get_comments_with_profiles` overloads included.
- Recommendation-type posts run entirely on the normal post path.
- App code: the retired page, its viewer, the route, the redirect entry, the retired notification mappings and the dead SQL snapshot are all gone. Nothing in the app generates a retired link. Both media-cleanup jobs read only posts, reviews, review updates, entity photos and entities.
- Recs card: click and Share both build the canonical `/entity/:slug` destination (the correct route), Share is a real share/copy action, no dead comment control remains.
- Schedulers: exactly one trending job (hourly, minute 20) and one influence job (daily 04:12); five jobs total, as agreed.
- Build OK; test suite green at 633/633; type check clean.

## Classification of every remaining reference

- **Required live dependency:** `src/services/recommendation/types.ts` (shared `Entity` / `EntityType` types used across entity pages, feed and utilities), `hooks/recommendations/*` entity helpers, the preserved circle/fallback/network/chat/journey recommendation surfaces.
- **Deferred schema object (Phase 4.4/4.5):** the four retired tables, `recommendation_category` enum, `reviews.recommendation_id`, `reviews.is_converted`, their constraints/indexes/triggers/read policies, the retired-only routines, and the `*_backup` tables.
- **Generated type:** `src/integrations/supabase/types.ts`, regenerated once after Phase 4.5.
- **Historical migration:** everything under `supabase/migrations/`.
- **Test fixture:** the retired-link cases in `src/utils/notificationDestination.test.ts` that prove rejection.
- **Documentation:** `docs/verification/*`, `roadmap.md`, `GOOGLE_PLACES_OPTIMIZATION.md`, archived plans.
- **Defect:** none.

**Must not be removed in Phase 4.4/4.5:** the `recommendation_visibility` enum is shared — it types `posts.visibility` and `reviews.visibility`. Only `recommendation_category` is genuinely retired-only.

## The one open item

Gate 6's own completion rule says the gate is not ticked while a required signed-in check is BLOCKED. Three checks are BLOCKED because this project uses your own Supabase, so no test sign-in can be created and no transaction fixtures can be run from here:

1. Signed-in Recs tab render and card click-through.
2. Circle-viewer counts on the entity page and the "Recommended by Your Circle" card.
3. Recommendation-post create / comment / like / notification exercised at runtime.

Each is covered by static and automated-test evidence, and the underlying paths are proven post-only in the live database. What is missing is only human observation.

### Proposed close-out (smallest step, no code or schema changes)

You sign in and check three things, then I record the result:

- Open your profile's Recs tab: cards appear, clicking one opens the entity page, Share copies/shares that entity link.
- Open an entity page you have circle activity on: the recommending and from-circle counts read as before, and the Circle card lists people.
- Create a recommendation-type post, comment and like on it, and open its notification: everything behaves like a normal post.

If all three look right, I mark those checks PASS-by-manual-observation in the Gate 6 evidence file and mark Phase 4.3 fully complete. If you'd rather not do the manual pass, I can instead record them as an accepted, documented exception — but per your own completion rule that is a deliberate waiver, not a PASS.

## Hand-off inventory for Phase 4.4

Drop-readiness proof only (no drops):

- Tables: `recommendations`, `recommendation_comments`, `recommendation_likes`, `recommendation_saves` (+ `recommendations_backup`, and the other `*_backup` tables if in scope).
- Columns: `reviews.recommendation_id` (and its restricting foreign key), `reviews.is_converted`.
- Type: `recommendation_category` only. **Keep** `recommendation_visibility`.
- Routines: the six retired-only functions, plus the `retract_recommendation_like_notification` trigger function on `recommendation_likes`.
- Triggers on the retired tables: `on_new_recommendation_comment`, `on_soft_delete_recommendation_comment`, `update_updated_at_column`, `on_delete_recommendation_like`, `on_new_recommendation_like`, `update_recommendations_updated_at`.
- Remaining read policies on the four tables, their indexes and constraints.
- Generated types file, regenerated once at the end.

No drops, no CASCADE, no type regeneration in Phase 4.4. Phase 4.4 stops at the dependency proof.
