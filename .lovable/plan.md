# Composer reorder — Post type pill moves up (final)

Frontend-only. Two files touched. No schema/behavior changes beyond placement and pill styling.

## New composer order

```
1. Entity pill                  (primary, dominant)
2. Post type pill               (secondary, own row — NEW POSITION)
3. Title
4. Body + helper hint
5. Suggested hashtags
6. Add details (collapsible)
7. Toolbar / visibility / submit
```

## Changes

### 1. `src/components/feed/composer/PostTypeAndTagsPill.tsx`

- Always show the **current selected type** as the label — never the literal text "Post type" and never the `+` icon.
  - `experience` → `Experience`
  - `review` → `Review`
  - `recommendation` → `Recommendation`
  - `comparison` → `Comparison`
  - `question` → `Question`
  - `tip` → `Tip`
- Remove the leading `Plus` icon. Keep only a trailing `ChevronDown`.
- Restyle as a quiet "mode pill" — visually lighter than `EntityHeroPill`:
  - `h-8`, `text-sm`, `font-medium`
  - Neutral `border-border`, `bg-background`
  - Hover: `hover:bg-accent/40`
  - **No orange tint** — orange stays reserved for entities, hashtags, primary actions.
- Click behavior unchanged (opens existing `PostTypeAndTagsModal`).

### 2. `src/components/feed/EnhancedCreatePostForm.tsx`

- **Insert** a new block immediately after `<EntityHeroPill ... />` (after line ~1015):
  ```tsx
  {/* Post type pill — own row, secondary weight */}
  <div className="flex">
    <PostTypeAndTagsPill
      postType={postType}
      onOpen={() => setPostTypeTagsOpen(true)}
    />
  </div>
  ```
- **Remove** the existing post-type pill block at lines ~1097–1103 (currently sitting between "Suggested hashtags" and "Add details").
- No other markup, state, or handler changes.

## Why a separate row (not same row as entity)

- Up to 3 entity chips + an "Add more" button can wrap.
- Mobile width down to 320px can't comfortably fit both controls inline.
- Stacked rows = consistent layout across all breakpoints regardless of entity count.

## Out of scope

- No copy label above the pill ("Type" prefix etc.) — keep it clean as a single pill.
- No changes to `PostTypeAndTagsModal` contents or the type set.
- No changes to suggested hashtags, Add details, structured fields, title/body, or toolbar.
- No analytics changes.

## Validation

Open the composer and confirm: (1) post-type pill sits on its own row directly under the entity pill, (2) label always shows the current type with a trailing chevron and no leading icon, (3) styling is lighter/neutral (no orange) compared to entity pill, (4) clicking opens the existing modal, (5) layout is clean with 0, 1, 2, and 3 tagged entities on both mobile and desktop, (6) the old position below "Suggested" is gone.
