

## My take

All four points are valid. Adopting all of them — they're small, safe, and prevent real bugs.

**ChatGPT's additions:**
1. **Duplicate guard before DB write** — defensive, costs nothing, protects against future regressions if dedup logic upstream changes.
2. **Max length filter (≤50 chars)** — sensible UX guard. Note: existing `isValidHashtag` already caps at 100, so I'll standardize on **50** for the persistence path (stricter than display validation, matches DB hygiene goals).

**Codex's corrections:**
1. **Use the actual field name** — confirmed correct concern. I need to verify the actual variable name in each form (`content` vs `contentHtml`) when implementing. This is an implementation-time check, not a plan change.
2. **`extractHashtagsDetailed` must reuse `extractHashtagsFromPost` internally** — already in my plan (it calls `extractHashtags` per-field then dedupes via `Set`), but I'll make it explicit: no new regex, no parallel logic.

## Final locked Phase 1 plan

### Files
- `src/utils/hashtag.ts` — add `extractHashtagsDetailed` helper
- `src/components/feed/EnhancedCreatePostForm.tsx` — create flow + chip row
- `src/components/feed/ModernCreatePostForm.tsx` — edit flow

### 1. New helper (`src/utils/hashtag.ts`)
```ts
export interface DetailedHashtags {
  all: string[];
  title: string[];
  content: string[];
  source: 'title' | 'content' | 'both' | 'none';
}

export const extractHashtagsDetailed = (title?: string, content?: string): DetailedHashtags => {
  // Reuses existing extractHashtags + isValidHashtag — no new regex
  const titleTags = extractHashtags(title || '').filter(isValidHashtag);
  const contentTags = extractHashtags(content || '').filter(isValidHashtag);
  const all = [...new Set([...titleTags, ...contentTags])];
  const source =
    titleTags.length && contentTags.length ? 'both'
    : titleTags.length ? 'title'
    : contentTags.length ? 'content' : 'none';
  return { all, title: titleTags, content: contentTags, source };
};
```

### 2. Create flow (`EnhancedCreatePostForm.tsx`)
Implementation-time: verify actual content field name in this form (likely `content`, not `contentHtml`). After `posts.insert()` succeeds:

```ts
const { all, source } = extractHashtagsDetailed(title, content);

const payload = all
  .map(t => ({ original: t, normalized: normalizeHashtag(t) }))
  .filter(p => p.normalized.length > 0 && p.normalized.length <= 50);

// Duplicate guard (defensive)
const uniquePayload = Array.from(
  new Map(payload.map(p => [p.normalized, p])).values()
);

if (uniquePayload.length > 0) {
  try {
    await processPostHashtags(newPost.id, uniquePayload);
  } catch (err: any) {
    console.error('Hashtag linking failed (non-blocking):', err);
    analytics.track('post_hashtag_link_failed', {
      source: 'create',
      tag_count: uniquePayload.length,
      error_code: err?.code || 'unknown',
    });
    toast({
      title: "Tags couldn't be saved",
      description: 'You can edit your post to add them again.',
    });
  }
}

analytics.track('post_hashtags_extracted', {
  source: 'create',
  count: uniquePayload.length,
  has_hashtags: uniquePayload.length > 0,
  hashtag_source: source,
});
```
Include `uniquePayload` in optimistic cache item so `PostTextRenderer` shows inline links instantly.

### 3. Edit flow (`ModernCreatePostForm.tsx`)
Implementation-time: verify actual content field name. Same pattern, calling `updatePostHashtags(postId, uniquePayload)` (delete-then-insert). Empty array correctly clears all hashtags. Wrapped in try/catch — edit succeeds even if tag link fails. Analytics fires with `source: 'edit'`.

### 4. Composer chip row (`EnhancedCreatePostForm`)
- `useMemo` over `[title, content]` → `extractHashtagsDetailed(title, content).all`, then apply same length filter (≤50)
- Render below textarea, **only when count > 0**:
  ```
  Tags
  [#oilyskin] [#budget]
  ```
- `Badge variant="secondary"` + `#` prefix
- Mobile: `overflow-x-auto` horizontal scroll
- **Read-only**: no `×`, no chip-to-text sync
- Source of truth = textarea content

### Failure policy
- Hashtag write failures **never block** post publish/edit
- Soft toast with recovery hint
- `post_hashtag_link_failed` event for production monitoring

### Out of scope (Phase 1)
- Chip → text deletion
- Suggested tags (Phase 2)
- Bidirectional sync, autocomplete, `#` typeahead
- Any change to `PostTextRenderer`, `HashtagRenderer`, feed cards, post detail, `/t/:tag`
- DB migrations, new tables
- Test infrastructure
- Composer redesign (Phase 3)

### Verification checklist
1. Create with `#oilyskin` in content → row in `post_hashtags`, inline link in feed, post on `/t/oilyskin`, analytics: `hashtag_source: 'content'`
2. Create with `#review` in title only → captured, `hashtag_source: 'title'`
3. Create with both → `hashtag_source: 'both'`
4. Edit post: swap `#oilyskin` → `#dryskin` → old removed, new added
5. Edit post: remove all hashtags → `post_hashtags` count drops to 0
6. Try `#thisisaveryveryveryveryverylonghashtagthatexceedsfiftychars` → filtered out, not persisted, not in chip row
7. Composer chip row appears only when ≥1 valid tag detected
8. Mobile: chips scroll horizontally
9. Force-fail `processPostHashtags` (network throttle) → post still publishes, soft toast shown, `post_hashtag_link_failed` fires

### Phases 2 & 3 (deferred)
- **Phase 2** (after 2 weeks of analytics data): entity-aware suggested tag chips
- **Phase 3** (later): full composer redesign

Ready to implement Phase 1 on approval.

