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

Canonical types offered parentless: `place`, `book`, `movie`, `tv_show`, `course`, `app`, `game`, `event`, `brand`, `professional`, `experience`, `others`. Fields: type + name. Nothing else.

`service` is deliberately **not offered** in this phase. That is a UI omission, not a model claim — nothing in the code will encode "a service must have a provider". Its relationship semantics (`place → service`, `professional → service`) stay undecided, and the registry gains no new pairs.

**3. Path B — offering under a provider**

Only the two approved registry pairs this phase: `place → food` and `brand → product`. No `place → service`, `professional → service`, or `place → product`.

Food flow: `Add a dish → Where is it offered? [existing-only place search] → What's it called? → Create and continue`. Provider is **required** for `food`; no orphan dish can be created through the review form.

`product` is two different creations, not one with an optional field:
- Brand selected → offering creation, `assertValidOfferingPair('brand','product')`, `parent_id` set, hierarchical slug.
- "I don't know the brand" → **standalone** product creation, `parent_id` null, and the pair assertion is not called at all (there is no relationship to validate). No placeholder brand is ever invented.

Provider not found: no nested dialog. The same drawer switches sequentially from offering mode to standalone place creation, then returns to the dish form with the new place preselected — one drawer, a state change, and the review draft untouched throughout.

`parent_id` is set at insert; the Phase 2.2 trigger produces `truffles-classic-burger`. The client never computes or sends a slug.


**4. Auto-select through the real handler**

On success the created entity is fed into `handleSubjectChange` — the same authoritative path an existing search result takes — so canonical category, `questionnaireKind`, `foodName`, venue/parent context, step completion, recents and telemetry all derive exactly as today. Never set `entityId` by hand.

**5. Type resolution**

Type comes from `parseEntityType`; unparseable blocks creation. No falling back to `product` or `place`.

**6. Duplicates: server-side authority, and one atomic create-or-resolve for exact identities**

Two corrections to my previous draft, both blocking:

*The `23505` recovery was guarding an error that mostly won't fire.* I confirmed `generate_entity_slug_v2` resolves collisions itself with a counter suffix. So two concurrent "Classic Burger at Truffles" creates do not reliably collide — they most likely become `truffles-classic-burger` and `truffles-classic-burger-2`, two rows, no error, exactly the duplicate dishes the provider/offering architecture exists to prevent. Catching `23505` cannot make offering creation race-safe.

*The fix: one atomic server-side create-or-resolve.* A new SECURITY DEFINER RPC, `create_entity_subject(name, type, parent_id, metadata)`, owns the exact-identity boundary:

```text
lock  pg_advisory_xact_lock(hashtext(parent_id || type || normalized_name))
check exact existing match
      found → return (entity, created = false)
      none  → insert → return (entity, created = true)
```

All inside one transaction. B waits on A's lock, then finds A's row and returns it. Result: one entity, both callers get the same id — the acceptance criterion actually holds rather than being asserted. No new `UNIQUE(parent_id, type, normalized_name)` constraint: that needs a canonical normalized-name column, null-parent partial semantics, and a backfill decision over existing data — schema policy well beyond this phase. The advisory lock is targeted and reversible.

The lock is only taken where identity is well-defined (an offering under a provider). Standalone name-only creation takes no lock and is never force-merged.

*Exact identity, tightened, and defined in exactly one place.* Codex is right that a helper under `src/` is invisible to a deployed edge function, so "one predicate" was aspirational. The predicate lives server-side only:

- `supabase/functions/_shared/exactIdentity.ts` — used by `check-entity-duplicates` for classification. The client never implements it.
- The same rules expressed in SQL inside `create_entity_subject` for the locked recheck.

Both are server-side and both get parity tests, the same arrangement already used for `brand_normalize.ts` and its browser mirror.

Rules, with type compatibility required (a brand and a product sharing `example.com` are not the same thing):

1. same `api_source` + `api_ref`, both non-null, **and compatible canonical type** — a type conflict here is a data-integrity signal, reported, not silently merged
2. same normalized `website_url` **and same canonical type**
3. offering: same `parent_id` + same canonical type + same normalized name

Everything else is **possible**, by construction. Standalone type + normalized name is explicitly not exact: two places called Central Cafe, two books titled "It", a remake, two professionals with the same name, a recurring event are all legitimately distinct, and quick-create collects only type and name.

*UI per class.* Exact → `Classic Burger at Truffles already exists.` with a single `[Review this]`, no "Create anyway". Possible → `This might already exist.` with `[Use existing]` and `[Create anyway]`.

*Preflight is advisory only.* `check-entity-duplicates` still runs for friendly UX before creation, but it decides nothing; the RPC is the authority.

*Residual errors fail safely.* The client keeps a small allowlist of recognized constraints (`entities_slug_key`, `entities_api_source_ref_idx`, `entities_website_url_idx`), read from the structured constraint field rather than parsed from a message. On a recognized conflict, bounded retry through the RPC. On an unrecognized constraint, or nothing resolving, surface a real failure — never fabricate success.

Normalized name uses the existing `normalizeBrandName` (NFKD, alphanumeric-only), mirrored in SQL, so the RPC and the classifier agree on what "same name" means.



**7. Provenance and moderation**

Provenance reuses whatever mechanism creation already uses — `create-brand-entity` stores `metadata.auto_created` / `metadata.created_from_product_url`, and existing entities carry `metadata.created_from_url`, so the review surface records `metadata.created_from = 'review_form'` in that same metadata contract rather than inventing a column. Also recorded: creator id (already enforced server-side by `entities_enforce_creation`), default moderation status, the provider relationship, any external ref. Creating from a review grants no privileges. Explicit rule: an abandoned review still leaves the created entity in the catalog — it is a contribution, not a draft artifact.


**8. Telemetry**

Add `review_subject_create_opened`, `review_subject_created` (type, provider attached yes/no, duplicate-warning shown yes/no), `review_subject_create_failed`, `review_subject_duplicate_resolved` to `log-search-funnel/allowlists.ts`. These numbers decide when 2.4 can require a subject.

**9. Brand edge-function slug cleanup**

Delete the manual slug counter loop and the `slug` field on insert. **Keep** its `23505` handling — that branch becomes the shared conflict-resolution pattern described in step 6, not something to remove. Its duplicate/website checks are untouched.

## One thing I'd add on top of both reviews

- **Test the predicate directly, and test that both callers use it.** `isExactIdentityMatch` gets its own unit tests (same api_ref → exact; same website → exact; same dish under same place → exact; two "Central Cafe" places → possible; "Classic Burger" vs "Classic Cheese Burger" → possible). Separately, assert that recovery routes through the same helper rather than its own inline comparison — that shared call is the entire safeguard, and it is the kind of thing a later refactor quietly duplicates. Plus a test that an unrecognized constraint violation propagates as a failure instead of a fake success.

## Explicitly unchanged

Four wizard steps. "Skip for now" stays (removed in 2.4) — it is also the fallback while `search-or-create` is still being proven. No `entity_id NOT NULL`, no migration, no Step 3 fallback removal, no questionnaire redesign, no legacy component deletion, no changes to composer creation, existing reviews, or recommendation categories. No new registry pairs. External API results stay `existingOnly` in review mode.

## Acceptance criteria

Existing subject search still works; standalone creation works; food creation requires a place and produces a hierarchical slug from the trigger; product-under-brand works and brand-less product is standalone with no pair assertion; `service` quick-create is absent and no code asserts it needs a provider; invalid pairs are refused by the registry; exact matches offer only "Review this" while possible matches offer both actions; standalone name-only matches are never exact; two concurrent "Classic Burger at Truffles" creates yield one dish and the same id to both with no `23505` in the UI; an unrecognized unique-constraint violation fails loudly instead of resolving; success auto-selects via `handleSubjectChange`; the draft survives open, cancel, mode-switch, failure and success; Skip still available; composer unchanged.



## Files touched

`steps/SubjectSelectStep.tsx`, new `steps/SubjectQuickCreate.tsx`, `ReviewForm.tsx`, `enhancedEntityService.ts` (`createEntityQuick` parent arg), `supabase/functions/check-entity-duplicates/index.ts` (offering-scoped check), `supabase/functions/log-search-funnel/allowlists.ts`, `supabase/functions/create-brand-entity/index.ts`.

## Out of scope

Requiring a subject (2.4). Legacy cleanup (2.5). Config-driven questionnaires (Phase 3). Image/metadata enrichment for created subjects, menu ingestion, cuisine/concept multi-classification.
