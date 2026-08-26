# Phase 2.1 verification + Phase 3 — Config-driven questionnaire

## Phase 2.1 verification: complete

Confirmed in code, not assumed:

- `subjectSelection.ts` exports `resolveQuestionnaireKind`, `mapCanonicalToLegacyCategory`, `deriveSubjectPrefill`, and the legacy bucket list.
- `ReviewForm.tsx` keeps questionnaire kind and persisted canonical category separate, and `subjectOrigin` decides which value is written — opening and re-saving an old review cannot rewrite its stored category.
- `supabase/functions/_shared/reviewCategoryBuckets.ts` exists with idempotent normalization, reverse expansion and null-on-unknown; parity with the frontend mapping is asserted by `reviewCategoryBucketParity.test.ts`.
- Telemetry allowlists are extracted to `log-search-funnel/allowlists.ts`; only `hadResults` and a clamped `queryLength` are accepted.
- Full suite green: 27 files, 358 tests. Build log: `build OK`.

One leftover, deliberately deferred in the 2.1 scope: `steps/StepTwo.tsx` and `CategorySelector.tsx` are now unreferenced by the review flow (the remaining `CategorySelector` usage is StepTwo itself; the admin one is a different component). Phase 3 removes them.

## Phase 3 goal

Step 3 and 4 still ask five hardcoded sets of questions driven by a `category: string` and long `switch` chains. A review of a course, game, service or professional is rendered with product wording. Phase 3 replaces the hardcoded branching with a declarative questionnaire config keyed by canonical entity type, and introduces the honest `generic` kind that 2.1 deferred.

No database changes. No wizard-step count change. Persistence shape stays exactly as 2.1 left it.

## What changes for the user

- A course review asks "Who teaches this?" instead of "Who makes this product?"; a service asks "Who provided it?"; a game asks "Who made it?"; a TV show asks "Who created it?".
- Subjects whose type has no tailored questionnaire get neutral wording ("What is this?", "Who's behind it?") rather than product wording.
- Location prompts and food tags appear only for types where they make sense, driven by config flags rather than `category === 'place' || category === 'food'`.
- Everything else — rating rings, media, date, visibility, timeline, edit window — is untouched.

## Technical plan

**3.1 Questionnaire config module** (`src/components/profile/reviews/questionnaireConfig.ts`, plain TS, no React)
- `QuestionnaireKind = LegacyReviewCategory | 'generic'`.
- One record per canonical entity type → `{ kind, titleLabel, titlePlaceholder, secondaryLabel, secondaryPlaceholder, emoji, showLocation, showFoodTags, showVenueAsAddress }`, exhaustive over `CanonicalEntityType` so a 16th type cannot compile without a config entry.
- `resolveQuestionnaire(canonicalType | legacyValue): QuestionnaireConfig` — canonical types resolve directly; the five legacy bucket values resolve to their existing config so old reviews render exactly as today; anything unresolved resolves to `generic`, replacing the current product-shaped fallback.

**3.2 Wire Step 3**
- `StepThree.tsx` takes a `questionnaire: QuestionnaireConfig` prop instead of branching on `category`. All five `switch(category)` blocks and the inline emoji/placeholder ternaries are deleted and read from config.
- `isLocationRelevantCategory` becomes `questionnaire.showLocation`; food-tag rendering becomes `questionnaire.showFoodTags`; the venue-vs-address handling becomes `questionnaire.showVenueAsAddress`.
- Google Places selection behaviour and the food "restaurant name into venue" rule are preserved, just expressed through the flags.

**3.3 Wire Step 4 and ReviewForm**
- `StepFour.tsx` and `ReviewForm.tsx` header copy (`Tell us about your ${category}`) use the config label.
- `ReviewForm` keeps its existing state; the questionnaire is derived from the subject's canonical type when there is one, otherwise from the loaded legacy category. Validation messages come from the config labels instead of interpolating the raw category string.
- Save path unchanged: `persistedCategory` logic from 2.1 stays byte-identical.

**3.4 Dead-code removal**
- Delete `steps/StepTwo.tsx` and `reviews/CategorySelector.tsx` (review-flow one only; the admin component stays).

**3.5 Tests**
- Every canonical type resolves to a config; no type falls through to `product` implicitly.
- The five legacy values resolve to configs identical to today's rendering (regression guard).
- Unknown/null resolves to `generic`, never `product`.
- `showFoodTags` is true only for `food`; `showLocation` only for the location-relevant types.
- Existing `subjectSelection` and parity suites must stay green; new test registered in `vitest.config.ts`.

Verification: full Vitest run, `tsgo --noEmit`, and a clean build log before reporting.

## Out of scope

Required subjects, dish/offering creation, collapsing Step 1 and 2, `reviews.category` backfill or `NOT NULL`, new questionnaire *fields* (only labels/visibility are config-driven here), recommendation categories, and any Supabase migration.
