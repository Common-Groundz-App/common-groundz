# Shorten comment input placeholders

## Goal
Replace the two-line, scrollable comment input placeholder on mobile with a short, single-line alternative that matches the app’s tone and intent.

## Decision
- Post composer: **“Share your thoughts...”**
- Recommendation composer: **“Share your experience or ask a question...”**

Rationale:
- Both fit on one line on mobile.
- “Share your thoughts...” is warm and personal, matching the app’s “experience over broadcast” voice.
- The recommendation variant still preserves the two original intents (sharing experience + asking questions), just in a tighter form.
- The dialog composer already uses “Add a comment...”, so we intentionally differentiate the inline composer with a slightly more inviting prompt; if consistency with the dialog is preferred, we can switch both to “Add a comment...” later.

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
