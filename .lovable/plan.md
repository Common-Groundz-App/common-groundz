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

### Wave B — The questions that were never added
1. "Could be better" chip list for every type, shown as its own group. It uses the same "unknown data is kept" rule as the other answers.
2. Experience level for each type, with the right wording (used for / visited / watched), all optional.
3. Rate the details: up to 4 optional star rows per type. For example:
   - Food: Taste / Portion / Value
   - Place: Service / Ambience / Value / Cleanliness
   - Product: Quality / Value / Ease of use
   - Movie/TV: Story / Performances / Visuals
4. Spoiler toggle for movies, TV shows and books. When it's on, the review text stays hidden on cards until you tap it.
5. All new answers are optional. Rating and subject stay the only required fields.

### Wave C — One review per entity + trust
1. If you already reviewed something, "Review" opens "Update your review" (your timeline) instead of a new form.
2. Existing duplicate reviews are kept as they are, and a list is made for you to see them first. No database lock is added until you approve it.
3. Check the Helpful button and make it count properly (no "not helpful").
4. Entity page review order: your Circle first, then most helpful, then newest.

### Wave D — Entity page summary (where Common Groundz stands out)
It only shows once an entity has at least 3 reviews:
- 4.4 stars · 91% recommend · 78% would choose again
- **What people love** (top "stood out" tags with %) and **Common complaints** (top "could be better" tags with %)
- **Recommended for** (top "best for" tags) and the average for each detail rating
- **From your circle:** people you follow and how they rated it

The numbers are worked out on the server side and stay fresh after each review.

### Later (not in this plan)
Questions for specific categories (headphones, skincare…), matching you with people who have similar taste, AI review summaries, and reviews appearing as feed posts.

## Technical notes
- Everything new is stored in the existing review answers format and keeps a version number. No new database columns are needed for Waves A–B.
- Headline: stop showing the question. The `subtitle` column stays in the database, so old reviews keep theirs.
- Wave C's one-per-person rule is checked when you open the form. A database uniqueness rule would come only after the duplicates are cleaned up, with separate approval.
- Wave D: a server-side summary per entity that reads the saved answers from reviews that aren't deleted.
- The tests, type check and build are run for every wave, and each wave stops for your check before the next one starts.
