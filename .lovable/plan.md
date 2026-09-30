# Review Experience & Structured Insights — final plan

**Goal:** finish, tidy up and show off the review system we already built. We are not rebuilding it or piling on questions. Every important answer should go all the way through: set up → asked → saved → editable → shown on the review → added up on the entity page.

## Already built (kept)
- The 15 types, the subject search and quick-create
- One question list covering every type
- Would you recommend? (kept separate from the stars)
- Would you choose it again? (worded per type)
- "What stood out" tags. Food keeps its Food Tags.
- "Best for", but only on course, place and experience
- A few type-specific questions: value, worth the time, portion size
- Photos, date, visibility, and "Update your review" history
- Circle-first ordering on the entity page, likes and saves
- Saved answers carry a version number, and data the form doesn't recognise is never lost

## Order of work (each phase stops for your check)

### Phase 1 — Put everything the form needs on it (steps stay as they are for now)
1. **Remove the review headline** from new reviews. Old headlines are kept and still show.
2. **Make "Would you recommend it?" stand out:** move it right under the stars and make it look like a main question, not a small optional field.
3. **Split "What stood out" into "What did you like?" and "What could be better?"** This uses the positive/negative labels the tags already have. Old answers land in the right group, and nothing is lost.
4. **A review-box question and hint for each type** ("What should people know?", "What did you order?", "Keep it spoiler-free…").
5. **Clearer star wording** (Avoid → Highly recommend). It describes your experience, doesn't sound like the business talking, and doesn't repeat the recommend question.
6. **An "Add more details" fold** in the last step for: liked, could be better, choose again, best for, experience context and detail ratings. Date, visibility and spoilers stay outside it.
7. Everything new is optional. Rating and subject stay the only required fields. A rating on its own is still enough to post.

### Phase 2 — Make every type complete
A table for all 15 types covering: recommend, choose again, liked, could be better, best for, experience context, detail ratings, review hint, spoilers. For each type we either fill a box or leave it empty on purpose. You approve the table before I build it.

Examples of what it would fill:
- **"Best for"** for the types where it helps (food, product, movie, TV, book, app, game, event, service, professional…)
- **Experience context:** product/app "How long have you used it?", food/place "First time / A few times / Regular", course "How far did you get?", service/professional "How many times have you worked with them?"
- **Detail ratings (3–4, optional):**
  - Food: Food / Service / Ambience / Value
  - Movie/TV: Story / Performances / Visuals / Entertainment
  - App: Ease of use / Reliability / Features / Value
  - Service: Quality / Reliability / Communication / Value
  - Product gets none for now. It waits for its own categories (headphones, skincare…).
- **Spoiler toggle** for movies, TV shows, books and games

### Phase 3 — Show the answers on reviews
1. Review cards show, in this order: rating, recommend, text, then the 2–3 strongest answers (Liked / Could be better / Best for / Would choose again), then media. The full review shows everything.
2. Reviews marked as spoilers stay hidden until tapped.
3. On reviews, the like becomes **Helpful** ("23 people found this helpful"). Likes stay as they are on normal posts.
4. Track which questions people open, answer or skip, where they drop off, and how often reviews are posted or edited.

### Phase 4 — Decide steps vs one long form (your call)
Once everything is on the form, we look at it together at desktop and phone size. You choose: keep 4 steps, cut to 3 steps (the subject step is skipped when you start from an entity page), or one single form. I build whichever you pick.

### Phase 5 — Entity page summary
Only shows once there are at least 3 reviews:
- **% recommend** and **% would choose again**
- **People love** and **Common complaints**, each tag with a %
- **Best for**
- The average for each detail rating
- **From your Circle** reviews, still shown first

Worked out on the server side, respects who can see each review, and stays fresh after every review.

### Later (separate plans)
- Reviews appearing in the feed as "X reviewed Y", linked to the review rather than copied
- Questions for specific product categories
- Ranking by people with similar taste
- AI summaries and explanations

## Technical notes
- New field kinds `detail_rating` and `experience_context` in the questions list. Everything is saved under `metadata.questionnaire.answers` with fixed field names. The version number goes up only when the saved format changes. No new columns and no separate forms per type.
- Liked / could be better: two views over the existing tag sentiment. The stored `stood_out` stays readable, and new saves split it by sentiment.
- Headline: the question is removed from StepFour. `reviews.subtitle` is kept, and cards still show old headlines.
- Helpful: reuses `review_likes`, with only the label changed.
- Phase 5: one server-side summary per entity that respects visibility, built only after the Phase 2 vocabularies are fixed.
- Each phase: tests, type check and build, then stop for your check.
