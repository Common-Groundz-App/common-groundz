# Phase 2.2 verification + Phase 2.3 — Safe subject creation ("Add the dish")

## Phase 2.2 status: complete and correct

Verified this turn:

- The database is the slug authority. `generate_entity_slug_v2(name, current_entity_id, parent_id, requested_slug)` exists with the `requested_slug` branch; `generate_entity_slug_on_insert` and `update_entity_slug` are the only creation/rename paths.
- Client cleanup landed: `createEntityQuick` no longer manufactures a slug (explicit comment at `enhancedEntityService.ts:53`), `setEntityParent` sends only `parent_id` and documents attach/reparent/detach behaviour.
- `slugifyEntityName` carries NFKD transliteration for parity with `public.slugify_entity_name`; parity fixtures are pinned in `entitySlug.test.ts`.
- Full suite green: 27 files, 359 tests.

Three leftovers exist. None of them break Phase 2.2, and each is scheduled rather than silently ignored:

1. `supabase/functions/create-brand-entity/index.ts` still runs its own `baseSlug` + counter loop and passes `slug` on insert. The trigger now validates that supplied slug, so it is redundant, not wrong. Brands are parentless, so no hierarchy risk. Removing the loop belongs to Phase 2.3 because that function is touched by the creation work anyway.
2. `src/utils/slugMigration.ts` and `src/utils/slugMigrationPreview.ts` are parent-unaware client slug generators, kept as admin/backfill tools. They must not be reachable from user flows; retirement is Phase 2.5 cleanup.
3. `steps/StepTwo.tsx` and `CategorySelector.tsx` remain unreferenced from Phase 2.1, also Phase 2.5 cleanup.

## Phase 2.3 goal

Today Step 2 runs `externalResultPolicy="existingOnly"` with `allowInlineCreate={false}`, so a user reviewing a dish that isn't in the database has only "Skip for now". Phase 2.3 gives that user a safe, narrow way to create the subject — a provider-anchored offering ("Add this dish at a place") plus a plain standalone create — so Phase 2.4 can finally require a subject.

Scope is the review wizard's Step 2 and the creation service behind it. No questionnaire changes, no Step 3/4 changes, no category-derivation changes.

## What gets built

**1. A dedicated quick-create sheet, not the admin dialog**

New `SubjectQuickCreate` (in `components/profile/reviews/steps/`), opened from Step 2 when the search has ≥3 characters and returns nothing. Fields only:

- Name (prefilled from the search query)
- Type — a short picker limited to canonical types, defaulting from what the user searched
- Provider — shown only when the chosen type is a registry offering type (`food`, `product`, `service`); a small existing-only place/brand search. Required for `food`, optional otherwise.
- Create button

No image upload, no metadata, no description. The admin `CreateEntityDialog` stays untouched and out of the review flow.

**2. Registry-validated creation**

The provider/offering pair is checked with `assertValidOfferingPair()` from `entityRelationshipRegistry.ts` before insert. An unregistered pair is refused with a plain message, never silently downgraded to a parentless entity.

**3. `parent_id` on quick create**

`createEntityQuick` gains an optional third argument for the parent entity id, passed straight through to the insert. It still sends no slug — the insert trigger builds `parentSlug-childSlug` and guarantees uniqueness. This is the Phase 2.2 payoff: two "Classic Burger" dishes under different restaurants no longer collide.

**4. Step 2 wiring**

`SubjectSelectStep` keeps `existingOnly` for external API results (unchanged, still no accidental Google Places writes) but gains an explicit "Can't find it? Add it" affordance that opens the sheet. A successful create selects the new entity as the subject immediately and runs the existing parent-context lookup, so the confirmation line reads "Dish at Toit" straight away.

"Skip for now" stays in this phase. It is removed in 2.4, once creation has been exercised.

**5. Telemetry**

Extend the existing `log-search-funnel` review-subject events with `subject_create_opened`, `subject_created` (type, whether a provider was attached), and `subject_create_failed`. This is how we judge readiness for 2.4.

**6. Brand edge-function slug cleanup**

Delete the manual slug loop and the `23505` retry in `create-brand-entity`, letting the insert trigger own the slug. Keep the duplicate/website checks exactly as they are.

## Guardrails

- Users can only create entities from the review flow through this narrow sheet; the admin dialog remains admin-only.
- Type comes from `parseEntityType`; an unparseable type blocks creation rather than defaulting to `product` or `place`.
- Nothing writes `slug` from the client.
- Existing reviews being edited are unaffected — creation is only reachable when no subject is selected and `subjectOrigin` is `user-selected`.

## Technical notes

- Touched: `SubjectSelectStep.tsx`, new `SubjectQuickCreate.tsx`, `enhancedEntityService.ts` (`createEntityQuick` parent arg), `ReviewForm.tsx` (subject-created handler + telemetry), `supabase/functions/log-search-funnel` allowlist, `supabase/functions/create-brand-entity/index.ts`.
- No migration required — the Phase 2.2 trigger already handles parented inserts.
- Tests: registry rejection of an invalid pair; `createEntityQuick` sends `parent_id` and never `slug`; a created subject becomes the active subject with a derived canonical category; the type picker rejects unknown types.

## Out of scope

Requiring a subject (2.4). Removing `StepTwo`/`CategorySelector`/`slugMigration` (2.5). Questionnaire configuration (Phase 3). Image or metadata enrichment for created subjects. Menu ingestion. Concept/cuisine multi-classification.
