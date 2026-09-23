import type { MediaItem } from '@/types/media';

/**
 * Group 3B — source classification for the profile review and recommendation
 * cards. Author-authored media (explicit array, then a legacy single
 * `image_url`) is kept strictly apart from the subject (entity) image, which is
 * rendered by `EntityCardFallbackImage` so that valid, missing, broken and
 * registered legacy placeholder sources converge on one local icon.
 */

export interface AuthorMediaSource {
  id: string;
  media?: unknown;
  image_url?: string | null;
}

/** Author-authored media only. The subject image is deliberately excluded. */
export const getAuthorMediaItems = (source: AuthorMediaSource): MediaItem[] => {
  if (Array.isArray(source.media) && source.media.length > 0) {
    return source.media as MediaItem[];
  }

  if (source.image_url) {
    return [{
      url: source.image_url,
      type: 'image' as const,
      order: 0,
      id: source.id,
    }] as MediaItem[];
  }

  return [];
};

/**
 * Preserves the existing visibility rule verbatim: on entity-detail surfaces
 * (`hideEntityFallbacks`) only an explicit user-media array may display, so a
 * legacy `image_url` stays suppressed there exactly as it is today.
 */
export const shouldShowAuthorMedia = ({
  hasMediaArray,
  authorMediaCount,
  hideEntityFallbacks,
}: {
  hasMediaArray: boolean;
  authorMediaCount: number;
  hideEntityFallbacks: boolean;
}): boolean => (hideEntityFallbacks ? hasMediaArray : authorMediaCount > 0);

/**
 * The large subject area renders only where the cards render it today: never in
 * compact mode, never when entity fallbacks are suppressed, and only when the
 * card carries no author media at all.
 */
export const shouldRenderEntityFallbackArea = ({
  authorMediaCount,
  hideEntityFallbacks,
  compact,
}: {
  authorMediaCount: number;
  hideEntityFallbacks: boolean;
  compact: boolean;
}): boolean => !compact && !hideEntityFallbacks && authorMediaCount === 0;
