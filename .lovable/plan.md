## Goal
Redesign only the entry-mode section of the `CreateEntityDialog` so Search is the default primary flow and Paste URL becomes a secondary expandable option. No backend, pipeline, telemetry, or feature-flag changes.

## Why this direction
The current "Paste URL | Search" segmented tabs feel admin-tool-ish and default to the higher-friction path. A single search-first hero input matches normal user behavior, looks more modern, and still leaves URL Analysis one click away for power users.

## Files that will change
- `src/components/admin/CreateEntityDialog.tsx` — only the entry-mode block (lines ~2494–2635) and the default tab state (line 142).

## Detailed changes

### 1. Default state flips to Search
- Change `const [createEntityTab, setCreateEntityTab] = useState<'url' | 'search'>('url')` to `('search')`.

### 2. Replace the tab switcher with a search-first layout

**Header**
- Title stays: "Add to CommonGroundz"
- Subtitle changes to: "Find something to review or add."

**Primary search input**
- One full-width input with placeholder: "Search products, places, movies, books, food..."
- Search button to the right (icon + label or icon-only on small widths).
- Helper examples below: "Try: "Cetaphil Gentle Cleanser", "The Alchemist", "Laughing Buddha Hampi""
- Use existing `SearchEntryPanel` for results; keep its current behavior untouched.

**Secondary URL path**
- A quiet text link below the search input: "Have a link? Paste URL instead"
- Clicking it expands inline:
  - URL input with placeholder: "Paste a product, book, movie, place, or website link"
  - "Analyze" button
  - A "Back to search" link to collapse
- Keep the existing `useAnalyzeUrlEngine` flow and URL validation exactly as-is.

**Manual fallback**
- At the bottom of the entry section, change "Or Enter Details Manually" to "Can't find it? Enter details manually"
- Keep its existing click behavior (opens the manual form).

### 3. Remove old tab chrome
- Remove the `Tabs`, `TabsList`, and `TabsTrigger` for URL/Search.
- Remove the "✨ Quick Add from URL" heading and descriptive paragraph.
- Remove the orange bordered card/section wrapper around the URL input if it exists.

### 4. Preserve everything else
- The `SearchEntryPanel` component and its internals are untouched.
- The URL analysis engine, validation, and results flow are untouched.
- The draft review step and the tabbed entity form (Basic/Contact/Hours/Details/Preview) are untouched.
- Telemetry (`useSearchFunnel`, `entity_created` diff logging) is untouched.
- Cancel / Create Entity footer behavior is untouched.

## Visual spec (uses existing tokens only)
- Input: standard `Input` component, full width inside dialog padding.
- Primary button: existing `Button` with brand primary styling.
- Secondary links: `text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline`.
- Examples text: `text-xs text-muted-foreground`.
- No new colors, no new design tokens, no global style changes.

## Acceptance criteria
1. Dialog opens with Search input visible and focused-ready.
2. URL input is hidden until "Have a link? Paste URL instead" is clicked.
3. Clicking "Back to search" collapses URL and returns to Search view.
4. Existing Search and URL Analysis flows continue to work exactly as before.
5. Manual entry link still opens the full form.
6. No regressions in telemetry, draft review, or entity creation.

## What I will NOT do
- No changes to `SearchEntryPanel.tsx`.
- No changes to URL analysis edge functions or hooks.
- No changes to feature flags or admin panels.
- No changes to the tabbed entity form below the entry step.
- No new dependencies.