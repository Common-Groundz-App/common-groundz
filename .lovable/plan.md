## Two small fixes in the non-admin entity creation flow

### 1. "Use this" on the duplicate dialog — navigate to the existing entity

**File:** `src/components/admin/CreateEntityDialog.tsx` (the `onUseExisting` handler around line 3037)

Currently the handler:
- fires a generic "Using existing entity" toast,
- calls `onEntityCreated(...)` (which triggers the parent's "entity created" toast — misleading, since nothing was created),
- closes the dialog with no navigation.

Change it to mirror `ExactUrlDuplicateDialog`'s `onOpenExisting` behavior (lines 3069-3077):
- close the duplicate dialog,
- clear pending overrides,
- `resetForm()` + `onOpenChange(false)`,
- `navigate(\`/entity/${c.slug || c.id}\`)`,
- do NOT call `onEntityCreated` and do NOT show the "created" toast. Optional lightweight toast like "Opening existing entity" is fine, but no "entity created" language.

`DuplicateCandidate` already exposes `slug`, so no type changes needed.

### 2. Remove the "Pending review" disclaimer on the entity page

**File:** `src/components/entity-v4/EntityV4.tsx` (lines 507-519)

Remove the `EntityModerationBanner` block entirely so neither the creator nor admins see the yellow "Pending review / This entity is publicly visible but still awaiting admin review…" banner on the entity detail page. The pending state is already communicated in the post-create continuation modal ("Your entity is under review — visible with a Pending badge until an admin approves it."), so the on-page banner is redundant.

We keep `EntityModerationBanner.tsx` on disk untouched (in case it's reused elsewhere) — we only stop rendering it in `EntityV4`.

### Out of scope
- No changes to the "It's different — continue" flow or the PostCreateContinuation modal (user confirmed those are good).
- No database, RLS, or edge function changes.
- No changes to the admin flow behavior beyond what's above (admins also stop seeing the on-page banner, matching the user's "there shouldn't be any disclaimer" ask).
