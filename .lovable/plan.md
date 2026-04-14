

## Unified Entity Tagging — Final Implementation Plan

All feedback incorporated. No further iteration needed.

### Files

| # | File | Change |
|---|------|--------|
| 1 | `src/components/feed/UnifiedEntitySelector.tsx` | **New.** UI wrapper around `useEnhancedRealtimeSearch`. Single search input, categorized results with bold match highlighting, Enter auto-selects first entity, "+ Add Entity" (query >= 3 chars) opens `CreateEntityDialog`, "Did you mean?" before add CTA, People click inserts plain `@username`, configurable `maxEntities` (default 3) with disabled state + message when limit reached. Normalize strings (lowercase + trim) for similarity comparison. |
| 2 | `src/components/feed/EnhancedCreatePostForm.tsx` | Swap `SimpleEntitySelector` → `UnifiedEntitySelector`. Add `onMentionInsert` handler that sanitizes username and inserts `@username` at cursor in textarea. |
| 3 | `src/components/admin/CreateEntityDialog.tsx` | Extend `onEntityCreated` to pass back typed entity shape: `onEntityCreated?: (entity?: { id: string; name: string; type: string; image_url?: string }) => void`. Backward compatible. |

### All adopted safeguards

| Source | Safeguard |
|--------|-----------|
| ChatGPT | Normalize before "Did you mean" compare (lowercase + trim + collapse spaces) |
| ChatGPT | Disable entity selection when max reached + show "Up to 3 tags" message |
| ChatGPT | No silent creation — Enter with no results opens dialog |
| ChatGPT | "+ Add Entity" only when query >= 3 chars |
| ChatGPT | Bold matched substring in results |
| Codex | Strong typing for `onEntityCreated` — no `any`, use `{ id, name, type, image_url? }` |
| Codex | Sanitize username before `@mention` insertion (strip invalid chars) |
| Codex | People click = plain text only, no persistence (deferred) |
| Codex | `maxEntities` as configurable prop, not hardcoded |

### What stays untouched
- `SimpleEntitySelector.tsx` — kept
- `ModernCreatePostForm.tsx` — not changed (edit flow deferred)
- `useEnhancedRealtimeSearch` — used as-is
- All search APIs, edge functions, caching — unchanged

