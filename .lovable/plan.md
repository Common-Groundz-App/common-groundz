# Phase 4 — Block 1 preflight results (read-only)

Nothing was changed. No uploads, no setting changes.

## Settings
| Setting | Value | Expected | Result |
|---|---|---|---|
| Review videos (`reviews.video_enabled`) | OFF | OFF | pass |
| Mux uploads (`mux.uploads_enabled`) | ON | ON | pass |
| Mux mode | live | live | pass (real uploads will create real, retained assets) |
| New review page (`reviews.composer_page_enabled`) | ON | ON | pass |
| Photo cleanup processing (`media_cleanup.processing_enabled`) | ON | noted | recorded |

## Photo-cleanup schedule (read only)
- `process-media-deletions-hourly` — every hour at :40, active.
- `cleanup-orphan-media-weekly-dryrun` — Sundays 03:00, active, dry run.
- Effect on testing: removed review photos may be processed at :40 each hour; Block 8 checks the queue rows, not the files.

## Test subject
- Entity CHANEL (`027b88ee-18b9-44d5-8c60-46626d707df4`): 0 reviews, 0 timeline updates. pass.

## Accounts
| Role | Account | ID |
|---|---|---|
| Author | Hana Li (@hana.li) | abfcbf43-b985-40dc-933c-201e5448b794 |
| Connected (follows Hana) | Linda Williams (@linda_williamss) — proposed | ff397c4b-dcb1-4154-8dd5-d3ec573502d3 |
| Outsider | John Carter | 06261a67-ebd7-43db-afe2-c3218e118473 (0 reviews) |
| Signed out | private window | — |

Other accounts following Hana: Anitha, Harry Potter, Hermione Granger, Rishabh — any can replace Linda.

## Finding to decide before Block 7
- John Carter is **not a pure outsider**: Hana follows John, and John and Linda follow each other. John does not follow Hana.
- Under today's actual rule (public or author only) this changes nothing — follows grant no review access. But if you want a truly unconnected outsider, we need another account with no follows to/from Hana. Options: keep John (recorded as "followed by Hana, does not follow her"), or you name another account.

## Next (needs your approval)
- Confirm the connected account (Linda or another) and the outsider choice.
- Then Block 2: you switch Review videos ON, I give the composer checklist, and run the before/after database checks.

## Technical details
- Queries run: `app_config` flags; `cron.job` filtered on media; `reviews`/`review_updates` counts for the entity; `profiles` lookup by name/ID; `follows` touching Hana and John.
