# Before Launch

Everything that must be done (or consciously decided) before real users go live.

## 1. Secure private photos — REQUIRED before real users publish Private reviews with photos
- Today: a Private review hides its row, but its photo files live in a public bucket; anyone holding a direct URL can still open them.
- Private bucket with storage access rules; owner reads via authenticated download or short-lived signed URLs.
- Public ↔ Private transitions move files and update references safely (reviews, Timeline Updates, posts, thumbnails, lightbox, drafts).
- Revoke old public file URLs where possible. Copies already downloaded or cached by others cannot be recalled — disclose this.
- Verify unauthorized direct-URL access fails.

## 2. Private videos (Mux signed playback) — desirable, deferrable
- Today: reviews containing videos must stay Public (database lock `review_video_visibility_locked`). Users see: "Can't make this review private — Reviews containing videos must remain public for now. Your review and its history haven't been changed."
- Investigate: does our Mux plan support signed playback; can signed IDs be added to existing assets without reupload or disturbing cleanup.
- Owner-only token issuance (playback, thumbnail, storyboard), token renewal, and REMOVAL of the public playback ID — adding a signed ID alone does not make a video private.
- Signed URLs remain shareable while valid; short expiry limits but does not eliminate this.
- Preserve Mux asset IDs, lifecycle tracking, cleanup pipeline and review history. Not a guaranteed seamless upgrade.
- Account-switch privacy and failure recovery; pricing/performance impact.

## 3. Other launch items
- Phase 10.3: remove Circle Only from authoring; activate the strict visibility constraint.
- Privacy copy: what Private means, and its media limitations until items 1–2 ship.
- Owner signed-in QA across accounts (Rishabh / Hana / unrelated / guest).
- Pre-existing database linter warnings review.
