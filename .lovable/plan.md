# Phase 1 — Core review form

Phase 1 runs in two parts. Part A is the safety gate the contract requires. Part B, the visible form work, only starts after Part A is verified. The approved scope stays as it is: no new questions, no data migration, and legacy reviews saved under the wrong type keep how they behave today.

## Part A — One review per person per entity (gate)

Today the database allows the same person to review the same thing twice. The only rules on reviews are the primary key, the two links, and a status check.

1. **Database rule:** a partial unique index on (user_id, entity_id) where entity_id is not null and status is not 'deleted'. Old reviews with no linked subject are not affected. Before adding it, re-run the duplicate check. If any pair exists, stop and show it to you instead of adding the rule.
2. **Routing:** every "Write a review" entry point first checks whether you already reviewed that subject. If you did, the button says "Update your review" and opens your existing review's timeline update. It never opens a blank form.
3. **Form guard:** when you pick a subject in the form that you already reviewed, it explains this and offers "Update your review" instead of submitting.
4. **Friendly error:** if the database rule ever blocks a save (for example from a double-tap), you see the same message rather than a raw error.

## Part B — Visible form changes

5. **No headline authoring:** remove the "Review headline (optional)" box from the last step. Existing headlines stay saved and editing a review never wipes them. Showing them on cards is Phase 3.
6. **Recommend promoted:** "Would you recommend it?" (Yes / Maybe / No, optional) moves next to the stars. It stays a separate answer, never set from the stars.
7. **Star wording:** labels describe quality only (for example 1 Poor through 5 Excellent). No wording suggests recommending.
8. **Type-aware hints:** the main text box shows a short, type-specific prompt (for example book: "What stayed with you?"). Unknown types use one neutral prompt.
9. **Observations v2:** the current "what stood out" picker splits into Liked / Could be better / Worth knowing, plus your own custom tags (kept unsorted). Old v1 answers display as they are and only upgrade when you deliberately edit them. Food keeps Food Tags and also gets observations.
10. **Details fold:** the existing extra questions (repeat intent, best for, value, worth the time, portion, trust, and so on) move into an optional collapsed "Add more detail" section. No questions are added.
11. **Rating-only allowed:** stars alone can be published. The shared classifier from the contract decides what counts as a "review" and what is rating-only.

## Out of scope for Phase 1
Showing answers on cards, the full-review view, spoilers, Helpful, the 15-type matrix, layout changes and entity summaries.

## Verification
- Duplicate check reads zero before and after the index. Attempting a second insert is rejected.
- Focused tests for routing, the form guard, the classifier, observations v1/v2 round-trip, and headline preservation. Then the full test suite, a type check, and the build log.
- Screenshots of the form on desktop and mobile for your visual approval. Signed-in flows can't be checked automatically on this project, so you will need to try them yourself, and I will say exactly which.
- Update roadmap.md and docs/verification/review-phase-1.md.

## Technical details
- Index: `create unique index reviews_one_active_per_user_entity on public.reviews(user_id, entity_id) where entity_id is not null and status <> 'deleted';`
- Existing-review lookup: one small query on reviews by (user_id, entity_id), reused by every entry point and by the form.
- Headline: stop writing `subtitle` on create, and send the existing value back unchanged on edit.
- Observations: a new registry version for `stood_out` with sentiment groups. The resolver reads both v1 and v2. Saving writes v2 only when that section was touched (saveMetadata already supports touch-only writes).
- Classifier: one pure function next to the registry, built from registry answer keys rather than a hand-written list.
- Files touched (main): ReviewForm.tsx, steps/StepFour.tsx, steps/StepOne.tsx, questionnaire/registry.ts, resolve.ts, QuestionnaireSections.tsx, plus the review entry-point buttons.
