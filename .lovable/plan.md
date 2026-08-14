# Shorten comment input placeholders

## Goal
Replace the two-line, scrollable comment input placeholder on mobile with a short, single-line alternative that matches the app’s tone and intent.

## Decision
- Use **“Share your take...”** for both the post and recommendation inline comment composer.

Rationale:
- Fits on one line on mobile and eliminates the scrollable two-line placeholder shown in the screenshot.
- Neutral and conversational — it reads as *“What’s your perspective on this?”* rather than a directive.
- Matches the Common Groundz voice: opinion-forward, community-driven, and experience-centered.
- One single placeholder across both post and recommendation detail pages keeps the interface predictable and clean.

## Changes
1. **`src/components/comments/InlineCommentThread.tsx`**
   - Update the `mainPlaceholder` conditional:
     - `itemType === 'post'`: `'Share your thoughts...'`
     - else: `'Share your experience or ask a question...'`
   - No other UI or logic changes.

## Out of scope
- No changes to the `CommentDialog` placeholder (“Add a comment...”), bottom nav, composer docking, or keyboard behavior.
- No backend changes.

## Verification
- Open a post detail page on mobile preview and confirm the inline composer placeholder stays on one line and is not scrollable.
- Open a recommendation detail page and confirm the recommendation variant also stays on one line.
