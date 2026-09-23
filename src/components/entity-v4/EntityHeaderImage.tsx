import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEntityImageFallback } from '@/hooks/useEntityImageFallback';
import { getEntityFallbackIcon } from '@/utils/entityImageFallback';

/**
 * Group 5 — the entity page header picture area (live Entity V4 page).
 *
 * Fallback-only migration. The frame is preserved verbatim: desktop 96x96 beside
 * the title, mobile full-width 192px band above it, same radius, crop and brand
 * `object-contain` / `bg-muted` behaviour.
 *
 *  - a valid real picture renders exactly as before;
 *  - a missing, broken or registered legacy-placeholder source renders the
 *    canonical local type icon on a neutral panel, with an accessible label;
 *  - an unrecognised type renders the neutral icon.
 *
 * Refresh overlay semantics are unchanged and strictly three-way: it can only
 * appear when a real source was attempted and genuinely failed to load, for a
 * signed-in person. A missing or registered-placeholder source never reaches the
 * `<img>`, so it can never surface the overlay. The expired flag resets on both
 * entity identity and source change, so a failure on one entity can never leave
 * an overlay on the next.
 */

interface EntityHeaderImageProps {
  entityId: string | undefined;
  entityType: unknown;
  /** The entity's own image source, or null when it has none. Never ''. */
  entityImage: string | null;
  name: string;
  isMobile: boolean;
  isSignedIn: boolean;
  onRefreshHeroImage?: () => Promise<void>;
  isRefreshingImage?: boolean;
}

export const EntityHeaderImage: React.FC<EntityHeaderImageProps> = ({
  entityId,
  entityType,
  entityImage,
  name,
  isMobile,
  isSignedIn,
  onRefreshHeroImage,
  isRefreshingImage = false,
}) => {
  const [isImageExpired, setIsImageExpired] = useState(false);

  useEffect(() => {
    setIsImageExpired(false);
  }, [entityId, entityImage]);

  const { imageUrl, showFallback, markImageFailed } = useEntityImageFallback({
    id: entityId,
    image_url: entityImage,
  });
  const FallbackIcon = getEntityFallbackIcon(entityType);
  const isBrand = entityType === 'brand';

  return (
    <div
      className={`${
        isMobile
          ? 'w-full h-48 mb-4 rounded-lg overflow-hidden'
          : 'flex-shrink-0 h-24 w-24 min-w-[96px] rounded-lg overflow-hidden'
      } relative group ${isBrand ? 'bg-muted' : ''}`}
    >
      {showFallback ? (
        <span
          role="img"
          aria-label={`No image available for ${name}`}
          className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground"
          data-testid="entity-header-image-fallback"
        >
          <FallbackIcon
            className={isMobile ? 'h-12 w-12' : 'h-10 w-10'}
            aria-hidden="true"
          />
        </span>
      ) : (
        <img
          src={imageUrl ?? undefined}
          alt={name}
          className={`h-full w-full ${isBrand ? 'object-contain' : 'object-cover'}`}
          onError={() => {
            markImageFailed();
            setIsImageExpired(true);
          }}
          data-testid="entity-header-image"
        />
      )}

      {/* Refresh Button - only after a genuine load failure of a real source,
          and only for a signed-in person. */}
      {isSignedIn && isImageExpired && imageUrl && onRefreshHeroImage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg backdrop-blur-sm animate-in fade-in duration-300">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  onClick={() => onRefreshHeroImage?.()}
                  disabled={isRefreshingImage}
                  className="bg-white/90 hover:bg-white text-gray-900 shadow-lg"
                >
                  <RefreshCw className={`w-5 h-5 ${isRefreshingImage ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isRefreshingImage ? 'Refreshing...' : 'Refresh Image'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
};
