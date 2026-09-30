# Review form: the full plan

This covers both earlier discussions: the 8-phase roadmap and the original "how should the review form work" brief. I checked everything against the code today. Nothing has been changed yet.

## What's already done

- **One list of 15 types.** Old names map onto them, and no unknown type ever becomes "product".
- **Reviews use the real type.** The 5-bucket system is gone from the form. Old reviews still open and edit correctly.
- **Each of the 15 types has its own question set,** with no default fallback.
- **One search to pick what you're reviewing,** plus quick-create. The 5-tile picker is gone.
- **Required fields:** overall rating (stars) and the subject.
- **"Would you recommend it?"** (Yes / Maybe / No), kept separate from the stars. It feeds the recommending count and the review timeline.
- **"Would you choose it again?"** with wording per type ("Rewatch?", "Buy again?", "Order again?", "Go back?").
- **"What stood out?" and "Best for" tag chips** for each type. Food keeps its Food Tags.
- **Photos/videos, experience date and visibility** (Everyone / Circle / Private).
- **Update your review later:** a timeline of rating changes, add-only, where you can only undo your newest update.
- **Saving is safe:** answers are stored in a versioned format, and data the form doesn't recognise is never lost.

## What's missing from the original brief

| Idea | Current state |
|---|---|
| Remove the review headline | A "Headline" box is still on the last step. |
| Stars that mean something (1 Avoid … 5 Highly recommend) | The stars have no words under them. |
| "Tell your circle about your experience" with a hint per type | The box is generic: "Tell us what you liked or didn't like…" |
| "What could be better?" as its own chip group | Some tags are marked negative, but they're mixed in with the positive ones. There's no separate "could be better" question. |
| Experience level ("How long have you used it?" / "How often have you visited?") | Missing |
| Rate the details (for example Food / Service / Ambience) | Missing |
| Spoiler toggle for movies, TV shows and books | Missing |
| Short form first, "Add more details" folded underneath | Everything is spread across 4 numbered steps |
| Skip the subject step when you open the form from an entity page | Step 2 still shows, just locked |
| One review per person per entity ("Update your review" instead of a second one) | Nothing stops you writing a second review |
| Entity page summary: % recommend, % choose again, what people love, common complaints, recommended for | Missing |
| Circle-first review order on the entity page | **Already done.** Reviews from your Circle and reviews with a timeline come first. |
| Answers shown after posting | Saved, but review cards don't show choose-again, stood out, best for, value, etc. People get nothing back for answering. |
| "Best for" on every type | Only course, place and experience have it |
| Star wording | Labels exist, but the feedback reads like the business talking ("Awesome! We're glad…") and blurs into "would you recommend" |
| "Helpful" count, with no "not helpful" | Reviews have a heart/like, not a Helpful signal |
| Reviews showing up in the feed | The review form doesn't create a feed item |
| Measuring which questions people answer or skip | Missing |
| Questions for specific categories (headphones, skincare…) | Later |

**Main point (agreed with Codex):** the next step is to make what we already built useful and visible — not to rewrite it again, and not to add a pile of new questions.

## What to build, in waves (each wave needs its own go-ahead)

### Wave A — The new form (biggest difference users will notice)
1. Replace the numbered steps with named ones. From an entity page: Review → Details. From anywhere else: Subject → Review → Details.
2. The main screen shows:
   - the item you're reviewing (picture, name, type)
   - stars with words under them
   - "Would you recommend it?"
   - "Tell your circle…" box with a hint per type
   - photos
   - Post button
3. A folded "Add more details" section holds:
   - What stood out
   - Could be better
   - Would you choose again
   - Best for
   - Experience level
   - Date
   - Who can see this
4. **Remove the headline question.** Old headlines stay saved and keep showing on old reviews. New reviews save no headline.
5. A rating on its own is enough to post. A gentle hint appears: "Add a few words to help your circle."
6. **Split "What stood out" into "What you liked" and "What could be better",** using the positive/negative labels the tags already have. Old answers show up in the right group, and nothing is lost.
7. A review-box hint for each type (for example "What did you order? Anything people should know?").
8. Star wording that describes your experience ("Avoid … Highly recommend") and doesn't sound like the business, kept clearly separate from the recommend question.

### Wave B — Show the answers (people get something back for answering)
1. Review cards show a short line of chips: Recommends / Would buy again · Liked: … · Could be better: … · Best for: …. Old reviews with no answers look exactly as they do now.
2. Entity page summary (only shows once there are at least 3 reviews): recommend %, choose-again %, **What people love**, **Common complaints**, **Recommended for**, plus what your Circle thinks. Worked out on the server side and fresh after each review.

### Wave C — The missing questions (optional, kept short)
1. "Best for" for the other types that don't have it yet.
2. Experience level (used for / visited / watched) for each type.
3. Up to 3–4 optional detail ratings per type (for example Food: Taste / Portion / Value; Movie/TV: Story / Performances / Visuals). Their averages then join the entity summary.
4. Spoiler toggle for movies, TV shows, books and games. Spoiler text stays hidden on cards until tapped.

### Wave D — Trust and social
1. One review per person per entity: if you already reviewed it, "Review" opens "Update your review". Existing duplicates are listed for you first, and no database lock is added without your approval.
2. Rename the like on reviews to "Helpful" and show "18 people found this helpful". Helpful becomes the second sort after Circle.
3. Posting a review can also show it in the feed as "X reviewed Y" (one feed item linked to the review, never a copy).
4. Track which questions people open, answer or skip, so we know which ones earn their place.

### Later (not in this plan)
Questions for specific categories (headphones, skincare…), "people with similar taste" ranking, "recommended by runners you follow" explanations, and AI review summaries.

## Technical notes
- Everything new goes into the existing `metadata.questionnaire` answers, as a new registry field kind (`detail_ratings`), bumping the version where needed. No new columns and no separate hardcoded forms.
- Liked / could-be-better are views over the existing tag sentiment. The stored `stood_out` stays readable.
- Headline: stop asking for it. `reviews.subtitle` stays, and cards still show old headlines.
- Entity summary: one server-side function per entity over reviews that aren't deleted, and it respects visibility.
- One-per-person: checked when you open the form. A database uniqueness rule comes only after the duplicates are cleaned up, with separate approval.
- The tests, type check and build are run for every wave, and each wave stops for your check before the next one starts.
