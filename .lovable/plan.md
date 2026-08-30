# Phase 3 — Type-aware review questionnaire (retire the five legacy buckets)

## Where we are

Phases 2.0–2.5A made the *subject* honest: every new review is linked to a real
entity, and display badges read the entity's canonical type. But the **form
itself** still runs on the five legacy buckets. Confirmed in code today:

- `ReviewForm.tsx` branches on `category === 'food'` for the title field, the
  `food_tags` metadata, and step validation (lines 506, 576, 630, 659, 780, 871).
- `StepThree.tsx` hardcodes five emoji/label/placeholder ladders
  (`category === 'food' ? … : 'movie' ? … : 'book' ? … : 'place' ? … : product`)
  and gates location on `place | food` only.
- `StepFour.tsx` renders `FoodTagSelector` only when `category === 'food'`.

So a review of a `service`, `course`, `app`, `professional`, or any of the other
canonical types falls into the "product" ladder and is asked product questions.
Phase 3 fixes that: **the questions come from the subject's canonical type, from
one registry, not from `if` chains.**

## Goal

One declarative questionnaire registry keyed by the 15 canonical entity types.
Steps 3 and 4 render from it. No component contains a per-category `if` chain.

## Phase 3.0 — Registry foundation (this phase)

### 1. The registry

New `src/components/profile/reviews/questionnaire/registry.ts`:

- A `QuestionnaireField` descriptor: `key`, `label`, `inputType`
  (`text | textarea | tags | rating | enum | date | location`), `placeholder`,
  `maxLength`, `required`, `storage` (`title | metadata.<k>`).
- A `QuestionnaireSpec` per canonical type: `titleLabel`, `titlePlaceholder`,
  `contextLabel` (the "who made this" line), `icon`, `showLocation`,
  `fields: QuestionnaireField[]`.
- `getQuestionnaireSpec(type: CanonicalEntityType): QuestionnaireSpec` with an
  explicit entry for all 15 types — no `product` default, matching the existing
  taxonomy rule. An unknown/unresolved type yields a deliberately minimal
  generic spec flagged as such, never a coerced `product` spec.

Specs are seeded from what the current form asks, then extended per type
(e.g. `service`/`professional` → who performed it, how long it took;
`course` → format, completion; `food` keeps `food_tags`).

### 2. Resolve the type from the subject, not from the bucket

The wizard already knows the selected subject. `resolveReviewDisplayType`
(Phase 2.5A) already returns an honest canonical type. Phase 3 reuses it as the
questionnaire key, with the same honesty rules: failed/absent lookups fall back
to the generic spec, never to `product`.

### 3. Render Step 3 / Step 4 from the spec

- `StepThree.tsx`: replace the emoji/label/placeholder ladders with values from
  the spec; location block shows when `spec.showLocation`.
- `StepFour.tsx`: replace the `food` conditional with a generic field renderer
  loop over `spec.fields` (`FoodTagSelector` becomes the `tags` input for the
  food spec, not a hardcoded branch).
- `ReviewForm.tsx`: title state, validation, and the metadata bundle are driven
  by the spec's fields instead of `category === 'food'` checks.

### 4. Storage stays compatible

- `reviews.category` keeps storing the canonical type (Phase 2.1 behaviour).
- Extra answers go into the existing `metadata` JSONB under their field key, so
  no migration is needed and existing `food_tags` rows keep rendering.
- Legacy reviews (bucket values, unlinked subjects) render exactly as today.

### 5. Tests

- Registry completeness test: every canonical type has a spec; no spec falls
  back to `product`.
- Spec resolution tests for resolved / failed / absent subject relations.
- Validation test: required title fields per spec block "Next".

## Explicitly out of scope

- Phase 2.5B manual remediation of legacy unlinked reviews — skipped per your
  call.
- Any data backfill or rewrite of existing `reviews.category` values.
- Visual redesign of the wizard (layout/sections refinement is the final step,
  after the content model is right).

## Technical notes

Files touched: new `questionnaire/registry.ts` (+ tests), `StepThree.tsx`,
`StepFour.tsx`, `ReviewForm.tsx`, and a small helper reusing
`reviewDisplayType.ts`. No SQL, no edge functions, no schema change.
