
import React from 'react';
import { Link } from 'react-router-dom';
import { EntitySearchResult } from '@/hooks/use-unified-search';
import { MapPin } from 'lucide-react';
import { getEntityUrlWithParent } from '@/utils/entityUrlUtils';
import { RichTextDisplay } from '@/components/editor/RichTextEditor';
import { getEntityTypeLabel } from '@/services/entityTypeHelpers';
import { EntityCategoryBadge } from '@/components/entity/EntityCategoryBadge';
import { shouldHideCategory } from '@/services/categoryService';
import { getOptimalEntityImageUrl } from '@/utils/entityImageUtils';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';

interface EntityResultItemProps {
  entity: EntitySearchResult;
  onClick: () => void;
}

export function EntityResultItem({ entity, onClick }: EntityResultItemProps) {
  const getEntityPath = () => getEntityUrlWithParent(entity);

  // Rating guard: only render when we have real review data
  const hasRating =
    typeof entity.review_count === 'number' &&
    entity.review_count > 0 &&
    entity.average_rating != null;

  const ratingValue = Number(entity.average_rating ?? 0);
  const reviewCount = entity.review_count ?? 0;
  const reviewLabel = reviewCount === 1 ? 'review' : 'reviews';

  const imageUrl = getOptimalEntityImageUrl(entity);

  return (
    <Link
      to={getEntityPath()}
      className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-all duration-200 rounded-lg hover:scale-[1.02] last:border-b-0"
      onClick={onClick}
    >
      {/* Square thumbnail to match All Items rows */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative">
        {imageUrl ? (
          <ImageWithFallback
            src={imageUrl}
            alt={entity.name}
            entityType={entity.type}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            {entity.name[0]?.toUpperCase() || 'E'}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Title-first */}
        <h3 className="font-medium text-sm truncate">{entity.name}</h3>

        {entity.venue && (
          <div className="flex items-center text-xs text-muted-foreground mt-0.5">
            <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
            <span className="truncate">{entity.venue}</span>
          </div>
        )}

        {entity.description && (
          <div className="text-xs text-muted-foreground line-clamp-2 mt-1 prose prose-sm">
            <RichTextDisplay content={entity.description} />
          </div>
        )}

        {/* Bottom row: badge + optional rating */}
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {entity.category_id && !shouldHideCategory(entity.category_id) ? (
            <EntityCategoryBadge
              categoryId={entity.category_id}
              showFullPath={false}
              variant="outline"
              className="text-xs py-0.5 px-2 h-auto rounded-full bg-primary/10 text-primary border-transparent"
            />
          ) : (
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
              {getEntityTypeLabel(entity.type)}
            </span>
          )}

          {hasRating && (
            <div className="flex items-center gap-1.5">
              <ConnectedRingsRating
                value={ratingValue}
                size="badge"
                variant="badge"
                showValue={false}
                isInteractive={false}
                minimal
              />
              <span className="text-xs text-muted-foreground">
                {ratingValue.toFixed(1)} · {reviewCount} {reviewLabel}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
