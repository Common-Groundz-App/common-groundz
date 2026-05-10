# Composer UX Fixes — Final Plan

Frontend-only. No DB migration. No category/topic system. Existing posts keep working.

## Phase 1 — Grouped duration dropdown

**File:** `src/types/structuredFields.ts`, `src/components/feed/composer/DynamicStructuredFields.tsx`, `src/components/content/StructuredFieldsDisplay.tsx`

- Keep storage key `duration` (no rename, no migration).
- Replace flat `DURATION_OPTIONS` with a grouped structure:
  - **Frequency:** `once` (Once), `few_times` (A few times), `often` (Often), `daily` (Daily)
  - **Duration:** `lt_1w` (Less than a week), `1_4w` (1–4 weeks), `1_3m` (1–3 months), `3_6m` (3–6 months), `6_12m` (6–12 months), `1y_plus` (Over a year)
- Render with shadcn `<SelectGroup>` + `<SelectLabel>` ("Frequency" / "Duration" headers).
- Extend `VALID_DURATIONS` in `cleanStructuredFields` with the 4 new frequency keys so submission accepts them.
- `StructuredFieldsDisplay` lookup table covers all 10 keys; old enum values keep rendering.
- **Label change (only one):** Recommendation's duration field label updates from "How long / when did you try it?" → **"How often have you used / visited / read / watched it?"** since Frequency is now the dominant intent for that type. All other labels untouched.

## Phase 2 — Auto-growing title textarea

**File:** `src/components/feed/EnhancedCreatePostForm.tsx`

- Replace single-line title `<input>` with `<textarea rows={1}>`.
- Auto-resize via `useLayoutEffect`: `el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'` on value change (stable across re-renders, no jump while typing).
- `maxLength={200}`.
- `onKeyDown`: Enter → `preventDefault()` and move focus to body textarea (no newlines in title).
- `resize-none`, `overflow-hidden`, same font/size/styling as before so visual layout is preserved.

## Phase 3 — Post-type-aware entity selector copy

**Files:** `src/components/feed/composer/EntitySelectorModal.tsx`, `src/components/feed/composer/PostTypeAndTagsPill.tsx` (or wherever the entity-tag trigger lives in `EnhancedCreatePostForm`)

- Accept `postType` prop.
- Copy map (used for both modal title/description and trigger pill label where it makes sense):
  - `experience` / `review` / `recommendation` → **"Tag what this is about"**
  - `comparison` → **"Tag what you're comparing"**
  - `question` → **"Tag options, if you have any"**
  - `tip` → **"Tag an entity if specific"**
- Tagging stays technically optional for ALL types — no validation change.

## Phase 4 — Smart empty-state hint

**File:** `src/components/feed/UnifiedEntitySelector.tsx` (the modal-variant results area)

- When search returns 0 entity results AND query length ≥ 2, render a single muted helper line below the empty state:
  > **"No specific entity found. For broad topics, use a hashtag like #{query} in your post."**
- `{query}` = user's typed search string, lowercased and stripped of spaces/special chars (e.g. "oily skin moisturizer" → `#oilyskinmoisturizer`). Falls back to `#yourtopic` if sanitization yields empty.
- "Create entity" CTA stays visible — users may genuinely be looking for a missing specific entity.

## Out of scope (deliberately deferred)

- Category/topic tagging system, category pages
- Renaming `duration` storage key
- DB migration
- Display/feed/detail page changes beyond duration label fallback

## Validation

After each phase: open composer for each of the 6 post types, verify field renders, submit with new + legacy values, view post in detail page to confirm display fallback works.