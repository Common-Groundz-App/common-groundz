# Phase 4 migration: confirm how the migration tool runs it, then v2

## What is confirmed
- No documentation I can reach says how the migration tool runs a file. It doesn't say whether it wraps one transaction, uses one connection, stops on the first error, or rolls back.
- My earlier "single transaction" statements were unsupported. The claim that an inner `BEGIN`/`COMMIT` is harmless with every runner is withdrawn.
- So the execution method has to be measured. The probe below answers it before Phase 4 runs.

## Step 1: transaction probe (needs your approval; touches no real data)
A tiny migration through the same tool, using a throwaway table that is never used by the app:
```sql
CREATE TABLE public._p4_txn_probe (id int);
INSERT INTO public._p4_txn_probe VALUES (pg_backend_pid());
SELECT 1/0;   -- forced error
```
Then read-only checks:
- `to_regclass('public._p4_txn_probe')`:
  - **NULL** means the tool stopped at the error and rolled back the whole file.
  - **present** means it does not; the probe table is then dropped by a follow-up migration.
- Whether the failed probe left a migration-history entry. It should not.
- One connection, no splitting: a second probe that succeeds. It records `pg_backend_pid()` and `txid_current()` from its first and last statement into a temp-free probe table, then drops the table in the same file. If both ids match, the file ran in one transaction on one connection. The ids are reported before the drop.

## Step 2: write v2 to match the measured behaviour
- **The tool owns one transaction** (ids match, and the error rolled everything back): v2 = v1 unchanged, plus a header comment recording the evidence. No inner `BEGIN`/`COMMIT`.
- **No outer transaction** (one connection, statements run as they come): v2 adds `BEGIN;` as the first line and `COMMIT;` after the last Phase 4 statement. That is two lines.
- **Statements split across connections, or it doesn't stop on error:** stop and report. Phase 4 is not run through this tool.
- The undo script follows the same rule as v2, so it either keeps or loses its own `BEGIN`/`COMMIT` the same way.
- Deliver the v2 files in Files with a line-by-line comparison against v1 and new fingerprints. Phase 4 logic, tests and function drafts are unchanged.

## Pre-migration snapshot and object manifest (read-only, prepared now)
- Per-Post md5 of `media::text`, a Post count, and the two named historical Posts.
- Links counted in total and by status. The `media_id` split is used only if that column exists: checked through `information_schema`, otherwise reported as "column not present". That keeps it safe to run before the migration.
- **Full changed-object manifest:**
  - existence, fingerprint and permissions for:
    - `posts_media_mux_before`
    - `post_mux_link_items`
    - `sync_mux_post_mappings_core`
    - `sync_mux_post_mappings`
    - `patch_content_media_from_mux`
    - `post_media_storage_key`
    - `post_media_identity`
    - `post_media_assign_ids`
    - `mux_mapping_require_media_id`
  - trigger `mux_mapping_require_media_id`;
  - column `mux_upload_mappings.media_id`.
- Expected before: five functions present with the captured fingerprints, the other four functions absent, the trigger absent, the column absent.
- Expected after: all present, and Post media checksums unchanged.

Then stop for your execution approval.
