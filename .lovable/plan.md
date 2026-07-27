## Goal
Step 1 only: make **Search** the default mode, reorder to Search → Paste URL, and replace the tab bar with a modern rounded segmented pill control. Everything else stays exactly as it is.

## Changes (UI-only, single file)

`src/components/admin/CreateEntityDialog.tsx`

1. **Default mode**
   - `useState<'url' | 'search'>('url')` → `useState<'url' | 'search'>('search')`.
   - Ensure the mode resets to `'search'` when the dialog closes/resets.
   - Guard: if the Search-to-Draft flag is off, fall back to `'url'` so the URL panel still renders.

2. **Segmented pill control replaces `TabsList`**
   - Remove the `TabsList` / `TabsTrigger` markup in the hero section.
   - Add a compact segmented control: a rounded-full muted container (`bg-muted/60`, `p-1`, `rounded-full`) holding two equal-width options.
   - Active option: raised pill (`bg-background`, `rounded-full`, subtle shadow, foreground text).
   - Inactive option: transparent, `text-muted-foreground`, hover state.
   - Order: **Search** (with search icon) first, **Paste URL** (with link icon) second.
   - Implemented with the existing `RadioGroup` primitive (hidden indicators, label-as-pill) for proper keyboard/ARIA behavior, driven by the same `createEntityTab` state.
   - Only rendered when `searchToDraftEnabled` is true, same as today.

3. **Content panels**
   - Keep the existing `Tabs` root + `TabsContent` panels wired to `createEntityTab` so the URL card and `SearchEntryPanel` render exactly as they do now.

4. **Copy**
   - `Or Enter Details Manually` → `Can't find it? Enter details manually.`

## Explicitly NOT changing
- URL "Quick Add" hero card, sparkle icon, gradient, input, Analyze button, and rich preview — untouched.
- `SearchEntryPanel` — untouched.
- URL analysis handlers, draft review, duplicate dialogs, form tabs, progressive disclosure — untouched.
- No backend, telemetry, or feature-flag changes.

## Verification
- Open the dialog: Search is active by default and appears first.
- Switch to Paste URL: card renders identically to today, Analyze still works.
- Manual-entry link shows the new copy and still expands the form.
- Screenshot the dialog after the change so we can decide separately about compacting the URL card.