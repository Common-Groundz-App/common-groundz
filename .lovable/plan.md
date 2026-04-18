

## My take

Both reviews land in the same place: ship the plan, add small safeguards. Adopting both with one nuance.

**ChatGPT's safeguard — `hasBeenEdited` helper with 60s buffer:** Already in my plan (Stage 1, step 2 — `hasBeenEdited(post)` helper used by both edit-window check display and "edited" indicator). No change needed; just confirming it's centralized.

**Codex safeguard #1 — Explicit edit marker fields:** Stronger than relying on `updated_at` timestamp diff. Reasoning: any future trigger or background job that touches the row (e.g., comment count denormalization, trending score recalc, photo cache update) would bump `updated_at` and falsely flag the post as "edited." This is a real risk in your codebase — I can see `trending_score`, `last_trending_update`, `recent_views_24h` etc. all live on entities and similar denormalization likely happens on posts.

**Solution:** add an explicit `last_edited_at` column (nullable) to `posts`, set it only when the user actually edits via the composer. `hasBeenEdited(post)` becomes `!!post.last_edited_at`. No timestamp math, no false positives, no 60s buffer needed.

**Codex safeguard #2 — Single shared edit-policy utility:** Agreed. One source of truth for "1 hour" prevents drift between client check, server check, and any future surface (e.g., admin panel showing "editable until X").

**Concrete:**
- `src/utils/postEditPolicy.ts` exports `EDIT_WINDOW_MS = 60 * 60 * 1000`, `canEditPost(post, userRole?)`, `hasBeenEdited(post)`
- Server-side: same constant + check in the update RPC/edge function
- All call sites import from this utility — never inline the 1h logic

**Nothing else to add.** I've resisted the urge to suggest more (e.g., edit reason field, edit count). Those are post-MVP and would creep scope. Ready to ship.

---

## Final locked plan (with both safeguards)

### Schema change (one migration)
- Add `last_edited_at TIMESTAMPTZ NULL` to `posts`

### Stage 1 — Edit mode + polish + window enforcement

1. **Shared edit policy utility** (`src/utils/postEditPolicy.ts`)
   - `EDIT_WINDOW_MS = 60 * 60 * 1000`
   - `canEditPost(post, userRole?)` → checks ownership + window + admin bypass
   - `hasBeenEdited(post)` → `!!post.last_edited_at`

2. **Edit mode in `EnhancedCreatePostForm`**
   - New props: `postToEdit?: PostToEdit`, `defaultPostType?: string`
   - Hydrate state from `postToEdit` (title, content, post_type, visibility, tagged_entities, media, structured_fields)
   - Submit branches: edit path → Supabase `update` (sets `last_edited_at = now()`) + `updatePostHashtags` (always called) + delete-then-insert `post_entities`
   - Skip optimistic feed prepend on edit; emit `refresh-posts` + `refresh-profile-posts`
   - Submit button label: "Update" vs "Post"

3. **Edit window enforcement (client + server)**
   - Client: edit menu uses `canEditPost()`. When window expired: visible but disabled, tooltip "Edit window closed"
   - Server: edge function or RLS policy uses same `EDIT_WINDOW_MS` constant; rejects if `now() - created_at > 1h` and not admin
   - Server sets `last_edited_at = now()` on the update — client never supplies it

4. **Subtle "Edited" indicator**
   - Where post timestamp renders (`PostFeedItem` feed + detail), show `· edited` (muted, small) when `hasBeenEdited(post)`
   - Tooltip: relative time of edit using `last_edited_at`

5. **Sound + haptic on submit** (port from ModernCreatePostForm)
   - `triggerHaptic('light')` after validation passes (mobile only)
   - `playSound('/sounds/post.mp3')` after success (both platforms)

### Stage 2 — Repoint usages
6. `PostFeedItem.tsx` edit dialog → `EnhancedCreatePostForm` with `postToEdit`
7. `ProfilePostItem.tsx` edit dialog → `EnhancedCreatePostForm` with `postToEdit`
8. `SmartComposerButton.tsx` → close popover, navigate `/create?postType=journal` and `/create?postType=watching`. Drop the Dialog + ModernCreatePostForm from these branches. Review form path unchanged.

### Stage 3 — Validate, then delete
9. Manual verify all 4 entry points end-to-end
10. Codebase search → zero imports of `CreatePostForm` / `ModernCreatePostForm`
11. Delete `src/components/feed/CreatePostForm.tsx` and `src/components/feed/ModernCreatePostForm.tsx`
12. Delete `SimpleEntitySelector` and `EntityTagSelector` if unreferenced
13. Update `mem://architecture/edit-flow-type-safety-pattern` → Enhanced as single source
14. New memory: `mem://features/posts/edit-vs-update-policy` — 1h window, `last_edited_at` field, append-only Updates philosophy, shared utility location

### Out of scope
- ❌ Append-only Updates feature (next phase)
- ❌ Edit history viewer / edit count / edit reason
- ❌ Auto-title

### Verification
1. Edit a post **<1h old** from feed → composer hydrated, all features work, save sets `last_edited_at`
2. Edit from profile → same
3. Saved post shows `· edited` with tooltip showing edit time
4. Background job touching post (e.g., comment count update) → does NOT set `last_edited_at`, no false "edited" flag
5. Add `#newtag` while editing → persists; remove `#tag` → row removed from `post_hashtags`
6. Try to edit **>1h old** post → menu disabled, tooltip "Edit window closed"
7. Server guard: manual API to update >1h-old post → rejected (uses shared utility)
8. Admin editing >1h-old post → allowed
9. SmartComposerButton "Journal" → `/create?postType=journal`
10. SmartComposerButton "Currently Watching" → `/create?postType=watching`
11. Submit → sound (both), haptic (mobile only)
12. Codebase: zero imports of legacy forms
13. `/create` regression: hashtags Phase 1 + 2 still work

