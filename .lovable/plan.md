# Phase 2.2 — Parent-aware slug foundation (final, implementation-ready)

Both corrections are accepted. Codex's is more serious than it looks: I read `update_entity_slug` and it changes the diagnosis of the original bug.

## The finding that ties everything together

`update_entity_slug` (BEFORE UPDATE) does this when `parent_id` changes:

```sql
NEW.slug := generate_entity_slug(NEW.name, NEW.id);
```

It **overwrites whatever slug the caller sent**. So `setEntityParent`'s carefully built `buildHierarchicalSlug` value is computed, sent, and then silently discarded by the trigger — which then applies the `brand`/`product`-only rule. That is the real reason only brand→product URLs are hierarchical: the TypeScript path never actually won. The database has been the authority all along; it was just the wrong authority. Making the database the *deliberate* authority is therefore a clarification of reality, not a new architecture.

Consequences folded into scope:

- `update_entity_slug` is in scope and must route through `generate_entity_slug_v2` with `current_entity_id` and `parent_id` passed separately.
- Its Case 1 also fires on **name change**, so a renamed child re-qualifies under its parent and records history. Renaming a *parent* still touches only the parent's own row — no descendant cascade exists and none is added.
- Its Case 2 (direct slug edit) preserves the supplied slug with **no availability check at all** — the same history-stealing loophole ChatGPT identified on the insert path. Same fix, same place.

## Supplied-slug contract — normalization separated from availability

ChatGPT is right that "verbatim" and "checked against history" were being conflated. The rule:

| Case | Normalization | Collision behaviour |
|---|---|---|
| Generated (no slug supplied), no parent | canonical rule | deterministic `-2`, `-3` |
| Generated, parent present | qualified under parent | deterministic `-2`, `-3` |
| **Supplied, no parent** | **none — literal value preserved** | **rejected on collision with `entities.slug` or `entity_slug_history.old_slug`** |
| Supplied, parent present | qualified under parent first | then the generated path's suffixing |

An explicit slug never quietly mutates under the caller — it either lands exactly as asked or fails loudly. And the previously-open ability for a new entity to claim a live redirect URL is **deliberately closed here**; that is a behaviour change, stated plainly rather than described as byte-identical.

## Generator contract

```text
generate_entity_slug_v2(
  name              text,
  current_entity_id uuid,   -- excluded from collision checks (self)
  parent_id         uuid,   -- controls qualification
  requested_slug    text default null
)
```

Never conflate the two ids: without `current_entity_id`, reparenting sees the entity's own slug and appends `-2`. Every collision check uses `IS DISTINCT FROM`, fixing the existing NULL-unsafe `entity_slug_history` comparison that today disables the history check entirely on inserts.

## Normalization contract

Canonical = `slugifyEntityName` **plus NFKD transliteration** (matching `slugifyBrandName`, which already does this correctly). Verified current behaviour:

```text
"Joe's Burgers"   TS → joes-burgers   SQL → joe-s-burgers   (diverge)
"Café Déjà Vu"    both → caf-dj-vu                          (agree, both wrong)
"東京"             both → ""                                  (empty)
```

Postgres reproduces it via `unaccent`, which is available but not installed — the migration enables it. Because the functions are `SECURITY DEFINER` with `SET search_path`, `unaccent` is called **schema-qualified** and its schema is included in the function's `search_path`; interactive success proves nothing about resolution inside the definer context, so a test asserts it.

`unaccent` and JS NFKD are not identical for every script. The parity suite therefore defines the supported contract by **explicit fixtures**, not by claiming universal equivalence; anything that still normalizes to empty takes the deterministic fallback.

Deterministic non-empty fallback (never random, stable across regeneration):

```text
parentless, empty      → entity-<first 8 of NEW.id>
parented, empty child  → <parentSlug>-item-<first 8 of NEW.id>
```

A child can never collapse to its parent's slug.

## Migration scope

- Add `generate_entity_slug_v2` with the signature above; preserve `SECURITY DEFINER`, `SET search_path`, ownership and grants exactly as the current functions have them (a new signature is a new function, not a `CREATE OR REPLACE`).
- Enable `unaccent`; apply the canonical normalization to newly generated slugs only.
- Rewrite `generate_entity_slug_on_insert` to pass `NEW.parent_id` and apply the supplied-slug table.
- Rewrite `update_entity_slug` to call v2 with both ids in Cases 1 and 3, and to add the missing availability validation in Case 2. History recording stays as-is.
- Remove the `parent_type = 'brand' AND current_type = 'product'` hardcoding — any non-null parent with a non-empty slug qualifies. SQL stays free of provider/offering semantics; the TypeScript registry alone governs which relationships a user may create.
- Fix `fix_duplicate_slugs` (currently strips `-N` through the non-parent-aware path): restrict to parentless entities or route through v2.
- **Do not drop** the one-argument `generate_entity_slug(name)`. Audit every database-side consumer first — triggers, SQL functions, RPCs, edge functions, maintenance jobs, `fix_duplicate_slugs`, `migrate_to_hierarchical_slugs`, `preview_hierarchical_migration`. Until that is clean it becomes a thin wrapper delegating with NULL ids.
- **No backfill.** The 39 existing `brand → product` children (7 hierarchical) keep their URLs.

## Behaviour after 2.2

```text
Interstellar                       → interstellar
Café Déjà Vu                       → cafe-deja-vu
Truffles / Classic Burger          → truffles-classic-burger
Joe's Burgers / Classic Burger     → joes-burgers-classic-burger
Café + Cafe under one parent       → ...-cafe and ...-cafe-2
reparent to Joe's Burgers          → re-qualified, old slug in history
rename Truffles → Truffles Cafe    → children UNCHANGED (no cascade)
delete Truffles (SET NULL)         → child keeps truffles-classic-burger
```

A slug is a durable identifier minted at creation, not a live rendering of the hierarchy — hence no descendant cascade on parent rename. Reparenting the child *is* structural, so it re-qualifies and keeps history.

## Client scope

- Ordinary creation paths (`enhancedEntityService`, `entityCreationService`, `entityProductService`, `recommendation/entityOperations`, admin `CreateEntityDialog`) send `name` + `parent_id` and stop manufacturing a slug.
- `setEntityParent` stops sending a computed slug too — it was already being overwritten. `buildHierarchicalSlug` remains for previews and tests.

## Creation-service audit (deliverable, no refactor)

Which service Phase 2.3 should call, and confirmation of: minimum payload; `parent_id` at insert time; server-side authorization; duplicate handling; canonical type validation; creation source; moderation/status defaults; and whether it returns `id, slug, type, parent_id` immediately. No new abstraction if one already qualifies.

## Tests and verification

Unit (`entitySlug.test.ts` + new parity suite):
- `place → food`, `brand → product`, unregistered parent pair all qualify; same name under different parents cannot collide.
- SQL↔TypeScript parity over explicit fixtures: apostrophes, ampersands, punctuation-only, repeated whitespace/hyphens, casing, accents, non-Latin, empty-after-normalization.

Live database, in a rolled-back transaction:
- generated slug already taken by an unrelated live entity → deterministic `-2`, nothing overwritten;
- generated slug present only in `entity_slug_history` → not reused;
- parentless supplied slug preserved literally; the same slug colliding with a live or historical slug → **rejected**, not suffixed;
- parented flat supplied slug → qualified;
- `NEW.id` is populated during BEFORE INSERT, so the empty-name fallback is deterministic;
- "Café" and "Cafe" under the same parent → `-cafe` and `-cafe-2`; under different parents → no collision;
- `unaccent` resolves inside the `SECURITY DEFINER` / restricted `search_path` context;
- update paths: rename, reparent, unparent (`parent_id → NULL`), direct slug edit — each produces the expected slug, records history, and never self-collides into `-2`.

Then full Vitest run, `tsgo --noEmit`, clean build log — and stop with the migration verification plus the creation-service audit before Phase 2.3.

## Phase 2 roadmap (unchanged)

| Phase | Scope |
|---|---|
| **2.2 (this)** | Parent-aware slugs, insert + update paths, normalization parity. No UX change; "Skip for now" stays. |
| 2.3 | "Can't find it? → Add something new" in Step 2: standalone entities plus `place → food` and `brand → product` only. Duplicate detection before creation, draft preserved, auto-select on success. No speculative registry pairs. |
| 2.4 | Subject required for new reviews; remove Skip; submit-time guard. Legacy entity-less reviews stay readable and editable. No `entity_id NOT NULL`. |
| 2.5 | Cleanup: delete `StepTwo.tsx`, `CategorySelector.tsx`, the Step 3 fallback, obsolete handlers; collapse/reorder steps. |
| separate | V4 `?tab=children` deep-link. |

## Main risk

These triggers run on every entity insert and update. Mitigation: changes confined to the parented, empty-slug and supplied-slug branches; the old overload survives as a wrapper; history recording untouched; every case above verified in a rolled-back transaction before reporting.
