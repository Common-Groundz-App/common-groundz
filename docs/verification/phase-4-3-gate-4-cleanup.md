# Phase 4.3 — Gate 4: audited transactional cleanup

Date: 2026-09-15. Capture id: `9d2d21bd-bd34-4e97-a78f-6be7685973ab`. Executed in the
administrative/owner (migration) context, not as `service_role`. No user-linked identifiers
are recorded here; the row-level manifest stays in the owner-only `audit` schema.

## What ran

One atomic `DO` block scoped to the capture. The two earlier drafts were never executed — the
final version below is the only one that ran, incorporating both review rounds:

1. **Capture bookkeeping completeness** — the selected capture must exist; all eight kinds
   must have exactly one non-null count row; no unexpected kinds in counts or manifest rows;
   manifest rows per kind must equal the recorded counts; no manifest row may lack a record
   id. Historical captures in the schema are legitimate and deliberately not inspected (the
   earlier "exactly one capture globally" guard was removed on review).
2. **Serialisation** — `ACCESS EXCLUSIVE` locks on the four legacy tables; the six audited
   review rows are additionally row-locked with `SELECT ... FOR UPDATE` before validation.
3. **Complete-cohort validation** — for `recommendations`, `recommendation_comments`,
   `recommendation_likes` and `recommendation_saves`: live count equals the manifest count,
   **and** every live row is in the manifest, **and** every manifest row exists live
   (bidirectional identity, so a same-count substitution cannot pass). Review markers must be
   exactly the audited six. No comment like or mention outside the manifest may reference an
   audited comment. Every notification pointing at an audited destination (by exact
   `entity_id`, by exact record route in both singular and plural form, or by an exact
   reconstructed `?commentId=` URL built from each audited comment's parent recommendation id
   and its own id — no wildcards) must itself be audited.
4. **Deletion, trigger-aware order** — the 16 notifications first (so the like retraction
   trigger's bare `UPDATE ... WHERE ...` is a safe no-op), then the 6 review markers cleared
   (`recommendation_id` → NULL, `is_converted` → false; restricting FK), then the 0 comment
   likes and 0 mentions, then 17 comments, 20 likes, 3 saves, and finally the 9 parent
   records. Every step asserts its affected-row count against the manifest.
5. **Final zero assertions** — zero rows in all four legacy tables, zero review markers, zero
   comment likes/mentions referencing audited comments, and zero notifications referencing any
   audited destination by id or exact route. Any mismatch raises and rolls the whole
   transaction back.

## Result

The migration completed successfully with no assertion raised. Post-run live verification:

| Check | Value |
| --- | --- |
| `recommendations` | 0 |
| `recommendation_comments` | 0 |
| `recommendation_likes` | 0 |
| `recommendation_saves` | 0 |
| reviews with `recommendation_id` or `is_converted` | 0 |
| audited notifications remaining | 0 |
| capture row note | updated with the execution timestamp |

The manifest rows and counts are retained in the `audit` schema through the Phase 4.5
close-out for rollback investigation.

The linter reported 436 issues — identical to the pre-capture baseline; no new category and
no exposure of the `audit` schema.

## Untouched, as required

Tables, `recommendation_category`, the two review marker columns (cleared, not dropped),
SELECT policies and indexes all remain for Phase 4.5. Recommendation-type posts, review
endorsements, profile Recs tabs, the v4 entity page and its counts, and the Circle card are
unaffected.

## Next gate

Gate 5 — remove the `/recommendations/:id` route, `RecommendationView`,
`RecommendationContentViewer`, the legacy notification destination mappings, and drop
`recommendations.image_url` from both orphan-media reference sets.
