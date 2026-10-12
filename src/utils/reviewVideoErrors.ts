/** Recognises Phase 1 review-video refusals raised by the database. */

const REVIEW_VIDEO_MESSAGES: Record<string, string> = {
  review_video_public_only: 'Videos are available on public reviews only.',
  review_video_visibility_locked: 'This review has a video, so it must stay public.',
  review_media_too_many: 'You can add up to 4 photos or videos.',
  review_media_one_video: 'You can add only one video.',
  review_video_not_owned: "This video can't be used here. Remove it and add it again.",
  review_video_invalid: "This video can't be used here. Remove it and add it again.",
  review_video_in_use: 'This video is already used somewhere else. Remove it and add it again.',
  review_edit_window_closed: 'Edit window closed (1 hour limit).',
};

/** Friendly message for a Phase 1 review-video refusal, or null. */
export function reviewVideoErrorMessage(error: unknown): string | null {
  const msg = (error as { message?: unknown } | null)?.message;
  if (typeof msg !== 'string') return null;
  for (const code of Object.keys(REVIEW_VIDEO_MESSAGES)) {
    if (msg.includes(code)) return REVIEW_VIDEO_MESSAGES[code];
  }
  return null;
}
