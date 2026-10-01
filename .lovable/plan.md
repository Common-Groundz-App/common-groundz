# Review Experience & Structured Insights — final plan (revised)

**Goal:** finish, tidy up and show off the review system we already built. We are not rebuilding it. Every important answer should go all the way through: set up → asked → saved → editable → shown → added up → later used to help people find things.

**Guiding principle:** writing a review should feel like telling people you trust what you thought, not filling in a survey. The structured questions always come second to sharing your opinion.

## Rules that apply to every phase
1. **One active review per person per entity.** If you come back, you update your review. Your history is kept.
2. **A rating alone is valid,** but the app always knows the difference. *Rating* = stars only. *Review* = stars plus text, photos or at least one answer. Rating-only entries count toward the star average, but not toward tag summaries or Helpful ranking.
3. **Stars describe how good the experience was, never whether you'd recommend it.** So no "Avoid" or "Highly recommend" on the stars. Five stars with "Maybe" on recommend must make sense.
4. **Editing brings back every saved answer exactly,** including reviews saved with older question versions. Nothing resets or disappears.
5. **Saved values never change when wording changes.** Saved codes are fixed. Labels can change freely.
6. **Every phase must work by keyboard and with screen readers,** with focus handled properly and tap targets big enough on phones.
7. **The question list can later go type → category → subcategory** (Hotel under Place, Headphones under Product). We don't build that now.

## Phase 0 — Settle the rules first (decisions only, no visible change)
1. **One review per person:** find out whether duplicates exist today and how creating a review behaves now. Then decide: when you've already reviewed something, "Review" opens "Update your review". A database rule is added only after the duplicates are sorted, with your approval.
2. **List every place a review is shown** (profile, entity page, timeline, feed cards) and choose the one place that shows the **full review**. Every other place shows the short version.
3. **Rating-only vs full review:** agree what a rating-only card looks like and how each is counted.
4. **What "% recommend" means:** only people who actually answered Yes / Maybe / No count. The automatic guess from the stars is never used in this number. The existing "recommending" count keeps working as it does today.
5. **Neutral tags** ("Quiet", "Crowded", "Slow burn", "Technical"): my suggestion is a small third group, **"Worth knowing"**, instead of forcing them into liked or disliked.
6. **Food:** keep Food Tags (what it is: spicy, vegan…) and **also** add "What did you like?" / "What could be better?" for food (taste, portion, wait, price). They answer different questions.

You approve these before Phase 1 starts.

## Phase 1 — The core form (steps stay as they are)
1. Remove the headline from new reviews. Old headlines are kept and still show.
2. Move "Would you recommend it?" up right under the stars and make it look like a main question.
3. A review-box question and hint for each type ("What should people know?", "What did you order?").
4. Star words that describe the experience only, for example: Poor · Below expectations · Good · Very good · Exceptional. You pick the exact wording.
5. Split "What stood out" into **Liked / Could be better / Worth knowing**. Old answers land in the right group, and nothing is lost.
6. An "Add more details" fold, **using only questions that already exist** (choose again, best for, value, etc.). Phase 2 adds its new questions into this same fold.
7. Rating and subject stay the only required fields.

## Phase 2 — The full review table for all 15 types (you approve it first)
For each type, the table gives the exact wording and tag list, not just yes/no:
- review hint
- recommend
- choose-again wording (buy / visit / watch / keep using…)
- liked, could be better and worth-knowing tags
- best for
- experience context (question and answers)
- up to 3–4 optional detail ratings
- spoilers (movie / TV / book / game)

A box is left empty on purpose wherever a question doesn't fit. Product gets no detail ratings until its categories exist.

## Phase 3 — Make the answers useful on each review
1. **Short card,** fixed order every time: rating · recommend · experience context ("Used 6+ months", "Regular") · date or "Updated 2 months ago" · text · **one Liked line and one Could-be-better line** (never only the positives) · media. The full review shows everything.
2. A rating-only card looks tidy, with a hint for the author: "Add a few words".
3. **Spoilers:** when a review is marked as a spoiler, the text, your own tags and photos stay hidden until tapped. This also applies later to feed items, notifications, search snippets and AI summaries.
4. The like on reviews becomes **Helpful** ("23 people found this helpful"), and a **Most helpful** sort is added. The Circle still comes first.
5. Tracking: how many open the fold and fill in each question, where people drop off, plus post and edit rates.

## Phase 4 — Choose the form layout (your call)
We look at it on desktop and phone, together with the Phase 3 numbers (drop-off, time to finish, starting from an entity page vs elsewhere). Options: 4 steps, 3 steps (skip the subject step when you start from an entity page), or one single form.

## Phase 5 — Entity page summary
- **Each number has its own minimum.** For example, "% recommend" only shows once at least 3 people have answered that question. A question nobody answered never shows as 0%.
- Shown: % recommend (real answers only) · choose-again % **in the type's own words** ("74% would buy again") · People love · Common complaints · Worth knowing · Best for · detail-rating averages · your Circle's reviews first.
- Stars show as "4.4 from 38 ratings · 12 reviews".
- Worked out on the server side, respects who can see each review, and counts one review per person.

## Later (separate plans)
- Reviews in the feed as "X reviewed Y", linked to the review rather than copied
- Category and subcategory questions
- **Using these answers in search, filters and discovery** ("best for date night", "praised for reliability")
- Ranking by people with similar taste
- AI summaries

## Technical notes
- Everything is saved in `metadata.questionnaire.answers` with fixed field names. New field kinds: `detail_rating`, `experience_context`. The tags gain a `neutral` group. The version number goes up only when the saved format changes.
- "Rating vs review" is worked out from the saved data, with no new column.
- Explicit recommend % reads `answers.would_recommend` (and the latest timeline answer) and ignores the guess from the stars.
- Helpful reuses `review_likes`.
- Each phase: tests (including a save → edit → save round-trip for every type), type check, build, and a keyboard/screen-reader check, then stop for your review.
