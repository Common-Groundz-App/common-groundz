# Review Experience & Structured Insights — locked contract

Locked 2026-10-01. Source plan: `.lovable/plan/phase-0-lock-the-decisions-and-run-the-checks-2026-10-01.md`.
Phases: 0 decisions + audits → 1 core form → 2 15-type matrix → 3 answers on reviews → 4 layout decision → 5 entity summaries. Later: feed projection, category overrides, structured search/filters, similar-taste ranking, AI summaries, custom-tag classification.

Principle: sharing an opinion first; structured data is secondary.

## Decisions
1. One active review per user per entity. Duplicates audited, never auto-merged/deleted; DB uniqueness only after approved remediation. Existing review → "Update your review"; new experiences go to the timeline.
2. Rating vs review: one shared classifier. Review = non-blank text, author-uploaded media, any known answer from the questionnaire registry (Food Tags, would_recommend, repeat_intent, stood_out/observations, best_for, value, worth_time, portion, trust, solves_problem, experience context, detail ratings — derived from the registry, not hand-listed), or a timeline update with any of these. Not counted: date alone, entity image, defaults, cleared answers, unknown-version data.
3. % recommend = Yes ÷ (Yes+Maybe+No), explicit current answers only. Latest timeline answer wins; latest `auto` = unanswered and does not revive older answers. Never inferred from stars.
4. Choose again: same formula, type-specific wording, never inferred.
5. Answers are the author's current view; star updates don't change other answers; one contribution per person per metric.
6. Observations v2: liked / could_be_better / worth_knowing / other (unsorted custom). Custom sentiment never guessed. v1 upgraded only when observations are deliberately edited.
7. Custom tags shown on the review, never aggregated.
8. Food keeps Food Tags and gains observations.
9. One shared full-review presentation opened from all short cards.
10. Short cards show only supplied answers; no fabricated balance.
11. Circle first, then everyone; chosen sort applies within each group; grouping labelled.
12. Helpful: review likes reset — executed only in Phase 3 after re-approval with counts. Post likes unchanged. Rating-only entries have no Helpful. Self-votes don't rank. Deterministic ties.
13. Spoilers hide text, custom tags/notes, `can_spoil` curated tags, media, timeline text/media, derived excerpts. Visible: stars, recommend, subject, type, dates, author.
14. Public summary = public reviews only. Circle summary = public + circle-only reviews from the viewer's Circle, never private (including own); separate denominators.
15. Per-metric minimum of distinct people (start 3, configurable; final in Phase 5). Unanswered never shown as 0%/No.
16. Phase 2 matrix covers per type × field: codes, wording/options, sentiment group, card/full display, aggregation + denominator + minimum, spoiler, intentional omission reason.

## Edit, timeline update, Delete (Step 2)

- **Review**: one person + one subject = one review (the thread root).
- **Timeline update**: a later entry on that review; history is kept.
- **Edit**: fixing a review or the latest timeline update within one hour of when it was first posted. Editing never restarts the hour. Everything except the subject can change. After the hour, add a timeline update instead. Visibility can change at any time.
- **Delete (review)**: removes the whole thread in one server step (`delete_review_thread`); the owner's own unused uploads are cleaned afterwards (retryable, never blocks).
- **Delete (timeline update)**: removes only the latest update (the former Undo).
- Database enforces: author and subject never change; automatic fields only change through the app's own system code; status changes are for moderators/admins only.
