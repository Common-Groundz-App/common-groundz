# Phase 2.5A — Legacy path removal and honest display types

Revised three times per review. No migrations, no backfill, no data repair, no stored-value rewriting. Frontend cleanup plus display-type correctness only.

Labelled **2.5A**. Wizard consolidation is deferred to an explicit 2.5B decision (see end).

## What was verified in the current code

- `steps/StepTwo.tsx` is imported by nothing. `profile/reviews/CategorySelector.tsx` is imported only by `StepTwo.tsx`. Both are fully dead.
- `steps/StepThree.tsx` runs a **second** subject-selection state machine: `EntitySearch` import, `showEntitySearch` state, its own `handleEntitySelection` rewriting name/venue/metadata, plus a local processed-entity copy applying `ensureHttps()` to `image_url`.
- `ReviewForm.tsx` still defines `handleEntitySelect` (line 526) and passes `disableEntityChange` / `disableEntityFields`, both `isFromEntityPage || !!selectedSubject` — always `true` on the new-review path since 2.4.
- `profile/reviews/ReviewCard.tsx` reads `review.category` in four places (badge label, badge colour, fallback image, image alt).
- **The plan's earlier read-path target was wrong.** `src/hooks/reviews/use-reviews-fetch.ts` imports `fetchUserReviews` from `@/services/reviewService.ts`, which contains its **own duplicate implementation** (line 256) — not the one in `src/services/review/fetch.ts`. `fetchUserRecommendations` (line 340) is a third copy with the same entity select. Editing `review/fetch.ts` alone would not affect Profile → Reviews or its filter chips.
- **Failed lookup is currently indistinguishable from absence.** `reviewService.ts` lines 286-291: on `entitiesError` it logs and leaves `entities = []`, then maps `entity: entity ? {...} : undefined`. A transient error therefore looks identical to "subject deleted".
- **A real `not-loaded` producer exists.** `entityService.ts` `fetchEntityReviews` sets `entity: undefined, // Entity not included in select` (line 322), and both `EntityDetail.tsx` and `EntityDetailV2.tsx` render the profile `ReviewCard` from it.
- All three entity selects (`reviewService.ts` 284 and 372) are `id, name, type, image_url` — no `is_deleted`.
- `src/components/admin/CategorySelector.tsx` is a different component used by `CreateEntityDialog`. Untouched.

## Scope

### In scope

1. Delete `steps/StepTwo.tsx` and `profile/reviews/CategorySelector.tsx`.
2. Remove Step 3's duplicate subject search so `handleSubjectChange` is the only subject mutation path.
3. Remove `handleEntitySelect` and the constant `disableEntityChange` / `disableEntityFields` props.
4. Add a strict display-type resolver with explicit relation states, including a distinct **lookup-failed** state.
5. Update the **actual** ReviewCard data producers to emit those states.
6. Align profile filter chips with the resolved display type.
7. Tests for the resolver and the producer mapping.

### Explicitly out of scope

- No SQL, migration, RPC, backfill, dry-run report, or data-quality view.
- No rewriting of any stored `reviews.category` value.
- No change to `questionnaireKind` / the five legacy buckets — that is Phase 3.
- No wizard restructure; steps stay 1–4.
- No requirement that a card resolve an entity. Legacy unlinked rows keep rendering.
- No consolidation of the duplicate `fetchUserReviews` implementations. That refactor is real but separate; this phase fixes the live paths and leaves the dormant copy alone rather than risking a behaviour change mid-cleanup.

## Technical plan

### 1. Delete dead files

- `rm src/components/profile/reviews/steps/StepTwo.tsx`
- `rm src/components/profile/reviews/CategorySelector.tsx`

TypeScript compilation is the guard. No filesystem-scanning test.

### 2. Step 3 stops selecting subjects

In `steps/StepThree.tsx`:

- Drop the `EntitySearch` import, `showEntitySearch` state, `handleEntitySelection`, and `getEntitySearchType`.
- Entity preview renders read-only — no "Change" affordance. Swapping subjects means clearing it in Step 2.
- Drop `disableEntityChange` / `disableEntityFields`. Name is read-only when a subject is present; **venue stays editable**.
- **Preserve the `ensureHttps()` image normalization** as a pure `useMemo` derivation (or confirm `EntityPreviewCard` normalizes internally). Removing the state must not silently drop it.
- The metadata prefill already happens in `ReviewForm.handleSubjectChange`, so nothing is lost.

In `ReviewForm.tsx`: remove `handleEntitySelect`, its `onEntitySelect` wiring, and the two `disable*` props at the `StepThree` call site.

### 3. Strict display-type resolver

New pure module `src/components/profile/reviews/reviewDisplayType.ts`.

Four relation states — a failed lookup is **not** proof of absence:

```ts
type SubjectRelation =
  | { status: 'not-loaded' }   // the path never queried entities at all
  | { status: 'failed' }       // query ran and errored; nothing is known
  | { status: 'resolved'; type: string; isDeleted: boolean }
  | { status: 'absent' };      // query SUCCEEDED and returned no row for entity_id
```

`legacy` carries a **verified** canonical type, never a raw string, so `ReviewCard` cannot pass an unvalidated value to a fallback-friendly helper:

```ts
export type ReviewDisplayType =
  | { kind: 'canonical'; type: CanonicalEntityType }
  | { kind: 'legacy'; type: CanonicalEntityType }
  | { kind: 'unavailable' }
  | { kind: 'unknown' };
```

Rules, in order:

1. No `entity_id` → `legacy` if the stored `category` parses to a canonical type, else `unknown`.
2. `entity_id` + `resolved` + not deleted → `canonical` from `entity.type`.
3. `entity_id` + `resolved` + deleted, or `absent` → `unavailable`.
4. `entity_id` + `not-loaded` or `failed` → `legacy` if the stored category parses, else `unknown`. **Never `unavailable`.**

Two hard rules:

- **Never invent `others`.** The stored category is parsed against the canonical list **first**; display helpers (`getEntityTypeLabel`, `getEntityTypeFallbackImage`) are only ever called with an already-verified canonical value, because they internally fall back to `Others`. Never call them with `''` or a raw string to obtain a generic fallback.
- **Unrecognised legacy strings** (`Travel`, `Music`, `Activity`, blank, null) → `unknown`, no badge.

Note: if RLS hides soft-deleted rows, a successful query simply cannot return them and the row maps to `absent`. That is fine — deleted and genuinely missing subjects both intentionally render as `unavailable`.

### 4. Update the actual data producers

**`src/services/reviewService.ts` — `fetchUserReviews` (line 256) and `fetchUserRecommendations` (line 340).** This is the live Profile → Reviews path.

- Add `is_deleted` to both entity selects.
- Track the lookup outcome explicitly instead of collapsing to `entities = []`:
  - `entityIds.length === 0` → every row has no `entity_id`, so no relation lookup is needed.
  - `entitiesError` set → all linked rows get `{ status: 'failed' }`.
  - success → matched row → `{ status: 'resolved', type, isDeleted }`; unmatched → `{ status: 'absent' }`.

**`src/services/entityService.ts` — `fetchEntityReviews`.** It deliberately does not select the entity. Replace the bare `entity: undefined` with an honest `{ status: 'not-loaded' }` relation. No new query is added — entity-page cards continue to show their stored category label via the `legacy` branch, matching today's behaviour, and are never mislabelled `unavailable`.

**`src/services/review/fetch.ts`.** Not on the live profile path, but it exports the same symbol names through `review/index.ts`. Give it the same relation mapping so the two copies cannot drift and a future import swap is safe.

The `Review` / `ReviewWithUser` types gain the relation field, so the distinction is type-enforced rather than convention.

### 5. ReviewCard uses the resolver

- `canonical` → badge label and colour from `entity.type`.
- `legacy` → badge from the verified stored category, styled identically. Still true information about an older review.
- `unavailable` / `unknown` → no type badge; the card still renders fully.
- Fallback image and `alt`: use the resolved canonical/legacy type when present; otherwise the review's own `image_url` or the generic review fallback and `"<title> - Review"` alt. **No type-specific fallback image for `unknown`/`unavailable`** unless a genuinely generic review asset already exists.

A card never breaks or hides because the relation was unloaded or failed.

### 6. Align profile filters

`ProfileReviews.tsx` builds chips from `[...new Set(reviews.map(r => r.category))]` and filters on `item.category === activeFilter`. Once badges come from `entity.type`, a "Place" badge could match a "Food" chip.

- Compute each review's display type **once** in a single memo, keyed by review id, and use that one result for both chip generation and filter comparison.
- Chips list only `canonical` / `legacy` types; `unavailable` and `unknown` rows are excluded from chips but stay visible when no filter is active.
- If `activeFilter` is no longer present in the recomputed chip list (after a refresh or a relation resolving differently), clear it, so the screen never silently shows zero rows.

### 7. Tests

- `reviewDisplayType.test.ts`, covering all five resolution situations:
  - resolved active → `canonical`
  - resolved + `isDeleted: true` → `unavailable`
  - `absent` → `unavailable`
  - `not-loaded` → `legacy`/`unknown`, **never** `unavailable`
  - `failed` → `legacy`/`unknown`, **never** `unavailable` (the transient-error regression)
  - unlinked with `Travel` / blank / `null` → `unknown`
  - no branch yields `others` unless the input genuinely was `others`
  - `legacy` output is always a canonical type value
- A mapping test over the producer shape: `entitiesError` → all linked rows `failed`; success with a missing row → `absent`; a path that skips the query → `not-loaded`.
- Register new test files in `vitest.config.ts` (explicit `nodeIncludes` allowlist).
- Existing 368 tests stay green.

## Acceptance criteria

- `StepTwo.tsx` and the review `CategorySelector.tsx` are gone; `admin/CategorySelector.tsx` untouched.
- Step 3 has no entity search and no second subject state machine; `handleSubjectChange` is the only path. `ensureHttps()` preserved.
- `handleEntitySelect`, `disableEntityChange`, `disableEntityFields` removed.
- A failed or unattempted entity lookup never renders a review as "unavailable".
- No code path produces `others` as a fallback; unrecognised legacy categories produce no badge.
- Filter chips and badges derive from one shared per-review resolution; a stale active filter self-clears.
- No database object created, altered, or written. No stored `category` changes.
- Build green, full suite green.

## Manual verification

1. Create a review end to end — Step 2 requires a subject, Step 3 shows it read-only with editable venue, publishing works.
2. Edit a legacy unlinked review — "Continue without linking" works; card shows its stored category label.
3. Open a review whose entity was soft-deleted — no type badge, no error.
4. No "Change" button on the Step 3 preview; subjects only swap via Step 2.
5. Step 3 preview image still loads over https.
6. Profile → Reviews: filter by a chip and confirm the visible rows' badges match it.
7. Entity page (EntityDetail / V2) review cards still render with their category labels.
8. Simulate a blocked entities request (devtools offline for that call) and confirm cards degrade to their stored category, not "unavailable".
9. Admin Create Entity dialog category selector still works.

## Deferred decision (after 2.5A ships)

An explicit call, not a silent omission:

- **2.5B — Wizard consolidation:** semantic step IDs, Subject → Review → Publish, rating merged with details/media, entity-page flow skipping the locked subject stage. No questionnaire redesign.
- **Or cancel it:** keep four steps as intended UX and go to Phase 3 (questionnaire registry replacing the five legacy buckets).
