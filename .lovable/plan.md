
# Phase 3.2 (final v3) — Draft-driven Review UI, admin-only, flag-gated

Final approved plan. Identical to v2 with two small implementation refinements folded in (C6 from ChatGPT, C7 from Codex). No product changes.

## Verified in the codebase
- Parent-brand links use the existing `parent_id` column on `entities`, exposed in `CreateEntityDialog.tsx` as `selectedParent: Entity | null` and persisted via `setEntityParent` (`src/services/entityHierarchyService.ts`).
- No `brand_id` column, no `brand_status` column anywhere.
- Phase 3.2 ships zero migrations and zero new columns.

---

## Strict rules (unchanged)

1. Flag OFF → existing `AutoFillPreviewModal` behavior **byte-identical**.
2. **Apply** is the only code path that calls `create-brand-entity` or writes an entity.
3. Cancel/close at any point → zero `create-brand-entity` calls, zero entity writes, zero storage writes.

---

## BrandDecision → existing fields (C5, unchanged from v2)

`BrandDecision` is a conceptual UI model. Apply translates it to the existing write surface:

| `BrandDecision.kind` | `parent_id` | `selectedParent` | `metadata.brand_status` |
|---|---|---|---|
| `existing` | `decision.entityId` | matched `Entity` | **omit** (C6) |
| `create_new` (confirmed) | id from `create-brand-entity` | returned `brandEntity` | **omit** (C6) |
| `not_sure` | `null` | `null` | `'unknown'` |
| `not_listed` | `null` | `null` | `'unknown'` |
| `not_applicable` | `null` | `null` | `'not_applicable'` |

---

## C6 (ChatGPT) — Safe metadata merge, no contradictions

Single helper in `DraftReviewBody`:

```ts
function mergeBrandStatusIntoMetadata(
  base: Record<string, unknown>,
  decision: BrandDecision,
): Record<string, unknown> {
  const next = { ...base };
  if (decision.kind === 'existing' || decision.kind === 'create_new') {
    // Real parent brand set → never carry a brand_status flag.
    delete next.brand_status;
    return next;
  }
  if (decision.kind === 'not_applicable') {
    next.brand_status = 'not_applicable';
  } else {
    // not_sure | not_listed
    next.brand_status = 'unknown';
  }
  return next;
}
```

Rules:
- Spread the existing metadata first — never replace it.
- When `parent_id` is set, **delete** any stale `brand_status` key so the row is internally consistent.
- Only ever read/write the single `brand_status` key inside `metadata`; never touch other keys.

---

## C7 (Codex) — Apply handler avoids React state race

Problem: `setSelectedParent(x)` + `setFormData({...})` + `handleCreate()` in the same tick would call `handleCreate()` with stale state.

Fix: thread resolved values **directly** into the existing create path. Do not rely on React state having flushed.

Two-part change:

1. **Refactor the existing create function in `CreateEntityDialog.tsx`** to accept an optional `overrides` object:
   ```ts
   interface CreateEntityOverrides {
     selectedParent?: Entity | null;
     metadata?: Record<string, unknown>;
     imageUrl?: string | null;
   }
   async function handleCreateEntity(overrides?: CreateEntityOverrides) { ... }
   ```
   When `overrides` is provided, use those values **in place of** the component state for `parent_id`, `metadata`, and `image_url`. When absent, behavior is identical to today (legacy path untouched).
   - Touches the two existing write sites (`CreateEntityDialog.tsx:1832` and `:2475`).
2. **`DraftReviewBody.handleApply`** computes everything locally (no state writes required), then calls `handleCreateEntity(overrides)` directly:
   ```ts
   const resolvedParent = await resolveParent(decision); // may call create-brand-entity once
   const resolvedMetadata = mergeBrandStatusIntoMetadata(currentMetadata, decision);
   const resolvedImageUrl = imageSelection.primaryUrl;
   await handleCreateEntity({
     selectedParent: resolvedParent,
     metadata: resolvedMetadata,
     imageUrl: resolvedImageUrl,
   });
   ```
   `DraftReviewBody` **may also** call `setSelectedParent(resolvedParent)` for UI consistency after Apply, but the write itself never depends on that state having flushed.

Result: Apply is deterministic and synchronous from the write's point of view, regardless of React's batching.

---

## All four previous corrections still hold

- **C1**: Cancel of create-new confirm panel resets `decision` to `null` (neutral); Apply surfaces "Please choose a brand option".
- **C2**: "Not sure" + Apply **still creates the entity** with `parent_id = null`, `metadata.brand_status = 'unknown'`.
- **C3**: One-click Apply only safe when recommended decision is `matched_existing` or `not_applicable`. `suggested_new` requires explicit confirm.
- **C4**: maccaron.in validation does not hardcode an expected brand candidate name.

---

## Deliverables (unchanged from v2 except C6 + C7 wiring)

1. **Trace observability** — add `entityDraftStatus` to the existing `[analyze-entity-url-v2] trace` summary log. No behavior change.
2. **Feature flag** — add `'entity_extraction.review_uses_draft'` to `ALLOWED_KEYS` in `src/hooks/admin/useAppFlagsAdmin.ts`; seed via `app_config` insert defaulting to `{ enabled: false }`; new hook `useEntityReviewUsesDraft()` returns `false` for non-admins and during loading.
3. **`BrandPicker`** (`src/components/admin/entity-create/BrandPicker.tsx`, new) — explicit-decision model, never calls `create-brand-entity`, suggested-new requires confirm.
4. **`ImageCandidateGrid`** (`src/components/admin/entity-create/ImageCandidateGrid.tsx`, new) — primary + gallery-ready (gallery disabled this phase), URLs byte-identical.
5. **`DraftReviewBody`** (`src/components/admin/entity-create/DraftReviewBody.tsx`, new) — composes BrandPicker + ImageCandidateGrid + editable fields; Apply path uses `mergeBrandStatusIntoMetadata` (C6) and passes overrides directly into `handleCreateEntity` (C7).
6. **`AutoFillPreviewModal`** — internal flag branch only; legacy JSX untouched.
7. **`CreateEntityDialog`** — refactor existing create function to accept `overrides` (C7); delete `autoCreateParentBrand` function body.
8. **`useEntityReviewUsesDraft`** hook (new).
9. **`app_config`** row insert (default `{ enabled: false }`).
10. **`.lovable/plan.md`** — replace with this v3 plan.

**No DB migrations. No new columns. No new secrets. No new external APIs. No non-admin UI changes.**

---

## Validation (v2 list + 2 new for C6/C7)

1. Flag OFF: analyzing maccaron.in renders today's modal byte-identically.
2. Flag ON: `BrandPicker` renders all `entityDraft.brandCandidates` (no hardcoded names — C4).
3. Safe preselected path (C3) `matched_existing` → one-click Apply succeeds.
4. Unsafe preselected path (C3) `suggested_new` → card highlighted, `decision = null`, Apply blocked until confirm.
5. Existing brand → entity created with `parent_id = decision.entityId`; **zero `create-brand-entity` calls**.
6. Create-new happy path → exactly one `create-brand-entity` call with `confirmCreate: true`; entity created with new brand's `parent_id`.
7. Create-new cancel-then-recover (C1) → suggested_new → Cancel → card deselects → Apply errors → pick "Not sure" → Apply succeeds; **zero `create-brand-entity` calls**.
8. Modal-close cancel → zero writes at any state.
9. "Not sure" (C2) → entity created with `parent_id = null`, `metadata.brand_status = 'unknown'`; zero `create-brand-entity`.
10. "Not applicable" → `parent_id = null`, `metadata.brand_status = 'not_applicable'`.
11. "Brand not listed" → `parent_id = null`, `metadata.brand_status = 'unknown'`.
12. Non-product entity type → defaults to `not_applicable` collapsed; one-click Apply.
13. Image byte-identity → created entity's `image_url` byte-identical to selected tile.
14. "None of these" + upload → existing upload path still works.
15. Gallery checkboxes disabled with tooltip; `galleryUrls` = `[]` on Apply.
16. Race-safe `create-brand-entity` → simulated `status: 'existing_found'` response → entity still created cleanly with returned id.
17. Trace log → `entityDraftStatus` present in every analyze trace.
18. Schema discipline (C5) → `rg "brand_id"` and `rg "brand_status"` show **no new column additions**; `brand_status` only appears as a metadata key string.
19. Dead code → `rg "autoCreateParentBrand"` returns zero hits.
20. **Metadata merge safety (C6)** → analyze populates `metadata` with rich extracted fields; Apply with "Not sure" → created entity's `metadata` contains BOTH the analyze-derived keys AND `brand_status: 'unknown'`. Apply with `existing` brand → created entity's `metadata` contains analyze-derived keys and **does NOT contain `brand_status`** (no contradictory state).
21. **State-race safety (C7)** → instrument `handleCreateEntity` to log the `parent_id` it actually writes. Trigger Apply with `existing` brand on first click (no prior state warmup). Logged `parent_id` matches `decision.entityId` exactly, on the very first invocation, regardless of React batching.

---

## Out of scope (deferred)

- Multi-select gallery write path → 3.3
- Dedupe edge function, soft-publish, admin moderation queue → 3.3
- Non-admin rollout, RLS changes → 3.4
- Search / Lens / Barcode adapters → 3.5–3.7
- Promoting `brand_status` to a real column → only if/when a read surface needs to filter on it, in a separate phase with its own migration review.

---

## Risk

**Low.** Flag default OFF, legacy JSX untouched, Apply sole write path, zero schema changes, zero new columns. C6 (metadata merge) is a 12-line pure helper. C7 (overrides param) is a minimal additive refactor — `overrides === undefined` keeps today's call sites byte-identical.

Ready to start on approval.
