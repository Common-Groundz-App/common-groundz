# Phase 2.2 — Parent-aware slug foundation (final plan) + revised Phase 2 roadmap

## Where I land

Codex and ChatGPT agree with each other and with me on the substance; ChatGPT's two adjustments are the right ones and are now folded in:

1. **No speculative registry pairs.** 2.3 ships `place → food` (and `brand → product`, which already exists in production). `place → service`, `professional → service`, `place → product` are product decisions, not plumbing — they wait.
2. **No pre-emptive "shared creation contract" refactor.** 2.2 *audits* the existing creation services and answers one question: can the review form call them with a minimal payload safely? Refactor only if the answer is no.

Your observation is exactly right, and the database confirms the cause.

## Verified findings (queried, not assumed)

- The BEFORE-INSERT trigger `generate_entity_slug_on_insert` calls the **one-argument** `generate_entity_slug(name)`, which has **no parent awareness at all**. Every newly inserted child gets a flat slug.
- There are **two overloads** of `generate_entity_slug`. Only the two-argument one is parent-aware, and it hardcodes `parent_type = 'brand' AND current_type = 'product'` — which is precisely why only brand/product URLs look like `skin1004/madagascar-...`.
- That overload resolves `parent_id` by looking the row up **by id**, so it cannot work during a BEFORE INSERT (the row doesn't exist yet). It is an after-the-fact repair function, not a creation rule.
- Consequence today: "Classic Burger" under Truffles becomes `classic-burger`; a second under Joe's Burgers becomes `classic-burger-1`. Meaningless URLs — and `fix_duplicate_slugs` then tries to strip that `-1`, which can collide.
- Only `setEntityParent` (`entityHierarchyService.ts:216`) uses the correct `buildHierarchicalSlug`. No creation path does: `enhancedEntityService`, `entityCreationService`, `entityProductService`, `recommendation/entityOperations` and the admin `CreateEntityDialog` all depend on the flat trigger.
- **Compatibility check on Option A:** the only parented pair that exists in the database is `brand → product` (39 rows, 7 already hierarchical). No other hierarchy exists, so making the rule generic cannot break an existing one. That is the verification ChatGPT asked for, and it passes.

## Revised Phase 2 roadmap

| Phase | Scope |
|---|---|
| **2.2 (next)** | Parent-aware hierarchical slugs, generic over any `parent_id`. Creation-service audit, no refactor. No visible UX change. "Skip for now" stays. |
| 2.3 | "Can't find it? → Add something new" inside Step 2: standalone entities + `place → food` and `brand → product` offerings. Duplicate detection before creation, draft preserved, auto-select on success. Reuses existing creation services. |
| 2.4 | Subject required for new reviews; remove "Skip for now"; submit-time guard. Legacy entity-less reviews stay readable and editable. Still no `entity_id NOT NULL`. |
| 2.5 | Cleanup only: delete `StepTwo.tsx`, `CategorySelector.tsx`, the Step 3 entity-selection fallback, obsolete handlers and compatibility branches; collapse/reorder steps. |
| separate | V4 `?tab=children` deep-link (Phase 1 polish). |

Cleanup stays in 2.5 deliberately — no behaviour change and file deletion in the same phase.

## Phase 2.2 scope

**Rule: any entity with a valid `parent_id` gets a parent-qualified slug.** SQL stays semantics-free; the TypeScript relationship registry keeps deciding which relationships a *user* may create. That split is what makes a new pair a registry row instead of a migration.

**Migration**
- Repoint callers off the one-argument `generate_entity_slug(name)` overload and drop it, so one function owns the rule.
- Change the parent-aware function to take the parent id **explicitly** rather than re-reading the row, and remove the `brand`/`product` hardcoding: any non-null parent with a non-empty slug qualifies its child.
- Rewrite `generate_entity_slug_on_insert` to pass `NEW.parent_id`, so inserting with a parent and reparenting later produce identical slugs. Unchanged: a caller-supplied non-empty `slug` is still respected untouched.
- Keep the existing collision loop and the `entity_slug_history` lookup, so old URLs keep resolving and a genuine same-parent duplicate still gets a deterministic `-2` as a **last resort**, not as the duplicate strategy.
- Fix `fix_duplicate_slugs`, which currently strips `-N` via the non-parent-aware path: restrict it to parentless entities or route it through the parent-aware function.
- **No backfill.** The 32 existing flat brand/product children keep their slugs and URLs; retroactively renaming indexed URLs buys the user nothing.

**Client**
- Route every creation path (`enhancedEntityService`, `entityCreationService`, `entityProductService`, `recommendation/entityOperations`, admin `CreateEntityDialog`) through one helper: with a `parent_id`, either use `buildHierarchicalSlug` or leave `slug` empty and let the now-correct trigger own it. The goal is that no creation path *can* emit a flat child slug.
- `setEntityParent` already matches the rule and stays as-is.

**Creation-service audit (deliverable, not a refactor)**
A short written answer to: which service is the safest single entry point for review-form creation; what its minimum required payload is; whether it enforces duplicate detection, moderation status and creation source server-side; and whether a `parent_id` can be passed at insert time. If it already supports a minimal payload, 2.3 calls it directly.

**Recorded decisions**
- Parent renamed: the child's canonical slug may be regenerated, the old slug lands in `entity_slug_history` and redirects. No mass rename in 2.2.
- Parent deleted (`ON DELETE SET NULL`): the orphan keeps its hierarchical slug and stays resolvable — never silently flattened. Orphan cleanup is a later admin flow.
- Same name twice under one parent: duplicate detection first (2.3 wires the UI), suffix only as fallback.

**Tests**
- Extend `entitySlug.test.ts`: `place → food`, `brand → product`, and an unregistered parent pair all produce parent-qualified slugs; the same name under different parents cannot collide.
- Post-migration SQL verification in a rolled-back transaction: insert the same-named child under two different parents and confirm both slugs are parent-qualified and distinct; confirm a caller-supplied slug is still honoured.

**Not in 2.2:** any review-form change, dish-creation UI, removing Skip, required subjects, questionnaire changes, backfills, `entity_id NOT NULL`, new registry pairs.

## Main risk

The migration sits on the path of every entity insert. Mitigation: preserve the caller-supplied-slug early return byte-for-byte, change only the empty-slug branch, and verify with a rolled-back transaction plus the unit suite before reporting.
