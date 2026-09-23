import React from 'react';
import { cn } from '@/lib/utils';
import { useEntityImageFallback } from '@/hooks/useEntityImageFallback';
import { getEntityFallbackIcon } from '@/utils/entityImageFallback';
import type { EntityImageSource } from '@/utils/entityImageUtils';

/**
 * Group 4 — the picture area inside explore grids and entity collection cards
 * (featured entities, category highlights, the sibling strip, the related-items
 * grid).
 *
 * Fallback-only migration: the caller keeps its own wrapper element, so every
 * existing height, aspect ratio, radius, crop, spacing and hover treatment is
 * preserved verbatim. This component only decides what fills that wrapper:
 *
 *  - a valid real image renders with the caller's own image classes;
 *  - a missing, broken or registered legacy-placeholder source renders the
 *    canonical local type icon, with an accessible missing-image label;
 *  - an unrecognised type renders the neutral icon.
 *
 * Real-image precedence stays whatever the surface uses today. Callers that
 * already resolve through `getOptimalEntityImageUrl` pass the whole entity;
 * callers that read `image_url` directly pass only `{ id, image_url }`, so the
 * currently displayed photo can never be swapped for a stored metadata photo by
 * this change.
 */

interface EntityCollectionImageProps {
  /** The surface's current real-image source, shaped to preserve its precedence. */
  source: EntityImageSource | null | undefined;
  /** Raw entity type; parsed through the canonical registry, never coerced. */
  type: unknown;
  /** Entity name, used for both the image alt text and the fallback label. */
  name: string;
  /** Image classes the surface already used (crop, hover zoom, sizing). */
  imageClassName: string;
  /** Icon size classes chosen to suit the surface's existing frame. */
  iconClassName: string;
}

export const EntityCollectionImage: React.FC<EntityCollectionImageProps> = ({
  source,
  type,
  name,
  imageClassName,
  iconClassName,
}) => {
  const { imageUrl, showFallback, markImageFailed } = useEntityImageFallback(source);
  const FallbackIcon = getEntityFallbackIcon(type);

  if (showFallback) {
    return (
      <span
        role="img"
        aria-label={`No image available for ${name}`}
        className="flex h-full w-full items-center justify-center text-muted-foreground"
        data-testid="entity-collection-fallback"
      >
        <FallbackIcon className={cn(iconClassName)} aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      src={imageUrl ?? undefined}
      alt={name}
      className={imageClassName}
      onError={markImageFailed}
      data-testid="entity-collection-photo"
    />
  );
};
