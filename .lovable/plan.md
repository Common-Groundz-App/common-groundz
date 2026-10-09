# One supervised cleanup run (6 queued photos), then switch cleanup off again

Your last edit test worked as intended. Choosing 6 photos uploaded only 4. The 2 photos you removed in the edit are queued for cleanup. The current review keeps 2 photos. The 4 photos from the review you deleted earlier are also queued.

## Before the run (read-only checks)
- Exactly 6 photos are queued: 2 from the edit and 4 from the deleted review. Nothing else is in progress, failed or stuck.
- The 2 photos on the current Afnan review are not queued, and both open normally.
- Cleanup processing is OFF and no automatic schedule exists.
- Note how many photos are stored overall, so we can show that nothing unrelated disappeared.

## The run
1. Turn cleanup processing ON (one setting).
2. Run the cleanup worker once, by hand. No schedule is created.
3. Turn processing OFF straight away, even if the run fails.

## After the run
- All 6 entries end as "deleted", with none failed, stuck or unexpectedly kept.
- The 6 files are gone from storage and their links no longer open.
- The 2 photos on the current review are still in storage and still open. You check that the review page looks right.
- The overall photo count dropped by exactly 6.
- Processing is OFF again, with no schedule.

I report the before and after results, then stop.

## Still off / not started
Automatic schedule, weekly sweep deletion (it stays report-only), the review page rollout, and 3D.

## Technical details
- The setting is the app_config key `media_cleanup.processing_enabled`. It is switched with an audited data change, set back to false in the same turn.
- The worker is triggered by calling `process-media-deletions` with the `x-cron-secret` header. If `CLEANUP_CRON_SECRET` isn't set, I add it first. If the worker can't be called, processing goes back to OFF and I report what blocked it.
- Before and after, I count `storage.objects` in `post_media` and read `media_deletion_candidates` statuses and attempt errors.
