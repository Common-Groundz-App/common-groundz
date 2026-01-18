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
 * Extract area/neighborhood from formatted address (filters postcodes & generic data)
 */
const extractAreaFromAddress = (address: string | undefined): string | null => {
  if (!address) return null;
  
  const parts = address.split(',').map(p => p.trim());
  
  // Find a segment that looks like a neighborhood/area
  for (let i = 1; i < Math.min(parts.length, 4); i++) {
    const part = parts[i];
    // Skip if it's mostly numbers (postcode)
    if (/^\d+$/.test(part.replace(/\s/g, ''))) continue;
    // Skip if it contains a postcode pattern (5-6 digit number)
    if (/\b\d{5,6}\b/.test(part)) continue;
    // Skip if too short or too long
    if (part.length < 4 || part.length > 30) continue;
    // Skip country names
    if (/^(India|USA|UK|United States|United Kingdom)$/i.test(part)) continue;
    // Skip state names that are too generic
    if (/^(Karnataka|Tamil Nadu|Maharashtra|Delhi|Kerala)$/i.test(part)) continue;
    
    return part;
  }
  
  return null;
};

/**
 * Infer a more specific type label from entity name/description
 */
const inferSpecificType = (
  entity: Entity | null | undefined,
  baseType: string
): string => {
  const name = entity?.name?.toLowerCase() || '';
  const desc = entity?.description?.toLowerCase() || '';
  const combined = `${name} ${desc}`;
  
  // Type inference patterns (order matters - more specific first)
  const patterns: Array<{ keywords: string[]; label: string }> = [
    { keywords: ['botanical garden', 'botanic garden'], label: 'Botanical garden' },
    { keywords: ['garden'], label: 'Garden' },
    { keywords: ['park'], label: 'Park' },
    { keywords: ['pizzeria', 'pizza'], label: 'Pizzeria' },
    { keywords: ['cafe', 'coffee', 'bakery'], label: 'Cafe' },
    { keywords: ['restaurant', 'dining', 'eatery'], label: 'Restaurant' },
    { keywords: ['hotel', 'resort', 'stay'], label: 'Hotel' },
    { keywords: ['temple', 'mandir'], label: 'Temple' },
    { keywords: ['church', 'cathedral', 'chapel'], label: 'Church' },
    { keywords: ['mosque', 'masjid'], label: 'Mosque' },
    { keywords: ['ashram', 'foundation', 'spiritual', 'meditation', 'yoga'], label: 'Spiritual center' },
    { keywords: ['museum', 'gallery'], label: 'Museum' },
    { keywords: ['mall', 'shopping'], label: 'Shopping' },
    { keywords: ['bar', 'pub', 'brewery', 'lounge'], label: 'Bar' },
    { keywords: ['gym', 'fitness'], label: 'Fitness' },
    { keywords: ['spa', 'wellness'], label: 'Spa' },
    { keywords: ['beach'], label: 'Beach' },
    { keywords: ['lake', 'waterfall', 'falls'], label: 'Natural attraction' },
    { keywords: ['zoo', 'sanctuary', 'wildlife'], label: 'Wildlife' },
    { keywords: ['theater', 'theatre', 'cinema'], label: 'Entertainment' },
  ];
  
  for (const { keywords, label } of patterns) {
    if (keywords.some(kw => combined.includes(kw))) {
      return label;
    }
  }
  
  // Fallback to base type
  return baseType;
};

/**
 * Generate a smart subtitle for the card that provides context
 * Priority: Type + Location (NEVER uses entity name as location)
 * 
 * Key rules:
 * 1. Never use entity name as location (avoid redundancy)
 * 2. Skip postcodes, too-long locations, and generic terms
 * 3. Fallback to just type label (better than bad location)
 */
const getSmartSubtitle = (
  entity: Entity | null | undefined,
  entityType: string | undefined,
  reason?: string
): string => {
  const baseType = getEntityTypeLabel(entityType || entity?.type || 'others');
  const typeLabel = inferSpecificType(entity, baseType);
  const entityName = entity?.name?.toLowerCase() || '';
  
  // Only try location if we have entity data
  if (entity) {
    const metadata = entity.metadata as Record<string, any> | null;
    
    // Location candidates in priority order
    const locationCandidates = [
      metadata?.neighborhood,
      metadata?.sublocality,
      extractAreaFromAddress(metadata?.formatted_address),
      metadata?.locality,
      metadata?.area,
      metadata?.city,
      entity.venue,
    ].filter((loc): loc is string => Boolean(loc) && typeof loc === 'string');
    
    for (const loc of locationCandidates) {
      // Skip postcodes
      if (/^\d{5,6}$/.test(loc)) continue;
      
      // Skip if location contains the entity name (to avoid "Isha Foundation · Isha Foun...")
      if (entityName && loc.toLowerCase().includes(entityName.substring(0, 8))) continue;
      
      // Skip if too long (> 25 chars)
      if (loc.length > 25) continue;
      
      // Skip generic country/state names
      const genericTerms = ['india', 'karnataka', 'maharashtra', 'tamil nadu', 'delhi', 'unknown'];
      if (genericTerms.some(term => loc.toLowerCase() === term)) continue;
      
      return `${typeLabel} · ${loc}`;
    }
  }
  
  // Fallback: Just the type label (no location is better than bad location)
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
