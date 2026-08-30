# Phase 2.5 — Subject as the single source of truth (cleanup & backfill)

Phase 2.4 is verified complete. Every new review now requires a subject, the `service` type is supported, and legacy unlinked rows remain editable. Phase 2.5 retires the remaining legacy category machinery and makes the linked entity the single source of truth for "what kind of review this is."

## Goals

1. Stop reading `reviews.category` for display logic; derive the review's type from `reviews.entity_id → entities.type`.
2. Remove or deprecate the now-dead Step 2 category selection UI (`CategorySelector.tsx`, `steps/StepTwo.tsx`).
3. Provide a safe, admin-only backfill path for the 27 legacy unlinked reviews and the 17 legacy mismatched linked reviews.
4. Harden all read paths so a review card/list never renders without a resolved subject.
5. Add lightweight data-quality monitoring so we know if the invariant ever breaks.

## Why now

- Phase 2.4 guarantees new rows are correct, but ~35 % of existing rows are still legacy data.
- Several components still branch on `review.category`, which can be `NULL`, blank, or a pre-Phase-2.1 bucket like `food` on a `place` review.
- Keeping `StepTwo.tsx` and `CategorySelector.tsx` in the tree creates ongoing maintenance cost and risk of re-introducing the old flow.

## Scope

### In scope

- Read-path migration: `ReviewCard`, review lists, profile tabs, and entity pages should resolve the subject and use `entity.type`.
- Dead-code removal / deprecation of legacy Step 2 components.
- Admin-only backfill RPC: `backfill_review_subjects(batch_size int default 50)`.
  - For unlinked reviews: attempt fuzzy match by `review.title` + `review.venue` against `entities.name`.
  - For mismatched linked reviews: update `reviews.category = entities.type` when the mismatch is one of the 17 known legacy cases.
  - Returns a JSON summary: `examined`, `linked`, `category_corrected`, `unresolved`.
  - No automatic backfill; admin must invoke it deliberately.
- A new `review_data_quality` view or RPC for admins showing counts of unlinked, mismatched, and missing-subject rows.
- Telemetry event `review_subject_backfill_result` (counts only, no text).

### Out of scope

- Changing the review questionnaire mapping (`questionnaireKind` stays on the legacy 5-bucket mapping until Phase 3).
- Forcing legacy unlinked reviews to become linked; they stay editable and unlinkable.
- Any new provider/offering relationships beyond the existing `place → food` and `brand → product`.

## Technical plan

### 1. Read-path migration

Audit and update these display sites to resolve `entities` and use `entity.type` as the canonical type:

- `src/components/profile/reviews/ReviewCard.tsx` and any shared review card variants.
- `src/components/profile/reviews/ReviewList.tsx` / `ReviewsSection.tsx`.
- `src/pages/EntityPage.tsx` review tab.
- Any feed or search result that shows a review.

Pattern:

```ts
const subjectType = review.entity?.type ?? review.category ?? 'others';
```

The fallback to `review.category` is a temporary safety net; the goal is to remove it once backfill is done.

### 2. Dead-code cleanup

- `src/components/profile/reviews/steps/StepTwo.tsx` — if it is no longer imported, delete it.
- `src/components/profile/reviews/CategorySelector.tsx` — if still imported by any non-review path, keep but mark `@deprecated`; otherwise delete.
- Remove any `category` state that is no longer written (the form still writes it for now because the trigger requires it, but no UI should depend on it).

### 3. Admin backfill RPC

Migration creates:

```sql
CREATE OR REPLACE FUNCTION public.backfill_review_subjects(p_batch_size int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_examined int := 0;
  v_linked   int := 0;
  v_corrected int := 0;
  v_unresolved int := 0;
  r record;
BEGIN
  -- Only admins may run this.
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = '42501';
  END IF;

  -- 1) Unlinked reviews: fuzzy title/venue match against active entities.
  FOR r IN
    SELECT rev.id AS review_id, rev.title, rev.venue, rev.category
    FROM public.reviews rev
    WHERE rev.entity_id IS NULL
      AND rev.is_deleted = false
    ORDER BY rev.created_at DESC
    LIMIT p_batch_size
  LOOP
    v_examined := v_examined + 1;

    -- Prefer exact name match, then name + venue prefix match.
    UPDATE public.reviews
       SET entity_id = (
         SELECT e.id
         FROM public.entities e
         WHERE e.is_deleted = false
           AND public.normalize_identity_name(e.name)
               = public.normalize_identity_name(r.title)
         ORDER BY e.created_at DESC
         LIMIT 1
       ),
           category = COALESCE(r.category, 'others')
     WHERE id = r.review_id
       AND entity_id IS NULL;

    IF FOUND THEN
      v_linked := v_linked + 1;
    ELSE
      v_unresolved := v_unresolved + 1;
    END IF;
  END LOOP;

  -- 2) Mismatched linked reviews: correct category to entity.type.
  UPDATE public.reviews rev
     SET category = e.type
    FROM public.entities e
   WHERE rev.entity_id = e.id
     AND rev.category IS DISTINCT FROM e.type::text
     AND rev.is_deleted = false;

  GET DIAGNOSTICS v_corrected = ROW_COUNT;

  RETURN jsonb_build_object(
    'examined', v_examined,
    'linked', v_linked,
    'category_corrected', v_corrected,
    'unresolved', v_unresolved
  );
END;
$$;
```

Grants: `GRANT EXECUTE ON FUNCTION public.backfill_review_subjects(int) TO authenticated;` (the admin check gates it).

### 4. Data quality view

```sql
CREATE OR REPLACE VIEW public.review_data_quality AS
SELECT
  (SELECT count(*) FROM public.reviews WHERE is_deleted = false AND entity_id IS NULL) AS unlinked_count,
  (SELECT count(*) FROM public.reviews rev JOIN public.entities e ON rev.entity_id = e.id WHERE rev.is_deleted = false AND rev.category IS DISTINCT FROM e.type::text) AS mismatched_count,
  (SELECT count(*) FROM public.reviews rev LEFT JOIN public.entities e ON rev.entity_id = e.id WHERE rev.is_deleted = false AND (e.id IS NULL OR e.is_deleted)) AS missing_subject_count;
```

Policy: `authenticated` can `SELECT`, but only admins see useful data (the app can filter client-side, or we can make it `service_role` only and expose via edge function). Decision: `service_role` only, exposed through an admin edge function to avoid leaking counts.

### 5. Edge function / admin page

- New edge function `admin-review-quality` (or extend an existing admin function) that calls the view/RPC and returns counts.
- Add a small "Data quality" card in the admin dashboard showing:
  - Unlinked reviews
  - Mismatched category reviews
  - Missing-subject reviews
  - "Run backfill" button (calls `backfill_review_subjects`)

### 6. Telemetry

Add `review_subject_backfill_result` to `supabase/functions/log-search-funnel/allowlists.ts` with payload shape `{ examined, linked, corrected, unresolved }`.

### 7. Tests

- Unit: read-path helpers prefer `entity.type` over `category`.
- Vitest: dead-code import check (no file imports `StepTwo.tsx` or `CategorySelector.tsx` after cleanup).
- Edge function Deno test for the admin quality endpoint (admin vs non-admin).
- Trigger regression: legacy unlinked review remains editable after backfill migration is installed.

## Acceptance criteria

- No user-facing review card/list derives its type solely from `reviews.category`.
- `StepTwo.tsx` and `CategorySelector.tsx` are either deleted or explicitly deprecated and unused.
- Admin can view data-quality counts and run a batched backfill.
- Backfill never deletes data; it only links unlinked rows or corrects `category` to match `entity.type`.
- Legacy unlinked reviews remain editable and savable.
- All tests pass; build is green.

## Manual verification

1. Open a review card in the feed and in a list — the category chip matches the linked entity type, not a stale `reviews.category` value.
2. Open the review form for a legacy unlinked review — "Continue without linking" still works.
3. Admin dashboard → Data quality card shows the current unlinked/mismatched counts.
4. Click "Run backfill" → counts update; some unlinked reviews may now be linked if a fuzzy title match exists.
5. Re-open a backfilled review — it now shows the correct subject and category chip.

Stop for verification after 2.5; config-driven questionnaire registry lands in Phase 3.
