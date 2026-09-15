# Phase 4.3 — Gate 5: remove the old recommendation page and its leftover links

Gate 4 deleted the old records and their notifications. Gate 5 removes the now-dead
surface: the page nobody can reach, its viewer, the link-building code that could
still point at it, and the media cleanup jobs' lookup of the old image column.

No database schema changes here — tables, enums and columns stay until Phase 4.5.
Nothing is removed for having "recommendation" in its name: endorsements,
recommendation posts, the v4 entity page counts and the Circle card are untouched.

## What gets removed

1. **The old page and its route**
   - Delete `src/pages/RecommendationView.tsx` (the static tombstone) and
     `src/components/content/RecommendationContentViewer.tsx`.
   - Remove the `/recommendations/:recommendationId` route and its import from
     `src/App.tsx`.

2. **Link building that could still produce that route**
   - `src/utils/contentRoutes.ts`: `RoutableContentType` narrows to `'post'`;
     the `/recommendations` base and the `recommendation` branch of
     `isRoutableContentType` go away. Function names, signatures and return
     shapes stay identical.
   - `src/utils/notificationDestination.ts`: drop the legacy singular
     `/recommendation/` rewrite and `recommendations` from the path allowlist,
     so any surviving legacy `action_url` resolves to "no page to open"
     instead of a dead route.
   - `src/services/notificationService.ts`: remove the `recommendation` case
     from `getContentUrl` (falls through to `#`). The `EntityType` union keeps
     `'recommendation'` because the database column can still express it until
     Phase 4.5, and `notificationRealtime.ts` keeps accepting it so a row of
     that shape is still validated rather than treated as an unknown event.

3. **Thumbnails and grouping**
   - `notificationThumbnail.ts`: `THUMBNAIL_TARGET_TYPES` becomes `['post']`,
     and the `recommendation` bucket disappears from `collectTargetIds`.
     `useNotificationTargets.ts` loses its now-unreachable posts-only comment
     and keeps fetching posts exactly as today.
   - `notificationGrouping.ts`: grouping is post-only and the noun helper
     always reads "your post".

4. **Media cleanup jobs**
   - Remove the `recommendations.image_url` reference block from both
     `cleanup-orphan-media` and `cleanup-orphan-media-execute`, and the
     mentions of it in their header comments. These were the last live readers
     of the old table.

## Tests

Update the affected specs to assert the new behaviour rather than deleting
coverage: legacy-typed and legacy-URL notifications resolve to no destination,
grouping and thumbnails cover posts only. All other notification cases
(post like, comment, mention, reply, comment like, follow, profile, journey,
unsafe URL rejection) keep their existing assertions.

## Verification before finishing

- Repo-wide sweep (beyond `src/` and `supabase/functions/`) for any remaining
  reader of the old tables or the `/recommendations/:id` route.
- Preservation spot-check: Recs tab on a profile, the v4 entity page counts
  ("6 recommending (4 from circle)") and the Circle card render unchanged.
- Full test suite, type check, build; evidence written to
  `docs/verification/phase-4-3-gate-5-surface-removal.md` and the roadmap ticked.
- Stop after Gate 5; Gate 6 is the final preservation and zero-dependency pass.
