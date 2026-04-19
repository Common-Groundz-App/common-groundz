

## Executing now (no changes from locked plan)

### Single file edit: `src/components/content/PostContentViewer.tsx`

1. Add `authorProfileRef` synced via effect
2. Inside `fetchPost`, enrich `processedPost` with ref'd profile data before `setPost`
3. Update existing merge effect to use same fallback chain (`displayName || first_name || username`) for consistency

### Why I'm rejecting the "guard" suggestion
ChatGPT proposed `if (!processedPost.user_id) { setPost(processedPost); return; }` — but this would **skip enrichment** for any post missing `user_id` at fetch time, causing the exact "Anonymous" bug we're fixing. The current `ap ? {...} : processedPost` ternary already handles the no-profile case safely. Not adding it.

### Why I'm deferring the "displayName everywhere" note
Valid concern, but it's a codebase-wide audit (PostFeedItem, ProfileHeader, comments, mentions, etc.), not part of this fix. Out of scope. Will note for future cleanup if name mismatches surface.

### Sounds
User uploaded files in last diff (`like.wav`, `post.wav`, `save.wav`, `refresh.wav` already binary at `public/sounds/`). No action needed.

### iPhone haptics
Not fixable. Documented. Moving on.

### Verification
1. Edit post from detail page → save → author name + avatar persist (no "Anonymous / AU")
2. First load of post detail → author shows correctly (regression)
3. Hard refresh post detail → author shows correctly (regression)

