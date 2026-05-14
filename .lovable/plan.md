# Add viewer identity constraint to `media_views`

## Why
Right now `media_views` allows two bad row shapes:
- both `user_id` and `anon_session_id` null (no viewer)
- both `user_id` and `anon_session_id` set (ambiguous viewer)

Either case breaks the assumption behind the two partial unique dedupe indexes. We want exactly one identity per row.

## Change
Single migration that adds a CHECK constraint to the existing table:

```sql
ALTER TABLE public.media_views
ADD CONSTRAINT media_views_exactly_one_viewer
CHECK (
  (user_id IS NOT NULL AND anon_session_id IS NULL)
  OR
  (user_id IS NULL AND anon_session_id IS NOT NULL)
);
```

## Notes
- No code changes needed — the edge function already resolves `user_id` from the JWT and only sends `anon_session_id` when there's no logged-in user, so it already satisfies this invariant.
- No data backfill needed — table is new and empty.
- No RLS, indexes, or other schema affected.

## Verification
- Migration runs cleanly.
- Insert via `track-media-view` for a logged-in user still works (user_id set, anon null).
- Insert via `track-media-view` for a guest still works (anon set, user_id null).
