import { useNavigate } from 'react-router-dom';
import { Shield, Globe, Users, ExternalLink } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';
import { RatingRingIcon } from '@/components/ui/rating-ring-icon';
import { getEntityTypeLabel, getEntityTypeFallbackImage } from '@/services/entityTypeHelpers';
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
 */
const getFallbackDescription = (
  entity: Entity | null | undefined,
  entityType: string | undefined,
  reason?: string
): string => {
  // Priority 1: Use the recommendation reason
  if (reason) return reason;
  
  // Priority 2: Generate from entity data
  if (entity) {
    const type = getEntityTypeLabel(entity.type || entityType || 'product');
    const metadata = entity.metadata as Record<string, any> | null;
    
    if (metadata?.formatted_address) {
      return `A ${type.toLowerCase()} located in ${metadata.formatted_address}`;
    }
    if (entity.venue) {
      return `A ${type.toLowerCase()} at ${entity.venue}`;
    }
    return `A ${type.toLowerCase()} on Common Groundz`;
  }
  
  return 'Recommended based on platform reviews';
};

/**
 * Compact entity card for chat recommendations.
 * Shows image, name, type, rating, verified status, and description.
 */
export function ChatEntityCard({
  entityId,
  entityName,
  entityType,
  verified,
  score,
  reason,
  signals,
  entity,
  circleRating,
  circleRatingCount = 0,
}: ChatEntityCardProps) {
  const navigate = useNavigate();
  
  // Use resolver signals for rating (consistency with backend)
  const displayRating = signals?.avgRating ?? (entity as any)?.average_rating ?? null;
  const reviewCount = signals?.reviewCount ?? 0;
  
  // Get image URL with fallback
  const imageUrl = entity?.image_url || getEntityTypeFallbackImage(entityType || entity?.type || 'product');
  
  // Get type label
  const typeLabel = getEntityTypeLabel(entityType || entity?.type || 'product');
  
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
        {/* Header: Name + Verified badge */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground truncate">
            {entityName}
          </span>
          {verified ? (
            <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
          ) : (
            <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
        </div>
        
        {/* Meta: Type, Rating, Circle Rating */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{typeLabel}</span>
          
          {displayRating && displayRating > 0 && (
            <>
              <span>•</span>
              <div className="flex items-center gap-1">
                <RatingRingIcon rating={displayRating} size={12} />
                <span>{displayRating.toFixed(1)}</span>
                {reviewCount > 0 && (
                  <span className="text-muted-foreground/70">({reviewCount})</span>
                )}
              </div>
            </>
          )}
          
          {circleRating && circleRatingCount > 0 && (
            <>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{circleRating.toFixed(1)}</span>
                <span className="text-muted-foreground/70">({circleRatingCount})</span>
              </div>
            </>
          )}
        </div>
        
        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-1">
          {description}
        </p>
      </div>
      
      {/* Arrow indicator */}
      <ExternalLink className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
    </button>
  );
}
