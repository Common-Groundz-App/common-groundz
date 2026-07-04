## Fix "Open Existing" navigation + brand orange styling

Two small changes to the exact-URL preflight duplicate flow.

### 1. `src/components/admin/CreateEntityDialog.tsx` — `onOpenExisting`

Current handler calls `onEntityCreated(...)` which bubbles up as the parent's "Entity created" toast and does no navigation. Replace it with a direct `react-router` navigation to the existing entity page (`navigate` and `useNavigate` are already imported and initialized in this file).

Replace the `onOpenExisting` prop on `<ExactUrlDuplicateDialog>` (around lines 2935–2946) with:

```tsx
onOpenExisting={(c) => {
  setPreflightDupOpen(false);
  setPreflightDupCandidates([]);
  setPendingAnalyzeUrl(null);
  resetForm();
  onOpenChange(false);
  toast({ title: 'Opening existing entity', description: c.name });
  navigate(`/entity/${c.slug || c.id}`);
}}
```

`DuplicateCandidate` already exposes `slug` and `id`, matching the pattern used elsewhere in the file (`navigate('/entity/${newEntity.slug}')`, line 2158) and the `getEntityUrl` helper.

### 2. `src/components/admin/entity-create/ExactUrlDuplicateDialog.tsx` — brand-orange "Open Existing" button

The "Open Existing" button currently uses `variant="outline"`. Change it to the app's default primary variant (which is brand orange per the design system) so it stands out as the recommended action:

```tsx
<Button size="sm" onClick={() => onOpenExisting(c)}>
  Open Existing
</Button>
```

(Dropping `variant="outline"` makes it use the default `bg-primary` — brand orange — with white foreground. No hardcoded colors, no token changes.)

### Not touched
- `check-entity-duplicates` edge function, preflight logic, `handleAnalyzeUrl`, `onContinueAnyway`, `onCancel`, the fuzzy `DuplicateConfirmDialog`, or any other file. `onEntityCreated` semantics remain "created a NEW entity", which is what the parent toast reflects.

### Validation
1. Re-analyze the medicube URL → "This URL already exists" dialog appears.
2. Click **Open Existing** → dialog + create modal close, toast "Opening existing entity — ZERO PORE PAD 2.0 70pads (155g)", route changes to `/entity/<slug>`. No misleading "Entity created" toast.
3. **Continue Anyway** and **Cancel** behavior unchanged.
4. Button is visibly brand-orange in both light and dark mode.
