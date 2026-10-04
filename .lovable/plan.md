# Step 3 — One review form for first reviews and timeline updates

## Short answers

**Modes, or something better?** Use modes, but keep them in one central list, not spread through the form. Make one shared form. Each of the four situations (new review, edit review, new timeline update, edit timeline update) gets one short settings entry. That entry says which sections show, which are required, and what the button says. The sections themselves (rating, "Would you still recommend it?", what stood out, best for, photos, comment, date, visibility) are built once. When a section is added to the shared list, it appears everywhere that entry allows it. You change the form in one place.

What to avoid: one big form full of "if timeline, hide this" checks. It is easy to build and gets harder to change every month. Sections chosen by the mode's settings give the same result without that mess.

**Page or popup?** Use a page, the same as the post form. Reasons:
- The form is getting longer (questions, photos, video). Long popups jump on phones when the keyboard opens. You already fixed that for posts by moving to a page.
- A page has its own address. Leaving and returning, refreshing, and the back button all work. The "update your review" links you already have can go straight to it.
- One page handles all four modes, so there is only one place to change.

**What other review sites do:**
- Yelp, Amazon, Tripadvisor and Booking.com use a full page for writing a review, because their forms are long and include photos.
- Google Maps uses a full-screen sheet on phones (which works like a page) and a dialog on desktop, because its form is short.
- Letterboxd and app-store ratings use small popups, because they are a star rating plus one text box.

Our form is closer to Yelp/Tripadvisor, so a page fits. The timeline viewer stays a popup for reading. Its "Add timeline update" button opens the page instead of growing the popup.

## What changes for the user

- "Write a review", "Edit" (within the hour), "Add timeline update" and timeline-update "Edit" all open the same review page, with the subject shown locked at the top.
- New review: the same steps as today.
- Timeline update: no subject picking, and rating is optional. "What changed?" is required. It has the same recommendation, photos and (later) questions as a review.
- When saving or cancelling, you go back where you came from (the entity page, your profile, or the reopened timeline).
- The popup review form and the form inside the timeline popup are removed once the page works.

## Moving timeline-only features into the review form first

The timeline form has things the review form lacks. These move into the shared sections before anything is removed:
- "Would you still recommend it?" Yes / Maybe / No, with "tap again to clear"
- "Base recommendation on rating" reset
- The current photo/video uploader layout and limits text

Order: (1) build the shared sections, (2) use them in the current review form and check it, (3) switch the timeline update over, (4) move both to the page, (5) delete the old copies.

## Unchanged

One review per person per subject, the one-hour Edit rule, latest-only timeline editing, Delete behavior, what is saved, the post form, and the paused phases.

## Technical details

- `reviewFormModes.ts`: `{ initial, editInitial, timeline, editTimeline }` → `{ sections[], required[], subjectLocked, ratingOptional, submitLabel, onSubmit target }`. This is a typed config, not booleans spread through components.
- `ReviewSections/*`: rating, recommendationIntent (from ReviewTimelineViewer), questionnaire (existing registry/QuestionnaireSections), media, comment, date, visibility. Each is controlled and uses one state hook (`useReviewFormState`).
- Save adapters: `createReview`/`updateReview` and `addReviewUpdate`/`editLatestReviewUpdate` stay as they are. Each mode maps the form state to its call. Existing DB triggers/RPCs are untouched.
- Routes: `/review/new?entity=<slug>`, `/review/:id/edit`, `/review/:id/update`, `/review/:id/update/edit`. These are noindex and auth-gated (`requireAuth()` first). `?compose=update` on the entity page redirects to the update route. Return navigation uses one-time location state, following the existing pattern.
- Timeline update entries get questionnaire answers only when the update storage supports them. Until then those sections stay hidden in the timeline modes (config only, no schema change in this step).
- Tests: a mode matrix (sections and required fields per mode), recommendation-intent parity with the current timeline tests, and save mapping per mode. Existing ReviewTimelineViewer/ReviewForm tests move to the new sections.
- Delivered as 3A (shared sections in the current popup), 3B (timeline uses them), 3C (page and routes, remove old forms). Each part ships and is checked separately.
