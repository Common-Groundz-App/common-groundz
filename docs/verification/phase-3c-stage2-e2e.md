# Phase 3C Stage 2 — end-to-end materialization evidence

Run token: `543617b1-eb02-435e-8ed3-db7029ccf4f7` (2026-09-04)

## What this proves

```text
form state
  -> buildReviewMetadataForSave()      <- the ONE helper ReviewForm calls on submit
  -> reviews.metadata (written to the real table)
  -> PostgreSQL trigger
  -> reviews.is_recommended read back and asserted in SQL
```

Nothing in the harness hand-writes `metadata.questionnaire`. The generator
(`scripts/build-stage2-e2e-sql.ts`) imports the production helper, so a bug in the
Stage 2 patch builder fails this harness. `ReviewForm` no longer contains its own
copy of that glue — it calls the same function.

## Result: 6 / 6 PASS

| case | rating | stored intent | envelope present | is_recommended | result |
| --- | --- | --- | --- | --- | --- |
| case1_rating1_yes | 1 | yes | yes | true | PASS |
| case2_rating5_no | 5 | no | yes | false | PASS |
| case3_rating5_maybe | 5 | maybe | yes | false | PASS |
| case4_clear_would_recommend | 5 | (removed, `repeat_intent` kept) | yes | true | PASS |
| case5_clear_last_answer | 3 | — | no | false | PASS |
| case6_unrelated_edit_no_envelope | 5 | — | no | true | PASS |

Asserted on every fixture, in SQL, not by eye:
- `is_recommended` equals the expected value.
- `metadata.questionnaire` presence/absence matches expectation.
- `version` is JSON type `number` with value `1` (never `"1"`).
- `questionnaire.type` equals `reviews.category`.
- `answers` is a JSON object.
- Root metadata survives every save byte-identical (`provenance`, `unrelated_key`, run token).

## Fixtures and cleanup

Six explicit per-run UUIDs plus a run token in metadata. Cleanup deleted those
exact ids — no title-prefix match. Post-run check: `remaining_fixture_rows = 0`
(searching both the ids and the run token).

## UNVERIFIED

- The browser -> `supabase-js` -> RLS network hop. This project uses an external
  Supabase (`external_unmanaged`) with no obtainable test session, so writes were
  issued server-side with the app-built metadata rather than through an
  authenticated client. Covered by manual acceptance instead.
- Stage 1 carry-overs: advisory-lock concurrency races (need parallel sessions)
  and owner INSERT / owner undo / non-owner denial from a genuine `auth.uid()`
  session.
