# Dynamic Structured Fields Per Post Type

## Architecture (unchanged)

- All fields stored in the existing `structured_fields` JSONB column
- No database migration required
- Config-driven field rendering per post type
- `Add details` collapsed by default
- Location stays independent (3-dots menu, any post type)
- On submit, only save fields relevant to the currently selected post type (plus `location` and `_v`). Hidden fields from a previously selected type are preserved in local state but stripped before saving.

---

## Rating Contract

The existing `ConnectedRingsRating` uses a 1-5 integer scale (5 rings). The `rating` field in structured fields will store the same `number` type and range. No new scale or data shape.

---

## Field Map

All fields are optional.

### 1. Experience (baseline)

| UI Label | Key | Type |
|---|---|---|
| What worked? | `what_worked` | string (max 500) |
| What didn't? | `what_didnt` | string (max 500) |
| Good for | `good_for` | string (max 300) |
| How long / when did you try it? | `duration` | enum |
| Would you use / visit / read / watch / try it again? | `reuse_intent` | yes / no |

### 2. Review

| UI Label | Key | Type |
|---|---|---|
| Overall rating | `rating` | number 1-5 (ConnectedRingsRating) |
| Pros | `what_worked` | string (max 500) |
| Cons | `what_didnt` | string (max 500) |
| How long / when did you try it? | `duration` | enum |
| Worth it? | `worth_it` | yes / no |
| Would you recommend it? | `recommend_intent` | yes / no |

### 3. Recommendation

| UI Label | Key | Type |
|---|---|---|
| Why do you recommend it? | `why_recommend` | string (max 500) |
| Best for | `good_for` | string (max 300) |
| Not for | `not_for` | string (max 300) |
| How often have you used / visited / read / watched it? | `duration` | enum |
| Would you recommend it? | `recommend_intent` | yes / no |

Note: Recommendation uses "How often..." instead of "How long..." because recommendation needs strength of confidence / usage depth.

### 4. Comparison

| UI Label | Key | Type |
|---|---|---|
| Winner for you | `winner` | string (max 300) |
| Why did you choose it? | `reasoning` | string (max 500) |
| Best for each | `good_for` | string (max 300) |

### 5. Question

| UI Label | Key | Type |
|---|---|---|
| Options you're considering | `options_considered` | string (max 500) |
| What matters to you? | `what_matters` | string (max 300) |
| Budget / constraints | `budget` | string (max 100) |

### 6. Tip

| UI Label | Key | Type |
|---|---|---|
| The tip | `tip_summary` | string (max 300) |
| When should someone use this? | `when_to_use` | string (max 300) |
| Mistakes to avoid | `mistakes_to_avoid` | string (max 300) |
| Works best for | `good_for` | string (max 300) |

---

## New JSON Keys to Add

`rating`, `worth_it`, `recommend_intent`, `why_recommend`, `not_for`, `winner`, `reasoning`, `options_considered`, `what_matters`, `budget`, `tip_summary`, `when_to_use`, `mistakes_to_avoid`

Existing keys kept: `what_worked`, `what_didnt`, `duration`, `good_for`, `reuse_intent`, `location`, `_v`

---

## Implementation Phases

### Phase 1 — Types and config map

Files: `src/types/structuredFields.ts`

1. Add all 13 new keys to `ALLOWED_STRUCTURED_KEYS`
2. Expand `StructuredFields` interface with new optional fields
3. Add validation for new keys in `cleanStructuredFields`:
   - `rating`: number, 1-5 integer
   - `worth_it`, `recommend_intent`: enum `yes` / `no`
   - String fields: trim, collapse whitespace, enforce max lengths
4. Create `STRUCTURED_FIELDS_BY_TYPE` config map that defines, for each post type, the ordered list of fields with: key, UI label, input type (text/textarea/enum/rating/yesno), placeholder, and max length
5. Export a `getFieldsForType(postType)` helper

### Phase 2 — Composer

Files: `src/components/feed/EnhancedCreatePostForm.tsx`, possibly a new `DynamicStructuredFields.tsx` component

1. Replace the current hardcoded `Add details` fields with a loop over `getFieldsForType(postType)`
2. For each field config, render the appropriate input:
   - `text` / `textarea`: standard text input
   - `enum` (duration): existing dropdown
   - `yesno` (reuse_intent, worth_it, recommend_intent): pill toggle
   - `rating`: compact `ConnectedRingsRating` with `isInteractive={true}`, `size="sm"`, reusing the exact same component and value contract already in the app
3. Preserve all field values in local state when user switches post types
4. On submit, filter structured fields to only include keys valid for the currently selected post type (plus `location` and `_v`), then pass through `cleanStructuredFields`
5. Use entity-agnostic label wording throughout
6. Recommendation's duration label reads "How often have you used / visited / read / watched it?"

### Phase 3 — Display

Files: `src/components/content/StructuredFieldsDisplay.tsx`, `src/components/feed/PostFeedItem.tsx`, `src/components/content/PostContentViewer.tsx`

1. `StructuredFieldsDisplay` accepts a new `postType` prop
2. Render type-aware labels:
   - Experience: "What worked" / "What didn't"
   - Review: "Pros" / "Cons"
   - Others: use their specific field labels
3. Render `rating` using read-only `ConnectedRingsRating` (`isInteractive={false}`, `minimal={true}`, `size="xs"`)
4. Render new fields: `worth_it`, `recommend_intent`, `why_recommend`, `not_for`, `winner`, `reasoning`, `options_considered`, `what_matters`, `budget`, `tip_summary`, `when_to_use`, `mistakes_to_avoid`
5. Pass `postType` from `PostFeedItem` and `PostContentViewer` into `StructuredFieldsDisplay`

---

## Files Changed

1. `src/types/structuredFields.ts` — expanded keys, interface, config map, validation
2. `src/components/feed/EnhancedCreatePostForm.tsx` — dynamic field rendering
3. `src/components/content/StructuredFieldsDisplay.tsx` — type-aware display
4. `src/components/feed/PostFeedItem.tsx` — pass postType prop
5. `src/components/content/PostContentViewer.tsx` — pass postType prop
6. Possibly new: `src/components/feed/composer/DynamicStructuredFields.tsx` — extracted field renderer component