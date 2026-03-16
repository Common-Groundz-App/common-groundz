

# Assessment: RPC Signature Rollout Safety

Already covered. The plan uses `rec.entity_slug || undefined` on the frontend, which safely handles `undefined`/`null` if the migration hasn't run yet. This means:

- **Before migration runs**: `rec.entity_slug` is `undefined` → falls back to `undefined` → `getEntityUrlWithParent` uses the entity ID (current behavior, no regression)
- **After migration runs**: `rec.entity_slug` has the real slug → clean URLs

No additional changes needed. The plan is ready to implement as-is.

