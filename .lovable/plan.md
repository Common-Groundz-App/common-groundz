# Phase 2.5A — Legacy path removal and honest display types

Revised twice per review. No migrations, no backfill, no data repair, no stored-value rewriting. Everything here is frontend cleanup plus display-type correctness.

Explicitly labelled **2.5A**. Wizard consolidation (semantic step IDs, Subject → Review → Publish, rating merged into details) is **not** included and is **not** silently considered done — it becomes a separate 2.5B decision after this ships. See "Deferred decision" at the end.

## What was verified in the current code

- `steps/StepTwo.tsx` is imported by nothing. `profile/reviews/CategorySelector.tsx` is imported only by `StepTwo.tsx`. Both are fully dead.
- `steps/StepThree.tsx` still runs a **second** subject-selection state machine: it imports `EntitySearch`, keeps `showEntitySearch` state, and has its own `handleEntitySelection` that rewrites name/venue/metadata. It also builds a local processed entity copy applying `ensureHttps()` to `image_url`.
- `ReviewForm.tsx` still defines `handleEntitySelect` (line 526) and passes `disableEntityChange` / `disableEntityFields` to Step 3, both computed as `isFromEntityPage || !!selectedSubject`. Since Phase 2.4 makes a subject mandatory for new reviews, these are always `true` on the new-review path.
- `profile/reviews/ReviewCard.tsx` reads `review.category` directly in four places (badge label, badge colour, fallback image, image alt), with no entity-derived alternative.
- **The loaded/missing conflation is real.** `src/services/review/fetch.ts` loads entities in a second query at lines 112 and 198 with `.select('id, name, type, image_url')` — **no `is_deleted`** — then assigns `entity: entity ? {...} : undefined` (lines 150, 236). So `review.entity === undefined` currently means "not fetched", "no row found", and "soft-deleted and filtered" all at once. Any resolver that reads only `review.entity` will mislabel rows.
- `src/components/admin/CategorySelector.tsx` is a **different** component, used by `CreateEntityDialog`. It stays untouched.

## Scope

### In scope

1. Delete the dead category picker: `steps/StepTwo.tsx` and `profile/reviews/CategorySelector.tsx`.
2. Remove Step 3's duplicate subject search so `handleSubjectChange` is the only subject mutation path.
3. Remove `handleEntitySelect` and the now-constant `disableEntityChange` / `disableEntityFields` props.
4. Add a strict display-type resolver with an **explicit relation-loading state**.
5. Make every profile review read path supply the fields the resolver needs.
6. Tests for the resolver and the fetch shape.

### Explicitly out of scope

- No SQL, no migration, no RPC, no backfill, no dry-run report, no data-quality view.
- No rewriting of any stored `reviews.category` value.
- No change to `questionnaireKind` / the five legacy buckets — that is Phase 3.
- No wizard restructure and no rating-page consolidation; steps stay 1–4 (see Deferred decision).
- No requirement that a review card resolve an entity. Legacy unlinked rows must keep rendering.

## Technical plan

### 1. Delete dead files

- `rm src/components/profile/reviews/steps/StepTwo.tsx`
- `rm src/components/profile/reviews/CategorySelector.tsx`

Both are unreferenced; deletion is behaviour-neutral. TypeScript compilation is the guard — a stray import would fail to resolve. **No filesystem-scanning test is added**; that would be brittle and adds nothing over the build.

### 2. Step 3 stops selecting subjects

In `steps/StepThree.tsx`:

- Drop the `EntitySearch` import, the `showEntitySearch` state, `handleEntitySelection`, and `getEntitySearchType`.
- The entity preview renders read-only: no "Change" affordance. Swapping subjects means going back to Step 2 and clearing it there.
- Drop the `disableEntityChange` / `disableEntityFields` props. The name field is read-only whenever a subject is present; **venue stays editable**.
- **Keep the image normalization.** The local processed-entity copy applied `ensureHttps()` to `image_url`. Removing the state must not remove that. Either confirm `EntityPreviewCard` normalizes internally, or keep a small pure `useMemo` derivation that applies `ensureHttps()` — no state machine, just a derived value.
- The metadata-derived prefill that `handleEntitySelection` performed already happens in `ReviewForm.handleSubjectChange`, so nothing is lost.

In `ReviewForm.tsx`:

- Remove `handleEntitySelect` and its `onEntitySelect` wiring.
- Remove the two `disable*` props from the `StepThree` call site.

### 3. Strict display-type resolver with explicit load state

New pure module `src/components/profile/reviews/reviewDisplayType.ts`.

The resolver takes an explicit signal for whether the entity relation was attempted, so "not fetched" can never be reported as "missing":

```ts
type SubjectRelation =
  | { status: 'not-loaded' }                       // the query never joined/fetched entities
  | { status: 'resolved'; type: string; isDeleted: boolean }
  | { status: 'absent' };                          // lookup ran, no active row for entity_id

export type ReviewDisplayType =
  | { kind: 'canonical'; type: CanonicalEntityType }  // linked, resolved, active
  | { kind: 'legacy'; category: string }              // usable stored category
  | { kind: 'unavailable' }                           // linked, lookup ran, row missing/deleted
  | { kind: 'unknown' };                              // nothing reliable
```

Rules, in order:

1. No `entity_id` → `legacy` if the stored `category` parses to a canonical type, else `unknown`.
2. `entity_id` + relation `resolved` + not deleted → `canonical` with `entity.type`.
3. `entity_id` + relation `resolved`/`absent` but deleted or missing → `unavailable`.
4. `entity_id` + relation `not-loaded` → `legacy` if the stored category parses, else `unknown`. **Never `unavailable`.**

Two hard rules:

- **Never invent `others`.** `others` is a real user-selected type and may only come from a real entity type or a real stored category. The resolver parses the stored category against the canonical list **first** and only then calls display helpers (`getEntityTypeLabel`, `getEntityTypeFallbackImage`) with a verified canonical value — those helpers internally fall back to `Others`, so passing them unvalidated strings is exactly the bug to avoid.
- **Unrecognised legacy strings** (`Travel`, `Music`, `Activity`, blank) resolve to `unknown`, not to a canonical type. The card simply shows no type badge.

### 4. Make the read paths supply what the resolver needs

In `src/services/review/fetch.ts` (both list paths, ~lines 105-160 and ~185-245):

- Add `is_deleted` to the two entity `.select(...)` lists.
- Distinguish the three cases in the mapped result rather than collapsing to `undefined`: when `entity_id` is set and the batch lookup ran, emit a relation with `status: 'resolved'` (carrying `type` and `is_deleted`) or `status: 'absent'`; when the path does not fetch entities at all, emit `status: 'not-loaded'`.
- Audit the single-review path (`fetchReviewWithSummary`) the same way. If it does not load the entity, it reports `not-loaded` honestly — it must not report `absent`.

The profile `Review` type gains the relation field so the distinction is type-enforced rather than convention.

### 5. ReviewCard uses the resolver

- `canonical` → existing badge label and colour, derived from `entity.type`.
- `legacy` → the stored category label, styled the same. It is still true information about that older review.
- `unavailable` → no type badge; the card still renders fully.
- `unknown` → no type badge.
- Fallback image and image `alt`: use the resolved canonical/legacy type when there is one; otherwise the generic review fallback and `"<title> - Review"` alt. No `others` substitution.

A card never breaks or hides because the relation was not loaded — it degrades to `legacy`/`unknown`.

### 6. Related consistency check (my addition)

`ProfileReviews.tsx` builds its filter chips from `[...new Set(reviews.map(r => r.category))]` and filters on `item.category === activeFilter`. Once the badge shows `entity.type` but the chip is built from stored `category`, a user can see a "Place" badge that a "Food" filter chip matches. Fix in the same patch by deriving both the chip list and the filter comparison from the resolver's canonical/legacy value, and excluding `unavailable`/`unknown` rows from the chip list. Rows with no reliable type stay visible when no filter is active.

### 7. Tests

- `reviewDisplayType.test.ts`: every branch, including
  - linked + `not-loaded` → `legacy`/`unknown`, never `unavailable` (the regression this patch exists for),
  - linked + resolved + `is_deleted: true` → `unavailable`,
  - unlinked with `Travel` / blank / `null` category → `unknown`,
  - an assertion that no branch ever yields `others` unless the input genuinely was `others`.
- A mapping test over the `fetch.ts` shape: an `entity_id` with no matching row maps to `absent`, a matching active row maps to `resolved`, a path that skips the entity query maps to `not-loaded`.
- Register new test files in `vitest.config.ts` (it uses an explicit `nodeIncludes` allowlist).
- Existing suite (368 tests) stays green.

## Acceptance criteria

- `StepTwo.tsx` and the review `CategorySelector.tsx` no longer exist; `admin/CategorySelector.tsx` is untouched.
- Step 3 contains no entity search and no second subject state machine; `handleSubjectChange` is the only path that sets a subject. Entity preview image normalization is preserved.
- `handleEntitySelect`, `disableEntityChange`, and `disableEntityFields` are gone from the review wizard.
- A review with an unfetched entity relation is never displayed as "unavailable".
- No code path can produce `others` as a fallback type; unrecognised legacy categories produce no badge.
- Profile review filter chips and the badge agree on the same resolved type.
- No database object is created, altered, or written. No stored `category` value changes.
- Build green, full test suite green.

## Manual verification

1. Create a new review end to end — Step 2 requires a subject, Step 3 shows the subject read-only with an editable venue, publishing works.
2. Edit a legacy unlinked review — "Continue without linking" still works and the card shows its stored category label.
3. Open a review whose entity was soft-deleted — the card renders with no type badge and does not error.
4. Confirm no "Change" button appears on the Step 3 entity preview, and the only way to swap subjects is clearing it in Step 2.
5. Confirm the Step 3 entity preview image still loads over https.
6. Profile → Reviews: filter by a type chip and confirm the rows shown match the badges displayed.
7. Confirm the admin Create Entity dialog's category selector still works (separate admin component).

## Deferred decision (after 2.5A ships)

Wizard consolidation is a real open question, not a completed item. Once 2.5A is verified, choose one:

- **2.5B — Wizard consolidation:** semantic step IDs instead of numeric 1–4, Subject → Review → Publish, rating merged with details/media, entity-page flow skipping the locked subject stage. No questionnaire redesign.
- **Cancel it:** keep the four-step experience as the intended UX and go straight to Phase 3 (questionnaire registry replacing the five legacy buckets).

Either way it is an explicit call, made after this patch.
