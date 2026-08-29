# Phase 2.2 verification + Phase 2.3 — "Can't find it? Add something new"

## Phase 2.2 status: complete and correct

- The database is the slug authority: `generate_entity_slug_v2(name, current_entity_id, parent_id, requested_slug)` plus the insert and update triggers are the only creation/rename paths.
- Client cleanup landed: `createEntityQuick` no longer manufactures a slug, `setEntityParent` sends only `parent_id`.
- `slugifyEntityName` has NFKD transliteration for parity with `public.slugify_entity_name`, fixtures pinned in `entitySlug.test.ts`.
- Full suite green: 27 files, 359 tests.

Leftovers, none blocking, each scheduled:

1. `supabase/functions/create-brand-entity/index.ts` still runs its own slug counter loop and passes `slug` on insert. Redundant now (brands are parentless, and the trigger validates a supplied slug), removed in 2.3 since the function is in scope anyway.
2. `src/utils/slugMigration.ts` / `slugMigrationPreview.ts` — parent-unaware admin backfill tools, retired in 2.5.
3. `steps/StepTwo.tsx` and `CategorySelector.tsx` still unreferenced from 2.1, deleted in 2.5.

## Creation-service audit (the thing both reviews asked for first)

`src/services/enhancedEntityService.ts` is the path to reuse. `createEntityQuick` already sets `created_by` from the session, sends no slug, and returns the inserted row immediately; `entities_enforce_creation` enforces `created_by` server-side and `approval_status` defaults apply. One small refactor is needed and nothing more: an optional `parentId` argument passed through to the insert. No review-only persistence service.

`CreateEntityDialog` (admin) stays out of the review flow. `check-entity-duplicates` already exists as an edge function and is the server-side guard for step 6 below.

## What Phase 2.3 builds

**1. Entry point replaces the dead end**

Step 2 currently offers only "Skip for now" when search finds nothing. Add:

```text
Can't find what you're reviewing?
[ Add something new ]
```

Opens a drawer/modal over the review form. `ReviewForm` state (rating, title, text, media, date, visibility, current step, search query) is untouched on open, cancel, failure and success — the drawer is a sibling of the wizard, never a remount.

**2. Path A — standalone entity**

Canonical types that can safely exist parentless: `place`, `book`, `movie`, `tv_show`, `course`, `app`, `game`, `event`, `brand`, `professional`, `experience`, `others`. Fields: type + name. Nothing else.

**3. Path B — offering under a provider**

Only the two approved registry pairs this phase: `place → food` and `brand → product`. No `place → service`, `professional → service`, or `place → product` — those are product decisions, not plumbing.

Food flow: `Add a dish → Where is it offered? [existing-only place search] → What's it called? → Create and continue`. Provider is **required** for `food`; no orphan dish can be created through the review form. For `product`, the brand is optional and the UI says so explicitly ("I don't know the brand") rather than inventing a placeholder brand.

Every pair goes through `assertValidOfferingPair()` from `entityRelationshipRegistry.ts`. `parent_id` is set at insert; the Phase 2.2 trigger produces `truffles-classic-burger`. The client never computes or sends a slug.

**4. Auto-select through the real handler**

On success the created entity is fed into `handleSubjectChange` — the same authoritative path an existing search result takes — so canonical category, `questionnaireKind`, `foodName`, venue/parent context, step completion, recents and telemetry all derive exactly as today. Never set `entityId` by hand.

**5. Type resolution**

Type comes from `parseEntityType`; unparseable blocks creation. No falling back to `product` or `place`.

**6. Duplicate detection before insert, with a server-side guard**

- Standalone: canonical type + normalized name (+ website/API ref when present).
- Offering: `parent_id` + offering type + normalized name — scoped to the chosen provider, so "Classic Burger" at two restaurants is not a duplicate.
- UI shows `This may already exist: Classic Burger at Truffles` with `[Review this instead]` (selects the existing entity) and `[Create anyway]`.
- A UI check alone loses races, so the final check runs server-side immediately before insert via `check-entity-duplicates`; a same-parent same-name collision returns the existing entity instead of inserting.

**7. Provenance and moderation**

Record creator id, `creation_source: 'review_form'`, default moderation status, the provider relationship, and any external ref. Creating from a review grants no privileges. Explicit rule: an abandoned review still leaves the created entity in the catalog — it is a contribution, not a draft artifact.

**8. Telemetry**

Add `review_subject_create_opened`, `review_subject_created` (type, provider attached yes/no, duplicate-warning shown yes/no), `review_subject_create_failed`, `review_subject_duplicate_resolved` to `log-search-funnel/allowlists.ts`. These numbers decide when 2.4 can require a subject.

**9. Brand edge-function slug cleanup**

Delete the manual slug loop and the `23505` retry in `create-brand-entity`; leave its duplicate/website checks alone.

## Two things I'd add on top of both reviews

- **A concurrency test, not just a code path.** The server-side dedupe guard is the one piece that can't be verified by clicking. Two near-simultaneous "Classic Burger at Truffles" creates must yield one entity and two successful selections. Worth an explicit test because the global unique slug index would otherwise surface as a raw `23505` in the user's face.
- **The provider search must be existing-only and must not nest creation.** If a user is adding a dish at a restaurant that isn't in the database either, they get one clear message and the option to add the place first — not a recursive create-inside-create. That keeps the flow finite and the draft safe.

## Explicitly unchanged

Four wizard steps. "Skip for now" stays (removed in 2.4). No `entity_id NOT NULL`, no migration, no Step 3 fallback removal, no questionnaire redesign, no legacy component deletion, no changes to composer creation, existing reviews, or recommendation categories. External API results stay `existingOnly` in review mode.

## Acceptance criteria

Existing subject search still works; standalone creation works; food creation requires a place and produces a hierarchical slug from the trigger; product-under-brand works and brand-less product is a deliberate choice; invalid pairs are refused by the registry; duplicates are surfaced before insert and resolved server-side under concurrency; success auto-selects via `handleSubjectChange`; the draft survives open, cancel, failure and success; Skip still available; composer unchanged.

## Files touched

`steps/SubjectSelectStep.tsx`, new `steps/SubjectQuickCreate.tsx`, `ReviewForm.tsx`, `enhancedEntityService.ts` (`createEntityQuick` parent arg), `supabase/functions/check-entity-duplicates/index.ts` (offering-scoped check), `supabase/functions/log-search-funnel/allowlists.ts`, `supabase/functions/create-brand-entity/index.ts`.

## Out of scope

Requiring a subject (2.4). Legacy cleanup (2.5). Config-driven questionnaires (Phase 3). Image/metadata enrichment for created subjects, menu ingestion, cuisine/concept multi-classification.
