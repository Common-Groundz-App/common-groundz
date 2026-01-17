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
  isTopPick?: boolean;
}

/**
 * Get a human-readable label for entity type
 */
const getEntityTypeLabel = (type: string): string => {
  const typeLabels: Record<string, string> = {
    place: 'Place',
    product: 'Product',
    movie: 'Movie',
    book: 'Book',
    service: 'Service',
    restaurant: 'Restaurant',
    cafe: 'Cafe',
    hotel: 'Hotel',
    attraction: 'Attraction',
    others: 'Recommendation',
  };
  return typeLabels[type?.toLowerCase()] || 'Recommendation';
};

/**
 * Extract area/neighborhood from formatted address
 */
const extractAreaFromAddress = (address: string | undefined): string | null => {
  if (!address) return null;
  
  // Split by comma and get the 2nd segment (usually neighborhood/area)
  const parts = address.split(',').map(p => p.trim());
  
  // Skip first part (usually street/building), return second if it looks like an area
  if (parts.length >= 2 && parts[1].length < 30 && parts[1].length > 2) {
    return parts[1];
  }
  
  return null;
};

/**
 * Generate a clean, human-readable subtitle for entity cards
 * Format: {type} · {location/context}
 */
const getSmartSubtitle = (
  entity: Entity | null | undefined,
  entityType: string | undefined,
  reason?: string
): string => {
  const typeLabel = getEntityTypeLabel(entityType || entity?.type || 'others');
  
  // Priority 1: Type + Location from metadata
  if (entity) {
    const metadata = entity.metadata as Record<string, any> | null;
    
    // Extract location/area info
    const location = metadata?.locality || 
                     metadata?.city || 
                     metadata?.area ||
                     extractAreaFromAddress(metadata?.formatted_address);
    
    if (location) {
      return `${typeLabel} · ${location}`;
    }
    
    // Venue as fallback location
    if (entity.venue) {
      return `${typeLabel} · ${entity.venue}`;
    }
  }
  
  // Priority 2: Clean reason (stripped of rating text, reasonable length)
  if (reason) {
    const cleanedReason = reason
      .replace(/\d+\/\d+\s*(on|rating|stars?|from)/gi, '')
      .replace(/rated?\s*\d+(\.\d+)?/gi, '')
      .replace(/Common Groundz[;,]?\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleanedReason.length > 15 && cleanedReason.length < 60) {
      return cleanedReason;
    }
  }
  
  // Priority 3: Entity description (first sentence only)
  if (entity?.description) {
    const firstSentence = entity.description.split(/[.!?]/)[0].trim();
    if (firstSentence.length > 10 && firstSentence.length < 60) {
      return firstSentence;
    }
  }
  
  // Fallback: Just the type
  return typeLabel;
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
  isTopPick = false,
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
  
  // Get smart subtitle for card (replaces verbose description)
  const subtitle = getSmartSubtitle(entity, entityType, reason);
  
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
        "relative w-full flex items-start gap-3 p-3 rounded-lg border bg-background/50",
        "hover:bg-muted/50 hover:border-border transition-all cursor-pointer text-left",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
        isTopPick 
          ? "border-primary/40 bg-primary/5" 
          : "border-border/60"
      )}
    >
      {/* Top Pick Badge */}
      {isTopPick && (
        <div className="absolute -top-2 left-3 px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-medium rounded">
          Top pick
        </div>
      )}
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
        
        {/* Subtitle */}
        <p className="text-xs text-muted-foreground truncate">
          {subtitle}
        </p>
      </div>
    </button>
  );
}
