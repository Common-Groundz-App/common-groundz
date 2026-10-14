/**
 * One message set for video placeholder tiles and owner recovery notes,
 * shared by posts, reviews and timeline updates.
 */
export const VIDEO_TILE_COPY = {
  processing: 'Video processing',
  unavailable: 'Video unavailable',
} as const;

export const VIDEO_OWNER_COPY = {
  failedEditable: "Couldn't process this video. Edit to remove or replace it.",
  failedLockedReview:
    "Couldn't process this video. You can delete this review or add a timeline update.",
  failedLockedUpdate:
    "Couldn't process this video. You can delete this update or add a new timeline update.",
} as const;
