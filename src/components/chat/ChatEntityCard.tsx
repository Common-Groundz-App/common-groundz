import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';
import { RatingRingIcon } from '@/components/ui/rating-ring-icon';
import { getEntityTypeFallbackImage } from '@/services/entityTypeHelpers';
import { getSentimentColor } from '@/utils/ratingColorUtils';
import { cn } from '@/lib/utils';

interface ChatEntityCardProps {
  entityId: string;
  entityName: string;
  entityType?: string;
  verified: boolean;
  score: number;
  reason?: string;
  signals?: {
    avgRating?: number;
    reviewCount?: number;
  };
  entity?: Entity | null;
  circleRating?: number | null;
  circleRatingCount?: number;
}

/**
 * Generate a fallback description when entity.description is null
 * Strips rating-related text to avoid duplication with rating display
 */
const getFallbackDescription = (
  entity: Entity | null | undefined,
  entityType: string | undefined,
  reason?: string
): string => {
  // Priority 1: Use the recommendation reason (but strip rating mentions)
  if (reason) {
    const cleanedReason = reason
      .replace(/\d+\/\d+\s*(on|rating|stars?|from)/gi, '')
      .replace(/rated?\s*\d+(\.\d+)?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanedReason && cleanedReason.length > 10) return cleanedReason;
  }
  
  // Priority 2: Use entity description
  if (entity?.description) {
    return entity.description;
  }
  
  // Priority 3: Generate from entity data
  if (entity) {
    const metadata = entity.metadata as Record<string, any> | null;
    
    if (metadata?.formatted_address) {
      return `Located in ${metadata.formatted_address}`;
    }
    if (entity.venue) {
      return `At ${entity.venue}`;
    }
  }
  
  return 'Tap to view details and reviews';
};

/**
 * Compact entity card for chat recommendations.
 * Shows image, name, rating, and description.
 */
export function ChatEntityCard({
  entityId,
  entityName,
  entityType,
  score,
  reason,
  signals,
  entity,
  circleRating,
  circleRatingCount = 0,
}: ChatEntityCardProps) {
  const navigate = useNavigate();
  
  // Rating precedence: resolver signals (if valid) → entity stats → null
  const resolverRating = typeof signals?.avgRating === 'number' && signals.avgRating > 0 
    ? signals.avgRating 
    : null;
  const entityRating = (entity as any)?.average_rating ?? null;
  const displayRating = resolverRating ?? entityRating;
  
  const reviewCount = 
    (typeof signals?.reviewCount === 'number' && signals.reviewCount > 0)
      ? signals.reviewCount
      : (entity as any)?.review_count ?? 0;
  
  // Explicit guard for valid rating display
  const hasValidRating = typeof displayRating === 'number' && displayRating > 0 && !isNaN(displayRating);
  
  // Get image URL with fallback
  const imageUrl = entity?.image_url || getEntityTypeFallbackImage(entityType || entity?.type || 'product');
  
  // Get description with fallback
  const description = entity?.description || getFallbackDescription(entity, entityType, reason);
  
  // Handle click to navigate to entity page
  const handleClick = () => {
    if (entity?.slug) {
      navigate(`/entity/${entity.slug}?v=4`);
    } else if (entityId) {
      navigate(`/entity/${entityId}?v=4`);
    }
  };
  
  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-background/50",
        "hover:bg-muted/50 hover:border-border transition-all cursor-pointer text-left",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
      )}
    >
      {/* Entity Image */}
      <div className="w-12 h-12 rounded-md overflow-hidden shrink-0 bg-muted">
        <img
          src={imageUrl}
          alt={entityName}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = getEntityTypeFallbackImage(entityType || 'product');
          }}
        />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Header: Name only */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground truncate">
            {entityName}
          </span>
        </div>
        
        {/* Meta: Rating + Circle Rating with overflow protection */}
        <div className="flex items-center gap-x-2 gap-y-1 text-xs text-muted-foreground flex-wrap min-w-0">
          {/* Overall Rating */}
          <div className="flex items-center gap-1.5">
            <RatingRingIcon rating={displayRating || 0} size={14} />
            {hasValidRating ? (
              <>
                <span 
                  className="font-medium" 
                  style={{ color: getSentimentColor(displayRating) }}
                >
                  {displayRating.toFixed(1)}
                </span>
                {reviewCount > 0 && (
                  <span className="text-muted-foreground">
                    ({reviewCount})
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">No ratings</span>
            )}
          </div>
          
          {/* Circle Rating */}
          {circleRating && circleRatingCount > 0 && (
            <>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Users 
                  className="h-3.5 w-3.5" 
                  style={{ color: getSentimentColor(circleRating) }}
                />
                <span 
                  className="font-medium" 
                  style={{ color: getSentimentColor(circleRating) }}
                >
                  {circleRating.toFixed(1)}
                </span>
                <span className="text-muted-foreground">
                  ({circleRatingCount})
                </span>
              </div>
            </>
          )}
        </div>
        
        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-1">
          {description}
        </p>
      </div>
    </button>
  );
}
