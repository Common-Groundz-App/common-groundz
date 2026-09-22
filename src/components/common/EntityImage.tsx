import React from 'react';
import { cn } from '@/lib/utils';
import type { Entity } from '@/services/recommendation/types';
import { useEntityImageFallback } from '@/hooks/useEntityImageFallback';
import { getEntityFallbackIcon } from '@/utils/entityImageFallback';

interface EntityImageProps {
  entity: Entity;
  className?: string;
  fallbackClassName?: string;
  decorative?: boolean;
}

export const EntityImage: React.FC<EntityImageProps> = ({
  entity,
  className,
  fallbackClassName,
  decorative = false,
}) => {
  const { imageUrl, showFallback, markImageFailed } = useEntityImageFallback(entity);
  const FallbackIcon = getEntityFallbackIcon(entity.type);
  const accessibleLabel = decorative ? undefined : entity.name;

  if (showFallback) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground',
          className,
          fallbackClassName,
        )}
        role={decorative ? undefined : 'img'}
        aria-label={accessibleLabel}
        aria-hidden={decorative ? true : undefined}
        data-testid="entity-image-fallback"
      >
        <FallbackIcon className="h-1/2 w-1/2" aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={decorative ? '' : entity.name}
      className={cn('shrink-0 rounded-full object-cover', className)}
      onError={markImageFailed}
      data-testid="entity-image"
    />
  );
};