# Review Experience & Structured Insights — master plan (lock candidate)

**Goal:** finish, tidy up and show off the review system we already built. We are not rebuilding it. Every important answer should go all the way through: set up → asked → saved → editable → shown → added up → later used to help people find things.

**Guiding principle:** writing a review should feel like telling people you trust what you thought, not filling in a survey. The structured questions always come second to sharing your opinion.

## Rules that apply to every phase
1. **One active review per person per entity.** If you come back, you update your review. Your history is kept.
2. **Rating vs review, decided by one shared rule used everywhere** (worked out in Phase 0). *Rating* = stars only. *Review* = stars plus at least one real addition: text, photos, or a known structured answer.
3. **Stars describe how good the experience was, never whether you'd recommend it.**
4. **Editing:** answers saved with a question version the app understands come back exactly and can be edited. Answers from older or newer versions it doesn't understand are kept exactly as they are, and editing anything else never damages them. They only become editable after a deliberate upgrade.
5. **Saved codes never change.** Wording can.
6. **Answers are the person's current view.** When you update your review, your answers update too. Each person counts once per number.
7. **Show what the author gave, never invent anything.** No made-up balance and no guessed feelings for tags you typed yourself.
8. **The date you used something and the date the review was updated are different facts.** Both can show, and neither ever stands in for the other.
9. **Every phase must work by keyboard and with screen readers,** with focus handled properly and tap targets big enough on phones.
10. The questions can later go type → category → subcategory. We don't build that now.

## Phase 0 — Decisions (no visible change; presented to you for approval)
**Counting**
1. **What counts as a review:** text, photos, or at least one known answer = review. Stars only = rating. A rating that later gets a timeline update with text becomes a review. Answers the app doesn't understand don't count by themselves.
2. **% recommend** = Yes ÷ (Yes + Maybe + No), counting only real answers. Maybe stays a separate number and is never half a Yes. If your latest timeline update set it back to "auto", you're counted as **not answered**, and an older Yes/No is not brought back. "Choose again" works the same way, in the type's own words ("74% would buy again").
3. **Detail ratings and other answers** use your current answer. If you update your stars on the timeline and leave the detail ratings alone, they stay as you last saved them, and the page shows when they were saved.

**Data shape**

4. **Liked / Could be better / Worth knowing** are saved as one answer with three groups, each holding chosen tags and your own tags. The version number goes up by one. Older answers: chosen tags land in their group by their existing mood label. Tags you typed yourself go to **"Other notes"**, are never guessed, and stay editable — you can move them into a group yourself.
5. **Your own tags** are allowed (the current limits stay). They show on your review but are **never added into entity summaries**. Only the curated tags count there.
6. **Food:** keeps Food Tags, and also gets Liked / Could be better / Worth knowing.

**Display**

7. **Which page shows the full review:** we list every place a review appears and pick one. Every other place shows the short version.
8. **Short card:** shows Liked and Could-be-better only if the author picked them. If they picked only positives, only positives show.
9. **Order:** your Circle always first, then the sort you chose (Recent / Most helpful / Highest / Lowest) applies inside the Circle group and to everyone else.
10. **Helpful:** decide whether past likes on reviews become Helpful votes, or the count starts again from zero. My suggestion is to keep them, with a note in the history, because the data is dummy right now. Rating-only entries can still get Helpful votes, but they rank below reviews.
11. **Spoilers** cover all text you write, your own tags, photos, and any curated tag marked "can spoil". General facts (stars, type, date) stay visible.

**Privacy**

12. **Entity summaries:** the public summary uses public reviews only. A separate **"Your Circle"** summary uses the reviews you're allowed to see and only shows once enough people are in it, so nobody's private opinion can be worked out from it.

## Phase 1 — The core form (steps stay as they are)
- Remove the headline from new reviews (old ones are kept and still show).
- Move "Would you recommend it?" up under the stars.
- A review-box hint for each type.
- Star words that describe the experience (you pick the exact wording).
- Liked / Could be better / Worth knowing, with the "Other notes" group for tags you typed yourself.
- An "Add more details" fold holding the questions that already exist.
- Rating and subject stay the only required fields.

## Phase 2 — Full review table for all 15 types (you approve it first)
For every type and every question, the table records the exact wording, the answer options and tags, and:
- whether it shows on the short card and/or the full review
- whether it counts toward the entity summary, and its minimum number of answers
- whether it can contain spoilers

Questions covered: review hint, recommend, choose again, liked / could be better / worth knowing, best for, experience context, up to 3–4 detail ratings, spoilers (movie / TV / book / game). A box is left empty on purpose where a question doesn't fit. Product gets no detail ratings until its categories exist.

## Phase 3 — Make answers useful on each review
- Short card: rating · recommend · experience context · "Used July 2026" and/or "Updated 2 months ago" (each labelled) · text · the tags the author picked · media.
- A tidy rating-only card.
- Spoilers hidden until tapped, following the Phase 0 rule.
- Helpful + Most helpful sort, following the Phase 0 ordering rule.
- Tracking of which questions people open, answer and skip, plus post and edit rates.

## Phase 4 — Choose the form layout (your call, based on how it looks and the Phase 3 numbers)
4 steps, 3 steps, or one single form.

## Phase 5 — Entity page summary
- Each number has its own minimum, and an unanswered question never shows as 0%.
- Shown: % recommend · choose-again % (in the type's own words) · People love · Common complaints · Worth knowing · Best for · detail-rating averages · "4.4 from 38 ratings · 12 reviews".
- Public summary and Your Circle summary are kept separate. Worked out on the server side, one entry per person.

## Later (separate plans)
- Reviews appearing in the feed
- Category and subcategory questions
- Using these answers in search, filters and discovery
- Ranking by people with similar taste
- AI summaries
- An automatic mood label for tags you type yourself

## Technical notes
- Saved in `metadata.questionnaire.answers`. Liked / could be better / worth knowing are stored as one field, `observations: { liked, could_be_better, worth_knowing, other: {selected, custom} }`, with version 2. Version 1 `stood_out` is read and moved over the first time you save it, and versions the app doesn't know are kept exactly as they are.
- New field kinds: `detail_rating`, `experience_context`. Curated tags gain an optional `spoiler` flag.
- One shared function decides rating vs review, used on the cards, in the counts and in the summary.
- Helpful reuses `review_likes`. Past likes are kept or reset depending on the Phase 0 decision.
- Each phase: tests (including save → edit → save for every type and every saved version), type check, build, and a keyboard/screen-reader check, then stop for your review.
