# Phase 2.2 — Parent-aware slug foundation (implementation-ready)

All four corrections are accepted. I checked the two disputed points against the live database rather than reasoning about them, and one of them changes the plan.

## 1. Supplied-slug contract — resolved with the actual current behaviour

The current trigger returns early on **any** non-empty supplied slug: it is stored **verbatim**, with no normalization and no uniqueness check. So ChatGPT is right that "normalize + uniqueness" would not have been byte-identical. The contract, stated once:

| Case | Behaviour |
|---|---|
| No parent, no slug | Generate from name |
| **No parent, slug supplied** | **Preserved verbatim — today's contract, unchanged** |
| Parent, no slug | Generate `parentSlug-childName` |
| Parent, slug already correctly qualified under that parent | Accept after validation |
| Parent, flat or wrongly qualified slug | Qualify under the parent — never persisted as given |

Phase 2.2 changes parent awareness only. Redefining custom-slug semantics for parentless entities is out of scope; if that verbatim path is a bug, it is its own isolated change later.

## 2. Generator signature — four separate concepts

```text
generate_entity_slug_v2(
  name              text,
  current_entity_id uuid,   -- excluded from collision checks (self)
  parent_id         uuid,   -- controls qualification
  requested_slug    text    -- default null
)
```

`current_entity_id` and `parent_id` are never conflated. Without the former, reparenting sees the entity's own slug as a collision and appends `-2`. All collision checks use `IS DISTINCT FROM`, so a NULL id can never silently disable a check — which is exactly the existing `entity_slug_history` bug.

## 3. Slugification contract — one canonical rule, and a real problem in it

`slugifyEntityName` is canonical, and SQL must **reproduce** it, not approximate it. But reproducing it as-is would enshrine a bad rule. Verified behaviour today:

```text
"Joe's Burgers"    TS → joes-burgers        SQL → joe-s-burgers      (diverge)
"Café Déjà Vu"     TS → caf-dj-vu           SQL → caf-dj-vu          (agree, both bad)
"東京"              TS → ""                  SQL → ""                 (empty)
```

`slugifyEntityName` never applies NFKD, so accents are **deleted** rather than transliterated. `slugifyBrandName` already does the right thing (`cafe-deja-vu`). 3 live entities have non-ASCII names, so this is real, not theoretical.

So the contract for 2.2 is: **canonical = `slugifyEntityName` + NFKD transliteration**, matching the brand helper. Postgres reproduces it via `unaccent` — available in this project but **not yet installed**, so the migration enables it. Applies to newly generated slugs only; nothing existing is rewritten.

The fixture set both sides must agree on: apostrophes, ampersands, punctuation-only, repeated whitespace, repeated hyphens, leading/trailing punctuation, mixed case, accents, non-Latin scripts, and empty-after-normalization.

## 4. Deterministic non-empty fallback

A name that normalizes to nothing must never yield an empty slug, and a child must never collapse to its parent's slug (which would impersonate the parent). Deterministic, never random, stable across regeneration:

```text
parentless, empty        → entity-<first 8 of entity uuid>
parented, empty child    → <parentSlug>-item-<first 8 of entity uuid>
```

## Migration scope

- Add `generate_entity_slug_v2` with the signature above, preserving `SECURITY DEFINER`, `SET search_path`, ownership and grants as the current functions have them (a new signature is a new function, not a `CREATE OR REPLACE`).
- Enable the `unaccent` extension; align SQL normalization with the canonical contract.
- Rewrite `generate_entity_slug_on_insert` to pass `NEW.parent_id` and apply the supplied-slug table above.
- Remove the `parent_type = 'brand' AND current_type = 'product'` hardcoding — any non-null parent with a non-empty slug qualifies. SQL stays free of provider/offering semantics; the TypeScript registry alone decides which relationships a user may create.
- NULL-safe collision checks against **both** `entities.slug` and `entity_slug_history.old_slug`; `-2`, `-3` remain last-resort suffixes.
- Fix `fix_duplicate_slugs`, which currently strips `-N` via the non-parent-aware path: restrict it to parentless entities or route it through v2.
- **Do not drop** the one-argument `generate_entity_slug(name)`. Audit every database-side consumer first — triggers, SQL functions, RPCs, edge functions, maintenance jobs, `fix_duplicate_slugs`, `migrate_to_hierarchical_slugs`, `preview_hierarchical_migration`. Until that audit is clean it becomes a thin wrapper delegating with NULL ids.
- **No backfill.** The 39 existing `brand → product` children (7 already hierarchical) keep their URLs.

## Behaviour after 2.2

```text
Interstellar                        → interstellar
Truffles / Classic Burger           → truffles-classic-burger
Joe's Burgers / Classic Burger      → joes-burgers-classic-burger
reparent to Joe's Burgers           → re-qualified, old slug in history
delete Truffles (SET NULL)          → child keeps truffles-classic-burger
rename Truffles → Truffles Cafe     → child slug UNCHANGED (no cascade)
```

Parent rename never cascades. A slug is a durable URL identifier minted at creation, not a live rendering of the current hierarchy; cascading would churn indexed URLs because someone fixed a typo. Reparenting the child *is* a structural change, so it re-qualifies and keeps history.

## Client scope

- Ordinary creation paths (`enhancedEntityService`, `entityCreationService`, `entityProductService`, `recommendation/entityOperations`, admin `CreateEntityDialog`) stop manufacturing a child slug and send `name` + `parent_id`; the trigger is the creation-time authority.
- `buildHierarchicalSlug` stays for previews, reparenting and tests — valid once both normalizers agree.

## Creation-service audit (deliverable, no refactor)

Which service Phase 2.3 should call, and confirmation of: minimum payload; `parent_id` at insert time; server-side authorization; duplicate handling; canonical type validation; creation source; moderation/status defaults; and whether it returns the created entity's `id, slug, type, parent_id` immediately. If it already does this, no new abstraction is invented.

## Tests and verification

- `entitySlug.test.ts`: `place → food`, `brand → product`, unregistered parent pair; same name under different parents cannot collide.
- SQL↔TypeScript parity across the full fixture set above.
- Empty-normalization fallback: parentless and parented, deterministic and stable on regeneration; a child never equals its parent's slug.
- Collision cases in a rolled-back transaction against the live database:
  - generated hierarchical slug already taken by an **unrelated live entity** → deterministic `-2`, nothing overwritten;
  - generated slug present only in `entity_slug_history` → not reused;
  - parentless supplied slug preserved verbatim;
  - parented flat supplied slug qualified;
  - reparenting an entity does **not** append `-2` from its own slug.
- Full Vitest run, `tsgo --noEmit`, clean build log.

Then stop and report the migration verification plus the creation-service audit before Phase 2.3.

## Phase 2 roadmap (unchanged)

| Phase | Scope |
|---|---|
| **2.2 (this)** | Parent-aware slugs + normalization parity. No UX change; "Skip for now" stays. |
| 2.3 | "Can't find it? → Add something new" in Step 2: standalone entities plus `place → food` and `brand → product` only. Duplicate detection before creation, review draft preserved, auto-select on success. No speculative registry pairs. |
| 2.4 | Subject required for new reviews; remove Skip; submit-time guard. Legacy entity-less reviews stay readable and editable. No `entity_id NOT NULL`. |
| 2.5 | Cleanup: delete `StepTwo.tsx`, `CategorySelector.tsx`, the Step 3 fallback, obsolete handlers; collapse/reorder steps. |
| separate | V4 `?tab=children` deep-link. |

## Main risk

The trigger runs on every entity insert. Mitigation: the parentless paths keep today's behaviour exactly, changes are confined to the parented and empty-slug branches, the old overload survives as a wrapper, and every case above is verified in a rolled-back transaction before reporting.
