# Review Video Phase 5 — Review & Timeline-Update video views

Status: **implemented, awaiting focused QA** (not yet marked complete). The review video flag remains OFF in production.

Phase 6 audit correction (2026-10-17): the earlier automatic results did not establish end-to-end correctness. Review display keys were being submitted as persisted media IDs; card/lightbox now use the separately retained original `viewMediaId`. Deleted media is rejected server-side. Regression checks: full app 1,156 passed / 3 skipped / 0 failed; Edge helpers 6 passed; six separate Edge entry-point typechecks passed. Owner device/integration/concurrency QA remains pending; see `phase-6-e2e-closeout.md` for evidence and blockers. Current independent client typecheck/production build have not been rerun in this restricted harness.

## Metric
- A qualified view is recorded after at least 2.5 s of eligible playback, added up within one player session. Eligible means: playing, at least 50% visible, tab visible, and not buffering (`waiting`) or seeking. Pausing keeps the time already counted. The timer resets when the content or media changes.
- The card and the full-screen viewer are separate sessions, and their time is not combined (1.5 s + 1.5 s does not qualify). Both send the same `(source, source_id, canonical media identity)`, so the first one to qualify writes the view and the database uniqueness rules stop the second.
- Deduplication is lifetime, per viewer (signed-in user, or anonymous session), per stored media identity. A playback ID is the stored identity; it is not a promise of a permanent asset identity.
- Author self-views are excluded on the server for signed-in authors. **Limitation:** an author watching while signed out cannot be recognised, so that view is counted.
- No backfill: counting starts at rollout. There is no average watch time, because watch duration isn't stored.

## Attribution
- Root review → `source='review'`, `source_id=reviews.id`
- Timeline update → `source='review_update'`, `source_id=review_updates.id` (never credited to the root review)
- Home "review"-type Posts stay `source='post'`, with their tracking unchanged.

## Surfaces instrumented (existing only)
All of these go through `ReviewMediaBlock`:
- `ReviewCard`
- `TimelineReviewCard`
- `ReviewTimelineViewer`
- the `LightboxPreview` that opens from that block (`viewSource` / `viewSourceId` props; it tracks only when these are supplied)

No new viewer was created. Composer previews (`srcOverride`) never track.

## Database
- `media_views_source_check` now also allows `review_update`. Direct access stays service_role-only.
- `admin_review_video_view_stats(_source, _source_id)`:
  - SECURITY DEFINER, `search_path = pg_catalog, public`
  - checks admin internally with `has_role`
  - `_source` is required when `_source_id` is given
  - returns per source: `qualified_views` (distinct viewer–video pairs), `registered_viewers` (distinct users), `anonymous_sessions` (distinct anonymous sessions)
  - never returns viewer identities
  - EXECUTE is revoked from PUBLIC/anon. The linter's "signed-in can execute SECURITY DEFINER" warning is expected, because admins call it signed in.

## Edge Function `track-media-view`
- `post` and `entity` paths are unchanged.
- For `review` and `review_update`, the function:
  1. loads the row with the service role (updates also load the parent review)
  2. rejects missing rows
  3. applies the reviews read rule (public, or owner)
  4. excludes the author
  5. matches the persisted media by stable `mediaId` (falling back to the derived identity only when no id is sent)
  6. requires a ready video (photos, processing and failed videos are rejected)
  7. stores the canonical identity from the persisted record: `mux:<playback_id>`, or `storage:<bucket>/<path>`
- Rejections return 200 with a generic reason. Rate limiting is still the existing per-IP limit only.

## Results (2026-10-17)
- Edge Function Deno tests (`reviewMedia_test.ts`): 5 passed, 0 failed.
- Vitest full suite: 88 files; 1,143 passed, 3 skipped, 0 failed. This includes the new `useVideoViewTracker.phase5.test.tsx`: time adds up across pauses, buffering/seeking excluded, under 50% visible excluded, reset on media change, `review_update` source, Post behaviour unchanged.
- TypeScript (`tsc -p tsconfig.app.json`): clean.
- Production build (`vite build`): succeeded.
- Live DB checks:
  - the constraint includes `review_update`
  - an unauthenticated call to the RPC is refused (permission denied)
  - the function's access list is limited to authenticated and service_role

## Not yet verified (needs focused QA, flag ON in test only)
- Real playback on review cards and in the viewer recording exactly one row.
- Author exclusion end to end.
- Concurrent duplicate submissions collapsing (relies on the existing unique indexes plus the 23505 handling).
- Full-screen viewer qualification on iPhone and Android.

## Deferred
- Admin UI for the summary function
- Watch-duration analytics
- Combining time across players
- Creator self-view analytics
- Private Mux playback
- Mux asset cleanup
- Backfill
