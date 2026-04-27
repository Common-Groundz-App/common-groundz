
# Reddit-Inspired Composer Redesign — `/create`

## 🔒 Hard Guarantee — Zero Functionality Removed

Before listing changes, here is the **complete inventory of every feature in `EnhancedCreatePostForm.tsx`**. Every single one of these is preserved. This is a **UI-only refactor** — no logic, services, hooks, validation, analytics, or behavior is removed or altered.

### Existing functionality inventory (all preserved)

| # | Feature | Where it lives today | Where it goes after redesign |
|---|---|---|---|
| 1 | User identity (avatar + display name) | `<Avatar>` + `<p>` next to title | Subtle name line above title (no avatar in header — moved out per Reddit pattern) |
| 2 | Title input (120 char max, optional) | Borderless `<input>` | Same input, larger font, still borderless |
| 3 | Body textarea with auto-resize | `<Textarea ref={textareaRef}>` + height effect | Same textarea, same auto-resize effect |
| 4 | Dynamic placeholder per post type (`getPlaceholderForType`) | On textarea | Preserved |
| 5 | Guided prompt line: "What worked? · What didn't? · Who is this useful for?" | `<p>` below textarea | Preserved, kept visible (not hidden) |
| 6 | Post type chips (6 options: journal, watching, comparison, question, tip, update) | Always-visible chip row | Moved into "Post Type & Tags" modal, with current selection shown as a pill on page |
| 7 | Entity multi-select (up to 3) via `UnifiedEntitySelector` | Inline expand/collapse panel | Promoted to "Hero pill" at top → opens same `UnifiedEntitySelector` in a modal/popover. Selected entity chips render inline below the pill. |
| 8 | `@` mention trigger → opens entity selector with prefilled query | `replaceAtTrigger` + textarea onChange | Preserved verbatim — same trigger, same modal target |
| 9 | Mention insertion via `onMentionInsert` (with `@` cleanup) | Inside `UnifiedEntitySelector` callback | Preserved verbatim |
| 10 | Hashtag detection from title + content (`extractHashtagsDetailed`) | `useMemo` | Preserved |
| 11 | Detected hashtag chip row (read-only preview) | Below textarea | Preserved as inline chip row below body (per ChatGPT refinement #1) |
| 12 | Suggested hashtags (`getSuggestedTags` based on entities + postType) | Below detected chips | Preserved as inline chip row, click-to-insert behavior unchanged |
| 13 | Hashtag suggestion impression tracking + click tracking | `analytics.track(...)` | Preserved |
| 14 | Hashtag persistence on submit (`processPostHashtags` / `updatePostHashtags`) | In `handleSubmit` | Preserved verbatim |
| 15 | Media uploader (max 4) via `MediaUploader` | Bottom toolbar button | Preserved in primary toolbar (Level 1) |
| 16 | Media count badge (e.g. "2/4") | On media button | Preserved |
| 17 | `TwitterStyleMediaPreview` for uploaded media | Above bottom toolbar | Preserved, same position |
| 18 | Drag-and-drop media on whole form | `useEffect` on `formRef` | Preserved |
| 19 | Emoji picker (`@emoji-mart`) with cursor-position insertion | Popover button + `handleEmojiSelect` | Preserved in primary toolbar (Level 1) |
| 20 | Cursor position tracking for emoji insertion | `saveCursorPosition` + `cursorPosition` state | Preserved |
| 21 | Click-outside-to-close for emoji picker | `useEffect` listener | Preserved |
| 22 | Location button + `LocationSearchInput` | Toolbar button + inline panel | Moved to secondary toolbar (Level 2, under "⋯") per refinement #4 |
| 23 | Location chip with name/address + remove | Below media preview | Preserved, same placement |
| 24 | Location stored in `structured_fields.location` (with snake_case conversion + coord validation) | In `handleSubmit` | Preserved verbatim |
| 25 | Visibility selector (Public / Only Me / Circle Only) | `<Select>` in bottom toolbar | Promoted to **labeled pill** ("🌐 Public ⌄") next to Post button (per my addition #6) |
| 26 | Visibility icon mapping (`getVisibilityIcon`) | Helper fn | Preserved |
| 27 | Cancel button | Bottom toolbar | Replaced by `X` (top-left on mobile, top-left on desktop) — same `onCancel` handler |
| 28 | Post button with disabled state + spinner + "Posting…" / "Updating…" labels | Bottom toolbar | Promoted to top-right (sticky), same logic |
| 29 | Post button submit pulse animation (`submitPulse`) | className toggle | Preserved |
| 30 | `Cmd/Ctrl+Enter` keyboard shortcut to submit | `useEffect` listener | Preserved |
| 31 | Haptic feedback on submit (`triggerHaptic`) | In `handleSubmit` | Preserved |
| 32 | Sound feedback on submit (`playSound`) | In `handleSubmit` | Preserved |
| 33 | Structured fields collapsible: What worked, What didn't, Duration, Good for, Reuse intent | `<Collapsible>` panel | Preserved as **"Add details"** collapsible (quieter visual weight, same fields, same state) |
| 34 | Structured fields auto-open on edit if any field has data | `useState` initializer | Preserved |
| 35 | Structured fields character counters (500/500, 300/300) | Below each input | Preserved |
| 36 | Whitespace cleanup on blur for text fields | `onBlur` handlers | Preserved |
| 37 | Duration `<Select>` from `DURATION_OPTIONS` | In collapsible | Preserved |
| 38 | Reuse intent toggle (Yes / No) | In collapsible | Preserved |
| 39 | `cleanStructuredFields` + safe merge with `existingStructured` (Guard A) | In `handleSubmit` | Preserved verbatim |
| 40 | `ui_post_type` stamping for journal/watching + stale-clear | In `handleSubmit` | Preserved verbatim |
| 41 | Empty-object → null normalization for `structured_fields` | In `handleSubmit` | Preserved verbatim |
| 42 | Edit mode hydration (title, content, entities, media, postType, visibility, structured_fields, location, ui_post_type) | useState initializers | Preserved verbatim |
| 43 | Edit mode `last_edited_at` server-side trigger reliance | Documented in `handleSubmit` | Preserved |
| 44 | Edit mode change detection (Guard C — only refresh feeds when changed) | In `handleSubmit` | Preserved verbatim |
| 45 | Edit mode entity relationship replace (delete-then-insert) | In `handleSubmit` | Preserved verbatim |
| 46 | Optimistic feed cache update on create | In `handleSubmit` | Preserved verbatim |
| 47 | Feed invalidation + custom event dispatch (`refresh-feed`, `refresh-posts`, `refresh-profile-posts`) | In `handleSubmit` | Preserved verbatim |
| 48 | `requireAuth` gate as first statement in submit | In `handleSubmit` | Preserved verbatim (per `auth-gating-handler-pattern` memory) |
| 49 | Empty-post validation toast | In `handleSubmit` | Preserved |
| 50 | Form reset after successful create | After `onSuccess()` | Preserved |
| 51 | Toast notifications (success, error, hashtag failure, media limit) | Throughout | Preserved |
| 52 | Analytics events: `post_structured_fields_used`, `post_type_selected`, `post_hashtags_extracted`, `post_hashtag_link_failed`, `hashtag_suggestions_shown`, `hashtag_suggestion_clicked` | Throughout | Preserved verbatim |
| 53 | `sessionId` for media upload tracking | `useRef` | Preserved |
| 54 | Mobile back button + header (in `CreatePost.tsx`) | Top of page | Replaced by sticky top bar with X + Post (same `navigateBack` handler) |
| 55 | Email verification gate (`canPerformAction`) | `CreatePost.tsx` useEffect | Preserved verbatim |
| 56 | Profile data loading | `CreatePost.tsx` useEffect | Preserved verbatim |
| 57 | Initial entity prefill from URL params | `CreatePost.tsx` searchParams parsing | Preserved verbatim |
| 58 | `defaultPostType` from URL params (whitelisted) | `CreatePost.tsx` searchParams parsing | Preserved verbatim |

If any item above is missed during implementation, it's a bug — not a design choice.

---

## 🎨 What Actually Changes (UI Only)

### Layout transformation — desktop & mobile

**Today:** A bordered `bg-card rounded-lg border shadow-sm` card wraps everything. Avatar + name sit beside the title. All controls (post type chips, entity selector, body, hashtags, structured fields, toolbar) stack inside the card. Bottom toolbar holds 5 icons + visibility select + Cancel + Post.

**After:** No card. The page itself is the composer surface (Reddit-style). Vertical flow:

```
┌──────────────────────────────────────────────────────┐
│ [X]                                          [Post]  │  ← sticky top bar
├──────────────────────────────────────────────────────┤
│  Hana Li                                              │  ← subtle identity
│                                                       │
│  [ 🏷  Tag entities (optional)  ⌄ ]                  │  ← entity hero pill
│  [Cetaphil Cleanser ×] [Niacinamide Serum ×]         │  ← selected chips
│                                                       │
│  Add a title (optional)                               │  ← large borderless
│                                                       │
│  Share your experience...                             │  ← body
│  What worked? · What didn't? · Who is this for?      │  ← guided prompt
│                                                       │
│  #skincare  #budget  #acne                            │  ← detected hashtags
│  Suggested: + #oily-skin  + #cleanser                 │  ← suggested chips
│                                                       │
│  [ + Post type & tags ]                               │  ← opens modal
│                                                       │
│  ⌄ Add details                                        │  ← collapsed structured
│                                                       │
│  [media preview if any]                               │
│  [location chip if any]                               │
├──────────────────────────────────────────────────────┤
│ 🖼  😊  ⋯              🌐 Public ⌄    [Post]         │  ← sticky bottom bar
└──────────────────────────────────────────────────────┘
```

### Specific UI changes

1. **Remove card wrapper** in `CreatePost.tsx` — replace `<div className="bg-card rounded-lg border shadow-sm">` with a plain content container. The page surface IS the composer.

2. **Sticky top bar (new)** — `position: sticky; top: 0` with backdrop blur:
   - Left: `X` button (calls existing `navigateBack`, with **dirty-guard confirm** if title/content/entities/media is non-empty)
   - Right: `Post` / `Update` button (calls existing `handleSubmit`, same disabled logic, same spinner)
   - Mobile: same layout, same handlers

3. **Move avatar out, keep subtle name line** — Remove the large `<Avatar>` in form header. Show only `<p className="text-sm text-muted-foreground">{userDisplayName}</p>` above the title (per `identity-data-standards`).

4. **Entity hero pill** — Replace the "What are you sharing about?" inline expand with a prominent button at the top:
   - Empty state: `[ 🏷  Tag entities (optional but recommended)  ⌄ ]`
   - Selected state: chips render inline below the pill, "+ Add more" link appended
   - Clicking the pill or "+ Add more" opens the existing `UnifiedEntitySelector` inside a `<Dialog>` modal (instead of inline panel)
   - **Critical:** all existing props (`onEntitiesChange`, `initialEntities`, `initialQuery`, `autoFocusSearch`, `maxEntities={3}`, `onMentionInsert`) are passed through unchanged
   - `@` trigger from textarea still opens the same modal with `selectorPrefillQuery`

5. **Title — larger and borderless** — Bump from `text-lg` to `text-2xl`, same `<input>`, same maxLength, same state. Same placeholder.

6. **Body textarea — keep as-is** structurally; just remove the `Textarea` wrapper styling that's already minimal. Guided prompt line stays directly under it (visible, not hidden).

7. **"Post Type & Tags" pill (new modal)** — Replace the always-visible 6-chip row with a single pill button:
   - Label reflects current state: `+ Post type & tags` (none) → `Journal · 3 tags` (selected)
   - Opens a `<Dialog>` containing two clearly-labeled sections:
     - **Post Type** — same 6 chips from `POST_TYPE_OPTIONS`, same toggle behavior
     - **Tags** — read-only view of detected hashtags + suggested hashtags chips (same data, same click-to-insert)
   - **Inline tag chips remain visible on the page surface** (per ChatGPT refinement #1) — modal is for editing, not the only surface

8. **"Add details" collapsible — same fields, quieter chrome** — The structured fields `<Collapsible>` is preserved verbatim. Only the trigger button label changes to "Add details" with a chevron icon. All 5 inputs (What worked, What didn't, Duration, Good for, Reuse intent) and their character counters, validation, and whitespace cleanup are unchanged.

9. **Two-level bottom toolbar** (per ChatGPT refinement #4):
   - **Level 1 (always visible left side):** 🖼 Media · 😊 Emoji · ⋯ More
   - **Level 2 (inside "⋯" popover):** 📍 Location, plus room for future tools
   - **Right side:** `🌐 Public ⌄` labeled visibility pill (not just an icon — per addition #6) + (Post button moved to sticky top, so it does NOT duplicate here on desktop; on mobile the bottom bar shows only Level 1 icons + visibility pill since Post is in sticky top)

10. **Sticky bottom toolbar — mobile-safe** (per Codex safeguard #3):
    - `position: sticky; bottom: 0` with `padding-bottom: env(safe-area-inset-bottom)`
    - Page container uses `min-h-[100dvh]` (dynamic viewport height) instead of `100vh` to handle iOS keyboard
    - When emoji picker opens, it positions above the toolbar without overlapping the textarea
    - When location panel opens (full-width inline above toolbar), toolbar dims (existing `opacity-50 pointer-events-none` pattern preserved)

11. **Post button validation feedback** (per my addition #4) — When disabled, hovering/long-pressing shows tooltip: "Add a title or content to post". Implemented via `<TooltipProvider>` wrapping the disabled button.

12. **Dirty-guard on close** (per my addition #3) — If title/content/entities/media has any value, clicking X opens an `<AlertDialog>`: "Discard your draft? Your changes will be lost." with Cancel / Discard buttons.

13. **Auto-save draft to localStorage** (per my addition #2) — Use existing `usePersistedForm` hook. Key: `composer-draft-${user.id}`. Debounce 500ms. Restore on mount only in CREATE mode (never edit mode). Clear on successful submit or explicit Discard. Expire after 24h via timestamp check.

---

## 🛠 Component Structure (Centralized State per Codex Safeguard #1)

**State stays in `EnhancedCreatePostForm`.** New components are **presentational** — they receive props and emit callbacks. No state splitting, no prop-drilling layers.

New presentational components (all in `src/components/feed/composer/`):

- `ComposerTopBar.tsx` — sticky top, X + Post button. Props: `onClose`, `onSubmit`, `isSubmitting`, `isPostDisabled`, `isEditMode`, `submitPulse`.
- `ComposerBottomBar.tsx` — sticky bottom, primary toolbar + visibility pill. Props: all toolbar handlers + visibility state/setter + `disabled` flag.
- `EntityHeroPill.tsx` — pill button + selected chips row. Props: `entities`, `onOpenSelector`, `onRemoveEntity`.
- `EntitySelectorModal.tsx` — `<Dialog>` wrapper around existing `UnifiedEntitySelector`. Passes through all existing props.
- `PostTypeAndTagsPill.tsx` — pill button showing current state. Props: `postType`, `tagCount`, `onOpen`.
- `PostTypeAndTagsModal.tsx` — `<Dialog>` with two sections. Props: `postType`, `setPostType`, `detectedHashtags`, `suggestedHashtags`, `onSuggestedHashtagClick`.
- `MoreToolsPopover.tsx` — `<Popover>` with location button. Props: `onOpenLocation`, `disabled`.
- `DiscardDraftDialog.tsx` — `<AlertDialog>` for dirty-guard. Props: `open`, `onConfirm`, `onCancel`.

`EnhancedCreatePostForm.tsx` orchestrates all state + handlers exactly as today, just renders these subcomponents instead of inline JSX.

`CreatePost.tsx` is updated to:
- Remove the card wrapper
- Remove the existing mobile header (replaced by sticky top bar inside the form)
- Use `min-h-[100dvh]` instead of `min-h-screen`
- Keep all existing logic (email gate, profile load, URL param parsing, navigateBack, handleSuccess) unchanged

---

## ♿ Accessibility (per Codex Safeguard #4)

- All icon-only buttons get `aria-label` ("Add media", "Insert emoji", "More tools", "Change visibility", "Close composer")
- All modals (`EntitySelectorModal`, `PostTypeAndTagsModal`, `DiscardDraftDialog`) use shadcn `<Dialog>` which provides focus-trap + ESC-to-close + ARIA roles natively
- Entity chips support keyboard removal (Tab to chip, Enter/Backspace to remove)
- Sticky top/bottom bars have `role="toolbar"` with `aria-label`
- Post button disabled state announced via `aria-disabled` + tooltip
- Z-index: modals at `z-[101]` per `z-index-hierarchy` memory

---

## 📋 Acceptance Criteria

1. ✅ Every item in the 58-row functionality inventory works identically to before (manual smoke test in both create and edit mode)
2. ✅ Edit mode hydrates correctly: existing entities show as chips, postType pill shows current label, structured fields auto-expand if populated, visibility pill reflects saved value, hashtags chip row shows existing tags
3. ✅ Edit mode "Update" button label appears (not "Post"), 1h window enforced server-side as today
4. ✅ `@` mention in body still opens entity modal with prefilled query, still cleans up `@query` text on selection
5. ✅ Cmd/Ctrl+Enter still submits
6. ✅ Drag-and-drop media still works on the page surface
7. ✅ Mobile: sticky top bar visible above keyboard; sticky bottom bar respects safe-area-inset-bottom; no overlap of textarea by keyboard
8. ✅ Dirty-guard fires only when content exists; clean close skips confirm
9. ✅ localStorage draft restored only in create mode; cleared on submit
10. ✅ All analytics events fire with same names and payloads
11. ✅ No new TypeScript errors; `EnhancedCreatePostForm` props signature unchanged (backward compatible with any other caller, e.g. edit modals)

---

## 🚧 Out of Scope (Phase 2, separate plan)

- Entity-aware contextual prompt hints (e.g., sunscreen → "white cast, sweating")
- Post-type-aware structured field defaults
- Draft list / draft management UI
- Emoji picker theme-aware (light/dark)

---

## 📁 Files Touched

**Created:**
- `src/components/feed/composer/ComposerTopBar.tsx`
- `src/components/feed/composer/ComposerBottomBar.tsx`
- `src/components/feed/composer/EntityHeroPill.tsx`
- `src/components/feed/composer/EntitySelectorModal.tsx`
- `src/components/feed/composer/PostTypeAndTagsPill.tsx`
- `src/components/feed/composer/PostTypeAndTagsModal.tsx`
- `src/components/feed/composer/MoreToolsPopover.tsx`
- `src/components/feed/composer/DiscardDraftDialog.tsx`

**Modified:**
- `src/components/feed/EnhancedCreatePostForm.tsx` — restructured render (logic unchanged), adds dirty-check + draft auto-save wiring
- `src/pages/CreatePost.tsx` — removes card wrapper, removes legacy mobile header, switches to `100dvh`

**Untouched (verified):**
- `src/components/feed/UnifiedEntitySelector.tsx`
- `src/components/feed/utils/postUtils.ts`
- `src/utils/hashtag.ts`, `src/utils/hashtagSuggestions.ts`
- `src/services/hashtagService.ts`
- `src/components/media/MediaUploader.tsx`, `TwitterStyleMediaPreview.tsx`
- `src/components/feed/LocationSearchInput.tsx`
- `src/types/structuredFields.ts`
- `src/utils/postEditPolicy.ts`
- All Supabase queries, RLS, triggers
