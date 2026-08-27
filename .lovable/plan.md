# Roadmap reorder + Phase 2.2 — Parent-aware slug foundation

## I agree with Codex, and the database confirms it

I checked the actual slug functions rather than taking either of us on trust. The findings are worse than the discussion assumed:

- `generate_entity_slug_on_insert` (the BEFORE-INSERT trigger) calls the **one-argument** `generate_entity_slug(name)`, which has **no parent awareness at all**. Every newly inserted child gets a flat slug.
- There are **two overloads** of `generate_entity_slug`. Only the two-argument one is parent-aware, and it hardcodes `parent_type = 'brand' AND current_type = 'product'` — so `place → food` is excluded in SQL even though the TypeScript registry allows it.
- The two-argument overload resolves `parent_id` by **looking the row up by id**, which cannot work during a BEFORE INSERT (the row isn't there yet). It is effectively an after-the-fact repair function, not a creation rule.
- Result today: creating "Classic Burger" under Truffles yields `classic-burger`; a second one under Joe's Burgers yields `classic-burger-1`. Meaningless URLs, and `fix_duplicate_slugs` would then try to strip that `-1` suffix and collide.
- Only `setEntityParent` (`entityHierarchyService.ts:216`) uses the correct `buildHierarchicalSlug`. No client creation path uses it — `enhancedEntityService`, `entityCreationService`, `entityProductService`, `recommendation/entityOperations`, and the admin `CreateEntityDialog` all rely on the flat trigger.

So enforcing required subjects now would be building on sand, and Codex's reorder is right.

## On your entity-creation question

Reuse the existing creation engine; do not build a second one. But do not embed the full admin dialog in the review form either — a reviewer adding a burger should not fill in website, contact, images and taxonomy. The split: **one shared creation service and one shared slug/duplicate rule, two UIs** (full in Explore/Admin, minimal in the review form). That work is Phase 2.3, and it depends on 2.2 landing first.

## New roadmap

| Phase | Scope |
|---|---|
| 2.2 (next) | Parent-aware hierarchical slugs — DB + shared client rule. No visible UX change. |
| 2.3 | Shared creation contract + lightweight "Add something new" in the review form, incl. dish-under-place. |
| 2.4 | Subject required for new reviews; remove "Skip for now". |
| 2.5 | Wizard simplification; delete `StepTwo.tsx`, `CategorySelector.tsx`, redundant Step 3 fields. |
| separate | V4 `?tab=children` deep-link (Phase 1 polish). |

`StepTwo.tsx` and `CategorySelector.tsx` stay untouched until 2.5 — they are unreferenced by the review flow but deleting them mid-sequence buys nothing and loses a rollback path.

## Phase 2.2 scope

**Rule: Option A — hierarchical slug for every entity with a `parent_id`.** `parent_id` is a generic edge; duplicating the TypeScript offering registry in SQL would need a migration per new pair, which Phase 0 explicitly ruled against. Any parent qualifies its child's slug.

**Migration**
- Drop the confusing one-argument `generate_entity_slug(name)` overload after repointing its callers, so a single function owns the rule.
- Make the parent-aware function take the parent id explicitly instead of re-reading the row, and remove the `brand`/`product` hardcoding: any non-null parent with a non-empty slug qualifies.
- Rewrite `generate_entity_slug_on_insert` to pass `NEW.parent_id`, so a parented insert behaves exactly like create-then-reparent. Existing behaviour preserved: a caller-supplied non-empty `slug` is still respected untouched.
- Keep the existing collision loop and the `entity_slug_history` check, so old URLs still resolve and a genuine duplicate under the same parent gets a deterministic `-2`.
- Fix `fix_duplicate_slugs`: it currently strips `-N` suffixes using the non-parent-aware path and could reintroduce collisions. Restrict it to entities without a parent, or route it through the parent-aware function.
- **No backfill of existing rows.** Existing slugs keep resolving; renaming child URLs retroactively would churn indexed URLs for no user benefit.

**Client**
- Route every creation path (`enhancedEntityService`, `entityCreationService`, `entityProductService`, `recommendation/entityOperations`, admin `CreateEntityDialog`) through a single helper that, when a `parent_id` is supplied, either uses `buildHierarchicalSlug` or leaves `slug` empty and lets the now-correct trigger own it. One rule, one place — the goal is that no creation path can produce a flat child slug.
- Keep `setEntityParent` as-is; it already matches the rule.

**Decisions recorded in this phase**
- Parent renamed: the child's canonical slug may be regenerated, the old slug goes to `entity_slug_history` and redirects. No automatic mass rename in 2.2.
- Parent deleted (`ON DELETE SET NULL`): the orphan keeps its hierarchical slug and stays resolvable; it is **not** silently re-slugged to flat. Orphan cleanup stays a later admin flow.
- Same-named child twice under one parent: duplicate detection first, deterministic suffix only as a fallback.

**Tests**
- Extend `entitySlug.test.ts` (unit): `place → food`, `brand → product`, and a non-registered parent pair all produce parent-qualified slugs; same name under different parents cannot collide.
- SQL verification against the live database after the migration: insert a child under two different parents in a transaction and confirm both slugs are parent-qualified and distinct, then roll back.

**Not in 2.2:** dish-creation UI, review-form changes, removing Skip, required subjects, questionnaire changes, backfills, `entity_id NOT NULL`, new registry pairs (`place → service`, `professional → service`, `place → product` are approved deliberately in 2.3, not now).

## Main risk

The migration touches a function every entity insert runs through. Mitigation: preserve the caller-supplied-slug early return exactly, change only the empty-slug path, and verify with a rolled-back transaction before reporting.
