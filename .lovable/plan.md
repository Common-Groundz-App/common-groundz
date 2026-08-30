# Phase 2.5 — Review wizard cleanup and honest display types

Revised per review. No migrations, no backfill, no data repair. Every change is frontend cleanup plus display-type correctness. All the reviewer's rejections are accepted: no fuzzy title linking, no `LIMIT 1` identity selection, no bulk category rewriting, no coercion to `others`, no telemetry through the search funnel, no new admin dashboard.

## What was verified in the current code

- `steps/StepTwo.tsx` is imported by nothing. `profile/reviews/CategorySelector.tsx` is imported only by `StepTwo.tsx`. Both are fully dead.
- `steps/StepThree.tsx` still runs a **second** subject-selection state machine: it imports `EntitySearch`, keeps `showEntitySearch` state, and has its own `handleEntitySelection` that rewrites name/venue/metadata.
- `ReviewForm.tsx` still defines `handleEntitySelect` (line 526) and passes `disableEntityChange` / `disableEntityFields` to Step 3, both computed as `isFromEntityPage || !!selectedSubject`. Since Phase 2.4 makes a subject mandatory for new reviews, these are always `true` on the new-review path.
- `ReviewCard.tsx` reads `review.category` directly in four places (badge label, badge colour, fallback image, image alt) with no entity-derived alternative.
- `src/components/admin/CategorySelector.tsx` is a **different** component, used by `CreateEntityDialog`. It stays untouched.

## Scope

### In scope

1. Delete the dead category picker: `steps/StepTwo.tsx` and `profile/reviews/CategorySelector.tsx`.
2. Remove Step 3's duplicate subject search so `handleSubjectChange` is the only subject mutation path.
3. Remove `handleEntitySelect` and the now-constant `disableEntityChange` / `disableEntityFields` compatibility props.
4. Add a strict display-type resolver and use it in `ReviewCard`.
5. Tests for the resolver and a dead-import guard.

### Explicitly out of scope

- No SQL, no migration, no RPC, no backfill, no dry-run report, no data-quality view.
- No rewriting of any stored `reviews.category` value.
- No change to `questionnaireKind` / the five legacy buckets — that is Phase 3.
- No wizard restructure (Subject → Review → Publish) and no rating-page consolidation; steps stay 1–4.
- No requirement that a review card resolve an entity. Legacy unlinked rows must keep rendering.

## Technical plan

### 1. Delete dead files

- `rm src/components/profile/reviews/steps/StepTwo.tsx`
- `rm src/components/profile/reviews/CategorySelector.tsx`

Both are unreferenced; deletion is behaviour-neutral.

### 2. Step 3 stops selecting subjects

In `steps/StepThree.tsx`:

- Drop the `EntitySearch` import, the `showEntitySearch` state, and `handleEntitySelection`.
- Drop `getEntitySearchType`.
- The entity preview card renders read-only: no "Change" affordance, since the subject is chosen in Step 2 and can be cleared there.
- Drop the `disableEntityChange` / `disableEntityFields` props. The name field is read-only whenever a subject is present; **venue stays editable** (unchanged from Phase 2.4).
- The metadata-derived prefill that `handleEntitySelection` performed already happens in `ReviewForm.handleSubjectChange`, so nothing is lost.

In `ReviewForm.tsx`:

- Remove `handleEntitySelect` and its `onEntitySelect` wiring.
- Remove the two `disable*` props from the `StepThree` call site.

### 3. Strict display-type resolver

New pure module `src/components/profile/reviews/reviewDisplayType.ts`:

```ts
export type ReviewDisplayType =
  | { kind: 'canonical'; type: CanonicalEntityType }   // linked, entity resolved
  | { kind: 'legacy'; category: string }               // unlinked, parseable stored category
  | { kind: 'unavailable' }                            // linked but entity missing / soft-deleted
  | { kind: 'unknown' };                               // nothing reliable
```

Rules, in order:

1. Linked with a resolved, non-deleted entity → `canonical` with `entity.type`.
2. Linked but the entity is missing or `is_deleted` → `unavailable`.
3. Not linked, stored `category` parses to a known label → `legacy`.
4. Otherwise → `unknown`.

Never returns `others` as a fallback — `others` is a real user-selected type and must only come from a real entity or a real stored category.

### 4. ReviewCard uses the resolver

- `canonical` → the existing badge label and colour, derived from `entity.type`.
- `legacy` → the stored category label, styled the same (it is still true information about that older review).
- `unavailable` → no type badge; the card still renders fully.
- `unknown` → no type badge.
- Fallback image and image `alt`: use the resolved canonical/legacy type when there is one; otherwise the generic review fallback and `"<title> - Review"` alt. No `others` substitution.

Card rendering never depends on the entity relation being loaded — an unloaded relation degrades to `legacy`/`unknown`, never to a broken card.

### 5. Tests

- `reviewDisplayType.test.ts`: all four branches, including linked-but-soft-deleted and blank/garbage category, and an assertion that no branch invents `others`.
- A guard test asserting nothing imports `steps/StepTwo` or `profile/reviews/CategorySelector`.
- Existing suite (368 tests) stays green; register new test files in `vitest.config.ts`.

## Acceptance criteria

- `StepTwo.tsx` and the review `CategorySelector.tsx` no longer exist; `admin/CategorySelector.tsx` is untouched.
- Step 3 contains no entity search and no second subject state machine; `handleSubjectChange` is the only path that sets a subject.
- `handleEntitySelect`, `disableEntityChange`, and `disableEntityFields` are gone from the review wizard.
- A linked review's badge comes from `entity.type`; a legacy unlinked review still renders with its stored category; a review whose subject is missing renders without a type badge.
- No code path can produce `others` as a fallback type.
- No database object is created, altered, or written. No stored `category` value changes.
- Build green, full test suite green.

## Manual verification

1. Create a new review end to end — Step 2 requires a subject, Step 3 shows the subject read-only with an editable venue, publishing works.
2. Edit a legacy unlinked review — "Continue without linking" still works and the card shows its stored category label.
3. Open a review whose entity was soft-deleted — the card renders with no type badge and does not error.
4. Confirm no "Change" button appears on the Step 3 entity preview and the only way to swap subjects is clearing it in Step 2.
5. Confirm the admin Create Entity dialog's category selector still works (it uses the separate admin component).

Legacy remediation, if ever wanted, is a later manual/admin phase. Questionnaire registry work stays in Phase 3.
