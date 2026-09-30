# Review form: where we are against the original 8-phase roadmap

Checked in the code today. Nothing has been changed yet.

## Status by phase

| # | Phase | Status | What the code shows |
|---|---|---|---|
| 1 | One list of entity types | **Done** | One module holds the 15 types, with a separate list of old names mapped onto them. Unknown types return "none" and are never turned into product/place. Service, event, professional and TV show all keep their own type. Tests cover this. |
| 2 | Reviews use the entity's real type | **Done** | The old 5-bucket helper is gone from the app. `reviews.category` stores the real type, and a tested rule decides what gets saved. Old unlinked reviews still work. |
| 3 | Question set for each type | **Done (went further)** | Each of the 15 types has its own entry, with no default fallback. A subject with a broken type blocks the form and never saves an empty review. |
| 4 | Named steps instead of numbered ones | **Not started** | The form still uses steps 1–4 by number. When you open it from an entity page, step 2 ("What are you reviewing?") still shows, just locked. The step you don't need hasn't been removed. |
| 5 | Search first when reviewing from anywhere | **Mostly done** | Step 2 is now one search across all types, plus quick-create. The 5-tile picker is gone. Search still comes after the rating instead of first, and that waits on Phase 4. There are no type filter chips (optional). |
| 6a | First wave of answers | **Mostly done** | Would recommend, would choose again (worded per type, e.g. "Rewatch?", "Buy again?"), written review, media, date and visibility are all built. **Missing: experience context** (for example "how long / how often did you use it"). |
| 6b | Second wave of answers | **Partial** | "What stood out" and "Best for" exist as curated tags, plus a few type-specific questions (value, portion, worth the time). **Missing: negatives/complaints.** |
| 7 | Questions for specific categories (restaurants, headphones…) | **Not started** | Questions only depend on the 15 types. Nothing uses the product category. |
| 8 | Summaries on entity pages ("88% recommend", "People love…") | **Not started** | "Would you recommend" feeds the recommending count and the review timeline. No entity page shows recommend %, choose-again %, top tags or complaints. |
| 9 | Recommendations using these answers | **Not started** | The recommending feature reads the recommend answer only. It doesn't use choose-again, best-for or stood-out. |
| — | Keep reviews and recommendations separate | **Followed** | The recommend answer sits inside the review. Nothing was merged. |

## Proposed order for what's left (each step needs its own go-ahead)

1. **Phase 4:** Named steps. Opening from an entity page skips the subject step, so it becomes Rating → Details → Final (3 steps). Opening from anywhere else starts with Subject. Saved data and how the form looks stay the same.
2. **Phase 6 gaps:** Add an optional "experience context" question and an optional "what didn't work" tag set, stored in the same way answers are stored today.
3. **Phase 8:** Entity page summary: recommend %, choose-again %, top "stood out" tags, top "best for" tags. Only shows once there are at least 3 reviews.
4. **Phase 7 and 9:** Later, once there's real usage data.

## Technical notes
- Step machine: replace `currentStep: number` in `ReviewForm.tsx` / `StepIndicator` / `StepNavigation` with computed step ids (`subject|rating|experience|review`). Validation moves with its step, and there's no change to how things are saved.
- The Phase 8 numbers come from the `metadata.questionnaire.answers` saved on non-deleted reviews. This happens on the database side, so reviews are never downloaded one by one in the browser.
