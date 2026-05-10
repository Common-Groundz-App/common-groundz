
# Color-coded post types + staged selection modal (v2)

Frontend only. No schema, no `/create` layout changes, no badge-visibility changes.

## What changed from v1

ChatGPT's three clarifications are all correct and folded in:

1. **All 6 types selectable in the modal** (including Experience) so users can switch back to default. Current code's "click selected to deselect → experience" toggle is removed — selecting an option just sets the draft to that option.
2. **No new badges in feed/detail.** Keep the existing `shouldShowTypeBadge(post.post_type)` gate exactly as-is — only restyle the badge where it already renders. Default Experience posts stay un-badged in the feed.
3. **Hardcoded Tailwind class strings per type** in the helper. No `bg-${hue}-50` interpolation — JIT won't see it and it'll silently fail in production.

Plus: `draftType` resets to current `postType` every time the modal opens (via `useEffect` on `open`), and Cancel / X / overlay-close all discard.

## Color mapping (final, hardcoded)

| Type | Light tint | Dark tint |
|---|---|---|
| Experience | `bg-orange-50 text-orange-700 border-orange-200` | `dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30` |
| Review | `bg-emerald-50 text-emerald-700 border-emerald-200` | `dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30` |
| Recommendation | `bg-blue-50 text-blue-700 border-blue-200` | `dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30` |
| Comparison | `bg-purple-50 text-purple-700 border-purple-200` | `dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30` |
| Question | `bg-amber-50 text-amber-800 border-amber-200` | `dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30` |
| Tip | `bg-teal-50 text-teal-700 border-teal-200` | `dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/30` |

Notes:
- Question uses `text-amber-800` in light mode — `amber-700` doesn't pass contrast on `amber-50`.
- Dark mode uses `500/10` background + `300` text + `500/30` border — soft, low-saturation, consistent with the rest of the app's dark surfaces.
- Experience keeps brand-orange family so the default state still feels on-brand.

## Files & changes

### 1. `src/components/feed/utils/postUtils.ts`
Add a static lookup — no string interpolation:

```ts
export const POST_TYPE_COLORS: Record<DatabasePostType, { pill: string; dot: string }> = {
  experience:     { pill: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30',     dot: 'bg-orange-500' },
  review:         { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30', dot: 'bg-emerald-500' },
  recommendation: { pill: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30',                  dot: 'bg-blue-500' },
  comparison:     { pill: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30',      dot: 'bg-purple-500' },
  question:       { pill: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',            dot: 'bg-amber-500' },
  tip:            { pill: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/30',                  dot: 'bg-teal-500' },
};

export const getPostTypeColors = (type: DatabasePostType) =>
  POST_TYPE_COLORS[type] ?? POST_TYPE_COLORS.experience;
```

### 2. `src/components/feed/composer/PostTypeAndTagsPill.tsx`
- Replace `border border-border bg-background hover:bg-accent/40 ... text-foreground` with `border ${getPostTypeColors(postType).pill}`.
- Keep `h-8 px-3 text-sm font-medium`, trailing `ChevronDown`, no leading icon.
- Chevron color: drop the explicit `text-muted-foreground` so it inherits the tinted text color (looks more cohesive).

### 3. `src/components/feed/composer/PostTypeAndTagsModal.tsx`
Three changes:

**a) Staged selection.**
```ts
const [draftType, setDraftType] = useState(postType);
useEffect(() => { if (open) setDraftType(postType); }, [open, postType]);
```
Clicking an option sets `draftType` only. Remove the current "toggle back to experience" behavior — clicking always sets to that type (Experience is just one of the 6).

**b) Tinted option chips.** Selected option uses `getPostTypeColors(option.value).pill`. Unselected stays neutral (`border-input text-muted-foreground hover:text-foreground hover:border-foreground/30`). Add `aria-pressed={draftType === option.value}`.

**c) Footer with Cancel / Apply.**
- `Cancel` → ghost variant, calls `onOpenChange(false)`.
- `Apply` → solid `bg-brand-orange text-white hover:bg-brand-orange/90`. Disabled when `draftType === postType`. On click: `setPostType(draftType); onOpenChange(false);`.
- Native dialog X / overlay click / Esc all flow through `onOpenChange(false)` → discards because parent state was never touched.

### 4. `src/components/feed/PostFeedItem.tsx` (line ~287–292)
**Do not touch the `shouldShowTypeBadge` gate.** Inside the existing branch, replace the plain `<span className="text-muted-foreground/70">{label}</span>` with a small tinted badge:

```tsx
<span className={cn(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none',
  getPostTypeColors(post.post_type ?? 'experience').pill
)}>
  {getPostTypeLabel(post.post_type ?? 'experience')}
</span>
```

Drop the surrounding `·` separator dots since the pill already has its own visual boundary — but only inside this branch; the visibility/edited/visibility separators stay.

### 5. `src/components/content/PostContentViewer.tsx` (line ~340–344)
Same tinted badge component as feed item, in the same spot, behind the same visibility gate.

## Out of scope (explicit)

- No `/create` page Cancel/Post button changes.
- No composer card wrap, shadows, gradients, or other "energy" changes beyond the colored pill.
- No changes to `shouldShowTypeBadge` logic — default Experience posts stay un-badged in feed.
- No changes to entity pill, hashtags, title, body, Add details, toolbar.
- No new design tokens in `index.css` or `tailwind.config.ts` — Tailwind's built-in palette covers it.
- No DB / analytics / API changes.

## Validation

- **Light + dark mode** for all 6 types: pill stays readable, no harsh contrast, no token violations from the design system standpoint (we're using the same Tailwind palette already used elsewhere in the app — e.g. `getEntityTypeColor` in `PostFeedItem.tsx` uses the same approach).
- **Modal:** open with Experience selected → all 6 visible, Experience pre-highlighted. Click Review → Review highlights, pill in composer doesn't change yet. Cancel → composer pill stays Experience. Reopen → Review is NOT pre-selected (draft reset). Click Review → Apply → pill becomes green Review.
- **Feed:** non-Experience post (e.g. Tip) shows teal badge in metadata row. Default Experience post shows nothing extra (visibility gate intact).
- **Detail view:** same badge as feed.
- **375px and 1219px widths:** pill + entity pill stack correctly, no overflow.
