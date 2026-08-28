# Phase 2.2 — Parent-aware slug foundation (final, corrections incorporated)

## My position on the feedback

All four corrections are right and are folded in. On parent rename I agree with ChatGPT's Strategy B, and not just for safety: a child slug is a **stable identifier minted at creation**, not a derived view of its parent's current name. Cascading would mutate potentially hundreds of indexed URLs because someone fixed a typo in a restaurant name, and every one of those becomes a redirect hop. Provider renames are common; child URL churn should not be. So: **parent rename never touches descendant slugs in 2.2**, and a deliberate cascade stays an unmade decision.

I also found two things neither review could have known, both of which matter more than any of the four corrections.

## Two additional findings (verified against the live database)

**1. The TypeScript and SQL slugifiers do not agree.** `slugifyEntityName` *deletes* disallowed characters; the SQL `regexp_replace(name, '[^a-zA-Z0-9]+', '-')` *replaces* them with a dash. For "Joe's Burgers":

```text
TypeScript  → joes-burgers
SQL         → joe-s-burgers   (confirmed by query)
```

So today the same entity gets a different slug depending on whether it was created (SQL trigger) or reparented (`setEntityParent`, TypeScript). That silently breaks the "insert-with-parent and later reparent produce consistent slugs" requirement both reviews asked for, and it makes any client-side preview wrong. **2.2 must align the two into one normalization rule** — I'd move SQL to the TypeScript behaviour (apostrophes deleted, not dashed) since it produces the cleaner URL, apply it to new slugs only, and cover it with a parity test in the same spirit as the existing review-bucket parity test.

**2. The history collision check is NULL-unsafe.** In the parent-aware overload the guard is `h.entity_id != generate_entity_slug.entity_id`. When `entity_id` is NULL (every insert-time call) that comparison is NULL, the `EXISTS` is false, and **`entity_slug_history` is effectively not checked at all** — a new entity can take a slug that an old URL still redirects from. There are 9 history rows today, so the blast radius is small now and grows with every rename. Fix with `IS DISTINCT FROM` / an explicit null branch.

## Final invariant (contradiction resolved)

**The database trigger is the creation-time authority.** Standard creation paths omit `slug` entirely. `buildHierarchicalSlug` stays, but only for previews, reparenting and tests — it no longer decides a persisted slug on ordinary creation.

Caller-supplied slugs, stated precisely:

| Case | Behaviour |
|---|---|
| No parent, no slug | Generate from name |
| No parent, slug supplied | Respect after normalization + uniqueness |
| Parent, no slug | Generate `parentSlug-childName` |
| Parent, slug already correctly qualified | Accept after validation |
| Parent, flat or wrongly qualified slug | Qualify it under the parent — never persist as given |

So the honest claim is: *no normal application creation path can accidentally emit a flat child slug, and an explicit override for a parented entity is qualified rather than trusted blindly.* Trusted admin/import overrides remain possible only for parentless entities.

## Migration scope

- Create the new parent-aware generator taking the parent id **explicitly** (a new function, since changing a signature is not a `CREATE OR REPLACE`), preserving `SECURITY DEFINER`, `SET search_path`, ownership and grants exactly as the current functions have them.
- Rewrite `generate_entity_slug_on_insert` to pass `NEW.parent_id`, and to qualify a supplied slug per the table above instead of returning early on any non-empty slug.
- Remove the `parent_type = 'brand' AND current_type = 'product'` hardcoding — any non-null parent with a non-empty slug qualifies. SQL stays semantics-free; the TypeScript registry keeps deciding which relationships a *user* may create.
- Align the SQL normalization with `slugifyEntityName` (new slugs only).
- Fix the NULL-unsafe `entity_slug_history` comparison.
- Keep the collision loop; `-2` remains last-resort protection, not the duplicate strategy.
- Fix `fix_duplicate_slugs`, which currently strips `-N` through the non-parent-aware path: restrict it to parentless entities or route it through the new generator.
- **Do not drop** the one-argument `generate_entity_slug(name)` overload in this migration. Audit every database-side consumer first — triggers, SQL functions, RPCs, edge functions, maintenance jobs, `fix_duplicate_slugs`, `migrate_to_hierarchical_slugs`, `preview_hierarchical_migration`. If the audit proves zero consumers it can go in a later isolated migration; until then it becomes a thin wrapper delegating with `parent_id = NULL`.
- **No backfill.** The 39 existing `brand → product` children (only 7 already hierarchical) keep their slugs and URLs.

## Recorded behaviour after 2.2

```text
Interstellar                        → interstellar
Truffles / Classic Burger           → truffles-classic-burger
Joe's Burgers / Classic Burger      → joes-burgers-classic-burger
reparent Truffles → Joe's Burgers   → new qualified slug, old slug in history
delete Truffles (SET NULL)          → child keeps truffles-classic-burger
rename Truffles → Truffles Cafe     → child slug UNCHANGED (no cascade)
```

## Client scope

- Ordinary creation paths (`enhancedEntityService`, `entityCreationService`, `entityProductService`, `recommendation/entityOperations`, admin `CreateEntityDialog`) stop sending a computed child slug and let the trigger own it.
- `setEntityParent` keeps using `buildHierarchicalSlug` — valid once the two normalizers agree.

## Creation-service audit (deliverable, no refactor)

A written answer covering: which service Phase 2.3 should call; its minimum payload; whether it accepts `parent_id` at insert time; duplicate detection; creation source and moderation/data-quality metadata; permission enforcement server-side; and whether it returns the created canonical entity immediately. Refactor only if the answer is "it can't do this safely".

## Tests and verification

- Extend `entitySlug.test.ts`: `place → food`, `brand → product`, unregistered parent pair; same name under different parents cannot collide.
- New SQL↔TypeScript slug parity test over a fixture set including apostrophes, ampersands, accents and multiple spaces.
- Rolled-back transaction against the live database: same-named child under two parents (both qualified, distinct); parentless supplied slug respected; parented flat slug gets qualified; a slug matching an existing history row is not reused.
- Full Vitest run, `tsgo --noEmit`, clean build log.

Then stop and report the migration verification plus the creation-service audit before Phase 2.3.

## Phase 2 roadmap (unchanged)

| Phase | Scope |
|---|---|
| **2.2 (this)** | Parent-aware slugs + normalization parity. No UX change; "Skip for now" stays. |
| 2.3 | "Can't find it? → Add something new" in Step 2: standalone entities plus `place → food` and `brand → product` only. Duplicate detection before creation, review draft preserved, auto-select on success, reuses existing services. No speculative registry pairs. |
| 2.4 | Subject required for new reviews; remove Skip; submit-time guard. Legacy entity-less reviews stay readable and editable. No `entity_id NOT NULL`. |
| 2.5 | Cleanup: delete `StepTwo.tsx`, `CategorySelector.tsx`, the Step 3 fallback, obsolete handlers; collapse/reorder steps. |
| separate | V4 `?tab=children` deep-link. |

## Main risk

The trigger runs on every entity insert. Mitigation: the parentless-with-supplied-slug path stays byte-identical in behaviour, changes are confined to the parented and empty-slug branches, the old overload survives as a wrapper, and everything is verified in a rolled-back transaction before reporting.
