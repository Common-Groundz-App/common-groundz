# Phase 2.0 verification + Phase 2.1: honest per-type review categories

## Phase 2.0 status: implemented, with two small gaps

Verified in code:
- `SubjectSelectStep` is Step 2 in `ReviewForm.tsx`; `StepTwo`/`CategorySelector` (review versions) are no longer imported anywhere — they only sit on disk as planned for deletion in 2.5. The admin `CategorySelector` is a different, unrelated component.
- `UnifiedEntitySelector` has `mode`, `recentsSurface`, `allowInlineCreate`, `externalResultPolicy`; subject mode is single-select, excludes people, mounts no create dialog, and `existingOnly` never calls `createEntityQuick`; unparseable external types are not coerced.
- `subjectSelection.ts` derives category + Step 3 prefill purely; food subject fills `foodName`, venue is left to the async `getParentEntity` lookup with stale-request protection.
- Step 3 receives `disableEntityChange`/`disableEntityFields` from the chosen subject; venue and media stay editable.
- Tests green (49 in the review/taxonomy suites, full suite previously 352), build log says `build OK`.

Gaps against the approved 2.0 plan (fixed as the first item of 2.1):
1. Step 2's primary **Next is not disabled** when no subject is chosen — Next and "Skip for now" currently behave identically, so skipping is still implicit. `isNextDisabled()` has no `case 2`.
2. The skip is **not logged** to funnel telemetry, so 2.2 ("subject required") would have no evidence behind it.

## Phase 2.1 — persist the real entity type as the review category

Today every review is squashed into one of five legacy buckets (`food`, `movie`, `book`, `place`, `product`), so a course, a game, a brand and a service all persist as `product`. Phase 2.1 stores the **canonical type** for reviews that have a subject, while keeping the questionnaire itself unchanged.

### What the user sees
- A review of a course shows "Course", a TV show shows "TV Show", an event shows "Event" — instead of everything collapsing to Product/Place.
- The questions asked in Steps 3 and 4 do not change at all in this phase (that is Phase 3).
- Old reviews keep exactly the category they were saved with.

### How it works
Split the single overloaded `category` state into two ideas:

```text
subject.type ──parse──► canonicalType     → persisted as reviews.category   (new)
                          │
                          └─map──────────► questionnaireKind (5 buckets)    → drives Steps 3/4 UI only
```

- `questionnaireKind` reuses the existing `mapCanonicalToLegacyCategory` from `subjectSelection.ts`; Steps 3/4, emoji/title copy, food-tag metadata and the `foodName` vs `contentName` branch all read `questionnaireKind`, so their behaviour is byte-identical to today.
- **Strict parsing only (ChatGPT).** `getCanonicalType` in `entityTypeHelpers.ts` is display-only — it falls back to `Others` for anything it cannot parse, so it must never touch persistence. The new `resolveQuestionnaireKind(storedCategory)` uses `parseEntityType`/`parseEntityTypeAtBoundary` from `entityType.ts` and understands both canonical types and the five legacy review values. If a stored value resolves to nothing, the questionnaire falls back to the product layout for *rendering only* and the **raw stored category is saved back untouched** — never coerced to `product` or `others`.
- **Subject origin flag (Codex).** Persistence does not ask "is there a subject?", it asks "did the user choose this subject?". A `subjectOrigin: 'loaded' | 'entity-page' | 'user-selected'` value is set when the subject is populated:
  - `loaded` (opened from an existing review) → `category` is written back exactly as stored, even when the linked entity's type disagrees (a `food` review linked to a `place` entity stays `food`).
  - `user-selected` (picked or replaced in Step 2, including attaching a subject to a previously entity-less review) → `category = canonicalType`.
  - `entity-page` on a new review counts as user-selected (the user started from that entity); on an edit it does not.
- Skipped Step 2 (no subject at all) → `category = questionnaireKind`, exactly as today.
- No database migration: `reviews.category` is plain `text`, and nothing in `src` filters reviews by category (checked `src/services/review/*`, the review hooks, explore and recommendation services — those `category` filters belong to `user_interests`, `user_stuff` and `recommendations`). `convertReviewToRecommendation` only flips `is_recommended`; it never copies `category` into the `recommendation_category` enum, so widening the values cannot break it.
- Display is already safe: `ReviewCard` renders the category through `getCanonicalType` + `getEntityTypeLabel` + `getEntityTypeFallbackImage`, so `course` or `tv_show` label and illustrate correctly with no card changes.

### Backend consumer audit (Codex was right — two real consumers)
Confirmed by reading the functions:
1. `supabase/functions/calculate-lifestyle-similarity/index.ts` builds a cosine-similarity vector over raw `reviews.category` values (mixed with `user_stuff.category`). With 15 values, a course reviewer and a product reviewer stop overlapping. **Decision for this phase: bucket before comparing.** The function maps each review category through the same canonical → five-bucket mapping before building the vector, so similarity behaviour is unchanged by 2.1. Making similarity type-granular becomes an intentional, separately tested change later (it belongs with the similarity work, not here).
2. `supabase/functions/smart-assistant/index.ts` `searchReviewsSemantic` has a fallback `.in('category', detectedCategories)` fed by five-bucket keyword detection. New canonical categories would silently drop out of that fallback. **Fix: expand the detected buckets to their canonical members** (e.g. detected `product` → `['product','brand','service','professional','course','app','game','others']`, `movie` → `['movie','tv_show']`, `place` → `['place','experience','event']`) so the fallback keeps matching both old and new rows.
3. Also checked and clear: `generate-embeddings`, `backfill-review-embeddings`, `generate-ai-summary`, `unified-search-v2`, `search-all` — none branch on review category. No SQL function filters reviews by category.
The bucket mapping is duplicated once into a small shared Deno helper under `supabase/functions/_shared/` so the two functions and the frontend cannot drift apart silently.

### Also in this phase (closing the 2.0 gaps)
- `isNextDisabled()` gets `case 2: return !selectedSubject && !isEditMode && !isFromEntityPage` so Next is disabled without a subject and "Skip for now" becomes the only explicit way past it.
- Telemetry via the existing `search_funnel_events` path, specific enough to justify 2.2: step-2 shown, subject selected (with canonical type), skip used (with query length and whether results were present), whether a subject was later attached in Step 3, and whether the review submitted.

### Explicitly NOT in this phase
No questionnaire redesign, no required subject, no dish creation, no slug/DB migration, no wizard collapse, no component deletions, no backfill of existing rows, no change to similarity granularity.

## Technical notes
- Files touched: `ReviewForm.tsx` (state split, `subjectOrigin`, persistence, step-2 gating, telemetry), `subjectSelection.ts` (add strict `resolveQuestionnaireKind`), `SubjectSelectStep.tsx` (skip event), a new `supabase/functions/_shared/reviewCategoryBuckets.ts`, plus `calculate-lifestyle-similarity` and `smart-assistant` using it.
- `getReviewCategory` inside `ReviewForm` is deleted in favour of the shared mapping, so there is one mapping table rather than two. `handleEntitySelect` (Step 3 fallback) sets both values and marks `subjectOrigin = 'user-selected'`; it is still removed in 2.5.
- Guard: a stored category that cannot be resolved keeps its raw value on save. No coercion to `product`, none to `others`.

## Tests
- New review with a `course`, `tv_show`, `brand`, `service`, `event`, `game`, `app`, `professional`, `others` subject persists that canonical type while `questionnaireKind` stays in the five buckets.
- Skipped Step 2 persists the legacy bucket exactly as today.
- Edit of a legacy review with a linked entity whose type disagrees (`category: 'food'`, entity `place`) re-saves `food`; replacing the subject writes the new canonical type; attaching a subject to an entity-less legacy review writes the canonical type.
- `resolveQuestionnaireKind`: canonical values, the five legacy values, and an unresolvable value (renders product layout, save preserves the raw value).
- Bucket helper: every canonical type maps into exactly one of the five buckets, and each bucket expands back to its canonical members (round-trip lock used by both edge functions).
- Step 2 gating: Next disabled with no subject, enabled once selected, unaffected in edit/entity-page mode.
- `bunx vitest run`, `tsgo --noEmit`, and the Deno tests for the shared helper.

## Manual acceptance
1. Review a course → saved review badge reads "Course", questions are the product ones.
2. Review a TV show → badge "TV Show"; a movie still reads "Movie".
3. Review a food entity → dish name + food tags behave exactly as before.
4. Step 2 with nothing selected → Next greyed out, "Skip for now" works and the review still submits.
5. Open an old review in edit mode → same questions, same badge after saving.
6. `/create` composer unchanged.
