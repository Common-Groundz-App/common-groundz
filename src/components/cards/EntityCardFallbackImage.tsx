import React from 'react';
import { cn } from '@/lib/utils';
import { useEntityImageFallback } from '@/hooks/useEntityImageFallback';
import { getEntityFallbackIcon } from '@/utils/entityImageFallback';
import type { MediaItem } from '@/types/media';

/**
 * Group 3B — the large subject-image area on the profile review and
 * recommendation cards.
 *
 * Before this module, both cards merged three different source classes into one
 * `mediaItems` array: author-uploaded media, a legacy single `image_url`, and
 * the subject (entity) image. Because the entity image entered that array, a
 * broken entity URL stayed inside `PostMediaDisplay` and could never reach a
 * fallback, while a missing entity image fell through to a remote stock photo.
 *
 * The two source classes are now separate:
 *  - author media (array + legacy `image_url`) keeps rendering through
 *    `PostMediaDisplay`, byte-for-byte as before;
 *  - the subject image renders through `EntityCardFallbackImage`, where valid,
 *    missing, broken and registered legacy placeholder sources all converge on
 *    the canonical local type icon inside the untouched `h-48` frame.
 *
 * Presentation is frozen: the wrapper classes are the ones the cards already
 * used, real images keep `w-full h-full object-cover`, and only the
 * missing-image content changes.
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

interface EntityCardFallbackImageProps {
  entity?: { id?: string | null; image_url?: string | null; photo_reference?: string | null } | null;
  type: unknown;
  imageAlt: string;
  fallbackLabel: string;
  className?: string;
}

export const EntityCardFallbackImage: React.FC<EntityCardFallbackImageProps> = ({
  entity,
  type,
  imageAlt,
  fallbackLabel,
  className,
}) => {
  const { imageUrl, showFallback, markImageFailed } = useEntityImageFallback(
    entity && entity.id ? (entity as { id: string }) : null,
  );
  const FallbackIcon = getEntityFallbackIcon(type);

  return (
    <div
      className={cn(
        'rounded-md overflow-hidden relative bg-gray-50 mt-2 mb-3 h-48 flex items-center justify-center',
        className,
      )}
      data-testid="entity-card-large-image"
    >
      {showFallback ? (
        <span
          role="img"
          aria-label={fallbackLabel}
          className="flex h-full w-full items-center justify-center text-muted-foreground"
          data-testid="entity-card-large-fallback"
        >
          <FallbackIcon className="h-12 w-12" aria-hidden="true" />
        </span>
      ) : (
        <img
          src={imageUrl ?? undefined}
          alt={imageAlt}
          className="w-full h-full object-cover"
          onError={markImageFailed}
          data-testid="entity-card-large-photo"
        />
      )}
    </div>
  );
};
