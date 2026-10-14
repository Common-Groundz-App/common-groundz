# Make the Phase 4 migration explicitly all-or-nothing

## Finding
- `post-video-phase-4-migration.sql` has no `BEGIN;` or `COMMIT;`. You're right.
- I can't prove from anything I can read here that the migration tool wraps a whole file in one transaction. Earlier I said it does, and that claim was unsupported. So the file gets its own transaction rather than relying on the tool.

## Change (wording of the transaction only, no behaviour change)
- Add `BEGIN;` as the first statement, before section 1.
- Add `COMMIT;` as the last statement, after the `patch_content_media_from_mux` definition. That is after every new column, trigger, function and permission.
- Every statement in the file can run inside a transaction: column add, function create/replace, trigger drop/create, grants and revokes. There is no `CONCURRENTLY` and no `VACUUM`. So any error rolls back every Phase 4 object, and nothing is left half-installed.
- If the tool does wrap the file itself, the inner `BEGIN;` only raises a warning, and `COMMIT;` still commits the Phase 4 objects together. The all-or-nothing result holds either way.
- Tests, Edge Function drafts and Phase 4 logic stay untouched. The undo script already has its own `BEGIN;`/`COMMIT;`.
- After the edit:
  - Refresh the copy in Files, saved as a new version `post-video-phase-4-migration_v2.sql`.
  - Show the new fingerprint, plus a line-by-line comparison proving only those two lines changed.

## Ready before execution (prepared and shown now, nothing run)
- **Pre-migration snapshot, read-only.** The exact SQL, shown in the report, will be run immediately before the migration:
  - a count of Posts, and a media checksum (md5 of `media::text`) for each Post;
  - a count of links, split by blank and filled `media_id`;
  - the checksums of the two named historical Posts;
  - the fingerprints of the five live rules, matching the undo script header.
- **After the migration:**
  - Confirm, read-only, that all new objects exist and nothing is partial. That means the column, the trigger, the four new functions and the changed permissions.
  - Compare the snapshot. No Post media checksum should change.
- **Undo script:** unchanged, already in Files.

Then stop for your go-ahead on Step 2.
