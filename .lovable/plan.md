# Phase 0 — Lock the decisions and run the checks

The master plan (Phases 0–5 plus Later) is **locked**. This step changes nothing you can see in the app. It saves the decisions below in the project notes, runs four read-only checks, and brings the results back to you. Phase 1 does not start until you approve them.

## Decisions (final)
1. **One active review per person per entity.** Duplicates get checked first and are never merged or deleted automatically; you approve the fix. After that, "Review" opens "Update your review", and new experiences go on the timeline. A database rule is added only after the fix, and it also blocks two submissions that land at the same moment.
2. **Rating vs review, decided by one shared rule.** Each item below counts as something real you added:
   - text that isn't blank
   - a photo or video you uploaded
   - a structured answer the app understands (recommend, choose again, observations, best for, experience context, detail ratings)
   - a timeline update that has any of those

   These don't count: a date on its own, the entity's own picture, defaults, an answer you picked and then cleared, and saved data the app doesn't understand. An entry can become a review and turn back into a rating.
3. **% recommend = Yes ÷ (Yes + Maybe + No)**, using current real answers only. Missing answers are left out. Your latest timeline answer wins. A latest "auto" counts as not answered and never brings back an older answer. Stars are never used to guess it.
4. **Choose again:** same formula, worded for each type, and never guessed from other answers.
5. **Current answers:** changing your stars doesn't change your other answers. Each person counts once for each number.
6. **Observations v2:** Liked / Could be better / Worth knowing, plus "Other notes" for tags you typed yourself that haven't been sorted. Your own tags are never guessed. **An old answer is only upgraded when you actually edit your observations.** Saving something else leaves it exactly as it is.
7. **Tags you type yourself** show on your review but never go into entity summaries.
8. **Food** keeps Food Tags and also gets the three observation groups.
9. **One shared full-review view** (a pop-up or panel) that opens from every short card. The check below confirms which places use it and whether it needs its own link.
10. **Short cards** show only what the author gave. Both sides show when both were given. Nothing is ever added to balance it.
11. **Order:** your Circle first, then everyone else, with the chosen sort (Recent / Most helpful / Highest / Lowest) inside each group. The page labels the Circle group so the order makes sense.
12. **Helpful:** old review likes are **reset** when Helpful starts, because a like and a Helpful vote mean different things. Post likes don't change. Rating-only entries **get no Helpful button.** You can't make your own review rank higher. Ties are broken the same way every time.
13. **Spoilers hide:** the review text, your own tags and notes, curated tags marked "can spoil", photos and videos, timeline text and photos, and any excerpts taken from them. **Spoilers don't hide:** stars, recommend, subject, type, dates and the author. Feed, notifications, search and AI inherit this later.
14. **Summaries:** the public summary uses public reviews only. The Circle summary uses public and Circle-only reviews from your Circle and never private ones (not even your own), with separate counts.
15. **Minimums:** every number needs its own minimum count of different people (starting at 3, and adjustable). The exact numbers are set in Phase 5. An unanswered question never shows as 0% or as No.
16. **The Phase 2 table** covers, for every type and every question:
    - the saved codes
    - the wording and options
    - liked, could be better or worth knowing
    - short card and full review
    - whether it goes into the summary, what it's counted out of, and its minimum
    - spoilers
    - why a question was left out on purpose

## Checks this step runs (read-only)
1. **Duplicate reviews:** count users who have more than one active review of the same entity, and how creating vs updating a review works now. This includes what happens to deleted or archived reviews.
2. **Every place a review shows:** profile cards, entity page reviews, the timeline viewer, feed review posts, admin preview. For each: what it shows today and how you open it. Ends with a suggestion for the shared full-review view and whether it needs its own link.
3. **Existing answers:** how many reviews have v1 `stood_out` answers, how many have tags typed by the user, and how many have choices that sit over the current limit.
4. **Review likes:** the current count, kept as a record before the reset.

## What you get back
A short findings document in the project notes, plus any decisions that can't be avoided. The project roadmap gets the Phase 0–5 checklist. Nothing in the app or the data changes.

## Technical notes
- Database checks are read-only queries on `reviews`, `review_updates` and `review_likes`. The places reviews show are found by searching the code.
- The findings go in `docs/verification/review-phase-0.md`. The decisions above are recorded in `AGENTS.md` and `roadmap.md`.
