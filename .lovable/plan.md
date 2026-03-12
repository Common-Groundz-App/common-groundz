

# Phase 2 — Ready to Implement (No Changes)

The plan is final. Both feedback points are already addressed:

1. **Action + surface in every call** — already specified in our migration table
2. **Include `src/pages/` in verification search** — minor addition, agreed

## Recap: 5 files, same pattern as Phase 1

| File | Action | Surface |
|---|---|---|
| `ReviewForm.tsx` | `review` | `review_form` |
| `use-infinite-feed.ts` | `like` / `save` | `feed_like` / `feed_save` |
| `use-feed.ts` | `like` / `save` | `feed_like` / `feed_save` |
| `EnhancedCreatePostForm.tsx` | `create_post` | `create_post_form` |
| `use-entity-operations.ts` | `create_entity` | `entity_creation` |

## Verification

Search `"Authentication required"` across `src/hooks/`, `src/components/`, and `src/pages/` — only admin/protected routes should remain.

**Approve to implement.**

