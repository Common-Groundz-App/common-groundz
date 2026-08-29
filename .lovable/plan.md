# Phase 2.2 verification + Phase 2.3 — "Can't find it? Add something new"

## Phase 2.2 status: complete and correct

- The database is the slug authority: `generate_entity_slug_v2(name, current_entity_id, parent_id, requested_slug)` plus the insert and update triggers are the only creation/rename paths.
- Client cleanup landed: `createEntityQuick` no longer manufactures a slug, `setEntityParent` sends only `parent_id`.
- `slugifyEntityName` has NFKD transliteration for parity with `public.slugify_entity_name`, fixtures pinned in `entitySlug.test.ts`.
- Full suite green: 27 files, 359 tests.

Leftovers, none blocking, each scheduled:

1. `supabase/functions/create-brand-entity/index.ts` still runs its own slug counter loop and passes `slug` on insert. Redundant now, but it is not on the review path — moved out of 2.3 into its own small patch after the new RPC is proven.
2. `src/utils/slugMigration.ts` / `slugMigrationPreview.ts` — parent-unaware admin backfill tools, retired in 2.5.
3. `steps/StepTwo.tsx` and `CategorySelector.tsx` still unreferenced from 2.1, deleted in 2.5.

## Creation-service audit (the thing both reviews asked for first)

`src/services/enhancedEntityService.ts` is the module to reuse. `createEntityQuick` already sets `created_by` from the session, sends no slug, and returns the inserted row; `entities_enforce_creation` enforces `created_by` server-side and `approval_status` defaults apply. Review-subject creation calls the new `create_entity_subject` RPC from inside this same service rather than inserting directly, so there is still one creation module and no review-only persistence layer.

`CreateEntityDialog` (admin) stays out of the review flow. `check-entity-duplicates` provides advisory preflight candidates only — the RPC in step 6 is the authority.

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

*The fix: one atomic server-side create-or-resolve.* A new SECURITY DEFINER RPC owns the exact-identity boundary. Identity inputs are explicit parameters, not smuggled inside metadata, since they are real columns:

```text
create_entity_subject(
  p_name, p_type, p_parent_id,
  p_api_source, p_api_ref, p_website_url,
  p_metadata  -- whitelisted keys only
)

authenticate  auth.uid() present, else reject
validate      canonical type; approved pair; bounded input sizes
lock          pg_advisory_xact_lock(<64-bit key>)
check         exact existing match
              found → return (entity, created = false)
              none  → insert → return (entity, created = true)
```

All inside one transaction. B waits on A's lock, then finds A's row and returns it. Result: one entity, both callers get the same id — the acceptance criterion actually holds rather than being asserted. No new `UNIQUE(parent_id, type, normalized_name)` constraint: that needs a canonical normalized-name column, null-parent partial semantics, and a backfill decision over existing data — schema policy well beyond this phase. The advisory lock is targeted and reversible.

The lock key is a 64-bit digest of a delimiter-joined tuple (`parent_id || '\x1f' || canonical_type || '\x1f' || normalized_name`), not a 32-bit `hashtext` of concatenated strings, so distinct identities can't collide into one lock or blur across field boundaries.

The lock is only taken where identity is well-defined (an offering under a provider). Standalone name-only creation takes no lock and is never force-merged.

**6b. The RPC is a security boundary, not a convenience wrapper**

This is the blocking correction both reviews converge on, and I agree with it. `assertValidOfferingPair()` is TypeScript: it protects the UI, not the database. A SECURITY DEFINER function that accepts `type` and `parent_id` must independently enforce the contract it exposes, because anyone with the anon key can call it directly.

Enforced in SQL, inside the function:

- **Auth required** — `auth.uid()` must be present; otherwise reject. No anonymous catalog writes through this path.
- **Server owns provenance** — `created_by = auth.uid()`, `metadata.created_from = 'review_form'`, and moderation/approval fields are set by the function and merged *last*, so caller metadata can never override them. Caller metadata is whitelisted to a small set of harmless descriptive keys; anything else is dropped rather than merged.
- **Canonical type** — must be one of the 15 canonical types, and one of the types this phase actually exposes for quick-create.
- **Parentless** — allowed only for the standalone types this phase supports (including standalone product). Parentless `food` is rejected.
- **Parented** — the parent row is loaded and must exist, be active (not soft-deleted), and form an approved pair: `place → food` or `brand → product`. Every other combination is rejected.
- **Bounded inputs** — name length, website/API ref length, metadata size all capped.
- **Hardened surface** — explicit owner, pinned `search_path`, `REVOKE ... FROM PUBLIC` and `GRANT EXECUTE TO authenticated` only — the same discipline used for the Phase 2.2 slug helpers.

The SQL allow-list duplicates two pairs from the registry, deliberately: the database does not need to understand provider/offering semantics in general, only the creation capability this RPC exposes. A parity test asserts the SQL pairs and the production registry cannot drift apart silently.

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

**9. Brand edge-function slug cleanup — moved out of this phase**

Both reviews are right: `create-brand-entity` is not on the review quick-create path, so removing its slug loop here only adds regression surface. It becomes a separate small patch after the RPC is proven.

## One thing I'd add on top of both reviews

- **Prove the lock, don't assume it.** The advisory lock is now the single thing standing between this feature and duplicate dishes, so it needs a real concurrency test, not a unit test with a mocked client: two overlapping `create_entity_subject` calls for the same parent+type+name, asserting one row in `entities` and the same id returned twice, plus `created = true` exactly once. Alongside that, direct tests of `exactIdentity.ts` (same api_ref with matching type → exact; same api_ref with conflicting type → integrity error, not merge; same website different type → possible; same dish under same place → exact; two "Central Cafe" places → possible; "Classic Burger" vs "Classic Cheese Burger" → possible), a SQL/Deno parity test on the predicate, and a test that an unrecognized constraint violation propagates as failure instead of fake success.

## Explicitly unchanged

Four wizard steps. "Skip for now" stays (removed in 2.4) — it is also the fallback while `search-or-create` is still being proven. No `entity_id NOT NULL`, no `UNIQUE(parent_id, type, normalized_name)`, no data migration, no Step 3 fallback removal, no questionnaire redesign, no legacy component deletion, no changes to composer creation, existing reviews, or recommendation categories. No new registry pairs. External API results stay `existingOnly` in review mode.

## Acceptance criteria

Existing subject search still works; standalone creation works; food creation requires a place and produces a hierarchical slug from the trigger; product-under-brand works and brand-less product is standalone with no pair assertion; `service` quick-create is absent and no code asserts it needs a provider; **the RPC itself rejects unapproved pairs (place → book, movie → food, professional → product), parentless food, deleted or wrong-type parents, and anonymous callers — verified by direct RPC calls that bypass the UI**; **caller-supplied `created_by`, moderation status or `created_from` cannot override server-set values**; **a parity test asserts the SQL allow-list matches the TypeScript registry**; exact matches offer only "Review this" while possible matches offer both actions; standalone name-only matches are never exact; website/API matches never merge incompatible types; **two concurrent "Classic Burger at Truffles" creates produce exactly one row and return the same id to both callers**; an unrecognized unique-constraint violation fails loudly instead of resolving; success auto-selects via `handleSubjectChange`; the draft survives open, cancel, mode-switch, failure and success; Skip still available; composer unchanged.

## Files touched

New migration for `create_entity_subject` (advisory-locked create-or-resolve, hardened as below) and the SQL normalized-name helper. New `supabase/functions/_shared/exactIdentity.ts`. `steps/SubjectSelectStep.tsx`, new `steps/SubjectQuickCreate.tsx`, `ReviewForm.tsx`, `enhancedEntityService.ts` (routes review-subject creation through the RPC), `supabase/functions/check-entity-duplicates/index.ts` (exact/possible classification), `supabase/functions/log-search-funnel/allowlists.ts`. `create-brand-entity/index.ts` is **not** touched in this phase.


## Out of scope

Requiring a subject (2.4). Legacy cleanup (2.5). Config-driven questionnaires (Phase 3). Image/metadata enrichment for created subjects, menu ingestion, cuisine/concept multi-classification.
