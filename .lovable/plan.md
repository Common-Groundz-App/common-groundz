

## Premium Polish Plan — Experiences & Comments

You're right — "Comments" stays as "Comments". That was a mistake in the previous plan. The heading at line 566 of `InlineCommentThread.tsx` will NOT be changed.

### Changes

**File: `src/components/content/PostContentViewer.tsx`**

1. **Rename heading + add subheading**
   - Line 306-308: Change "More experiences about {name}" → **"Real experiences with {name}"**
   - Add subtitle: *"See how people actually used it"* (`text-xs text-muted-foreground`)
   - Heading gets `text-base font-semibold`

2. **Stronger section separation**
   - Line 305: Change `mt-8 pt-6` → `mt-10 pt-8 border-t border-border/50` (subtle divider for mental shift)

3. **Circle vs Community split**
   - Import `useUserFollowing` hook
   - Split `relatedPosts` into `circlePosts` (author's user_id is in following list) and `communityPosts`
   - **"From your Circle"** subsection (only if non-empty):
     - Heading: `font-medium text-foreground` with subtext *"Trusted experiences from your Circle"*
     - Visual: `border-l-2 border-orange-400 bg-orange-50/20 dark:bg-orange-950/20 rounded-lg p-3`
   - **"From the community"** subsection:
     - Heading: `text-sm text-muted-foreground` (de-emphasized vs Circle)
     - No special styling

4. **Upgrade empty state copy**
   - Keep dynamic entity name
   - Primary: *"No experiences about {relatedEntityName} yet"*
   - Secondary: *"People who've tried {relatedEntityName} haven't shared here yet. Be the first from your Circle!"*
   - Below CTA button: *"Your experience could help someone decide."* (`text-xs text-muted-foreground mt-2`)
   - Add more breathing room between elements

5. **Staggered fade-in + hover lift on experience cards**
   - Each `PostFeedItem` wrapped in a div with:
     - `animate-fade-in` with `animationDelay: ${index * 100}ms`
     - `hover:shadow-sm hover:-translate-y-[1px] transition-all duration-200`
   - Section container also gets a subtle `animate-fade-in`

### What stays unchanged
- `InlineCommentThread.tsx` — "Comments" heading remains as-is
- `PostFeedItem` component internals — no padding/layout changes
- All other pages and components
- Empty state overlapping circles pattern in comments

