
# Composer Visual Refinement Pass

Six targeted changes to improve clarity and premium feel without disrupting the current Reddit-inspired layout.

## Changes

### 1. "Add details" card upgrade (lines ~1109-1127)
Replace the small collapsible text link with a soft-bordered card/row. The trigger becomes a rounded container with an icon, label ("Add details"), and subtitle ("Pros, cons, duration & more"). Still collapsible, just visually elevated so users notice this differentiator.

### 2. Dynamic body placeholder (line 1032)
Replace the static `getPlaceholderForType(postType)` with entity-aware copy:
- No entity selected: "Tag a product, place, book, or movie to give your post context..."
- Entity selected: "Tell us about your experience with [first entity name]..."

### 3. Suggested hashtags orange tint (lines 1086-1094)
Change suggested hashtag badges from neutral `variant="outline"` to a soft orange-tinted style: `bg-primary/5 border-primary/20 text-primary`. Keep user-typed/detected tags neutral.

### 4. Spacing rhythm (line 1000)
Increase the main `space-y-4` to `space-y-5` for better breathing room between sections. No separators added.

### 5. Title typography (line 1026)
Bump the title input from `text-2xl font-semibold` to `text-[26px] font-bold tracking-tight` for stronger presence without shouting.

### 6. Focus polish (line 1057)
Add a subtle `focus-within` ring to the body textarea: a soft `ring-1 ring-primary/20` transition when focused.

## What's deferred for later
- #2 Post type promotion (keeping current pill/modal)
- #13 Mobile header changes (skipped)
- #14 Textarea min-height increase (skipped)

## Files modified
- `src/components/feed/EnhancedCreatePostForm.tsx` — all 6 changes
