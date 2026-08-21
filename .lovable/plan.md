# Phase 0 verification + roadmap for Phases 1-4

## Phase 0 status: complete and correct

Verified on disk this turn:

- `src/services/entityType.ts` — 15 canonical types, strict `parseEntityType` (returns `null`), boundary parser for legacy aliases.
- `src/services/entityRelationshipRegistry.ts` — provider/offering registry (`brand -> product`, `place -> food`) with labels, verbs, and `assertValidOfferingPair()`.
- `src/services/entitySlug.ts` + `entityHierarchyService.ts` — shared `buildHierarchicalSlug`.
- `EntityType` enum in `src/services/recommendation/types.ts` holds exactly the 15 canonical members; the 6 deprecated members are gone.
- `mapStringToEntityType` returns `null` instead of falling back to `product`; `getCanonicalType` is display-only.
- Docs: `docs/phase-0-taxonomy-audit.md`, `docs/provider-offering-contract.md`.
- Test suite: 24 files / 334 tests passing.

Two known leftovers, both intentionally deferred (they are UI/behaviour, which Phase 0 forbade):

1. `src/services/entityTypeMapping.ts` — dead deprecated shim, zero importers. Delete in Phase 1.
2. `src/components/profile/reviews/ReviewForm.tsx` `getReviewCategory()` still squashes `course/app/game -> product` and `experience -> place`, and `FeaturedProductsSection.tsx` hardcodes "Featured Products". Both are exactly what Phase 1 replaces.

Nothing from Phase 0 is half-applied.

---

## Phase 1 — Wire the registry to the UI (no schema change)

Goal: kill hardcoded offering vocabulary and dead code.

- Replace `FeaturedProductsSection` hardcoded copy with `getOfferingSectionLabel(provider.type, child.type)`; fall back to a generic "Related" heading when the pair is unregistered. Same for "View All N Products".
- Add an offering context line on offering entity pages: `Classic Burger at Truffles`, `Pegasus 43 by Nike`, using `getOfferingContextVerb()`.
- Grouped children: a provider may host several offering types later, so group children by type and render one labelled section per registered pair.
- Delete `src/services/entityTypeMapping.ts`.
- Tests: registry-driven label rendering, unregistered-pair fallback, verb selection.

## Phase 2 — Entity-first review subject (delete the category step)

Goal: the review's subject is an entity; the category is derived, never chosen.

- Rewrite the wizard as 3 steps: **1. Subject** (unified entity search + create) → **2. Rating** → **3. Details/media**.
- Remove Step 2 (`StepTwo` category picker) and `getReviewCategory()`. `reviews.category` is written as `subject.type` verbatim — no squashing of `course/app/game/experience`.
- Reuse the composer's `UnifiedEntitySelector` so subject selection behaves identically to `/create`.
- Offering creation from the review flow: when the user searches a dish and it does not exist, create the `food` entity under the selected `place` via `assertValidOfferingPair()` + `buildHierarchicalSlug()`.
- Backfill decision: leave the 17 known mismatched fixture rows as-is (regression coverage), only new writes obey the invariant.
- Tests: derived category per type, offering creation path, edit-mode parity.

## Phase 3 — Config-driven questionnaires

Goal: per-type questions without per-type components.

- One declarative question schema keyed by canonical type (and optionally by provider/offering role), rendered by a single generic step component.
- Answers persist in a JSONB column on `reviews` (structured `what_worked` / `didnt_work` / `duration` style fields already exist for posts — mirror that shape).
- Fallback: types without a schema get the generic details step, so all 15 types work on day one.
- Tests: schema-to-render coverage for every canonical type, unknown-type fallback.

## Phase 4 — Recommendations taxonomy alignment

Goal: recommendations stop using their own vocabulary.

- `RecommendationCategory` enum (`Drink`, `Activity`, `Music`, `Art`, `TV`, `Travel`) is now the last legacy taxonomy. Map it through `parseEntityTypeAtBoundary`, migrate the 9 existing rows, and retire the enum.
- Align route/badge maps in `RecommendationCard.tsx` to canonical types only.
- Migration + grants reviewed before any DB write; a `reviews.category = subject.type` DB constraint can be considered only after Phase 2 has been live.

## Technical notes

- Registry and canonical list stay the single source of vocabulary; no component may re-declare type lists.
- No new value is ever added to the Supabase `entity_type` enum for provider/offering — they are roles.
- Each phase ends with `bunx vitest run` green and a typecheck, and is shipped independently.
