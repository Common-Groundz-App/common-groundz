import { useBatchEntities } from '@/hooks/use-batch-entities';
import { ChatEntityCard } from './ChatEntityCard';
import { EntityCardSkeleton } from './EntityCardSkeleton';
import { useCircleRating } from '@/hooks/use-circle-rating';
import { Entity } from '@/services/recommendation/types';

interface ShortlistItem {
  entityId?: string;
  entityName?: string;
  product?: string; // Legacy field name
  entityType?: string;
  score: number;
  verified: boolean;
  reason?: string;
  sources: Array<{ type: string; count: number }>;
  signals?: {
    avgRating?: number;
    reviewCount?: number;
  };
}

interface ChatRecommendationCardsProps {
  shortlist: ShortlistItem[];
  maxCards?: number;
}

/**
 * Calculate which item should be top pick based on weighted score
 * Formula: rating * log(reviewCount + 2) balances quality with confidence
 * 
 * Guardrail: Items with < 2 reviews are never marked as top pick
 * Returns -1 if no item qualifies (all have insufficient reviews)
 * 
 * Fallback: If signals are missing, uses entity.external_rating and entity.external_rating_count
 * Tie-breaker: Higher review count wins, then alphabetical by entityId
 */
const getTopPickIndex = (
  items: ShortlistItem[], 
  entitiesMap?: Map<string, Entity>
): number => {
  if (items.length === 0) return -1;
  
  let maxScore = -1;
  let maxReviews = -1;
  let topEntityId = '';
  let topIdx = -1; // -1 means no top pick
  
  items.forEach((item, idx) => {
    // Try signals first, then fallback to entity data
    const entity = item.entityId ? entitiesMap?.get(item.entityId) : undefined;
    // Fallback chain: signals -> Entity interface fields -> 0
    const rating = item.signals?.avgRating || entity?.average_rating || 0;
    const reviews = item.signals?.reviewCount || entity?.review_count || 0;
    
    // GUARDRAIL: Minimum 2 reviews to be eligible for top pick
    if (reviews < 2) return;
    
    // Weighted score: rating * log(reviewCount + 2)
    const score = rating * Math.log(reviews + 2);
    const entityId = item.entityId || '';
    
    // Deterministic selection with tie-breakers:
    // 1. Higher score wins
    // 2. If tied: higher review count wins (more confidence)
    // 3. If still tied: alphabetically later entityId wins (deterministic)
    const shouldReplace = 
      score > maxScore || 
      (score === maxScore && reviews > maxReviews) ||
      (score === maxScore && reviews === maxReviews && entityId > topEntityId);
    
    if (shouldReplace) {
      maxScore = score;
      maxReviews = reviews;
      topEntityId = entityId;
      topIdx = idx;
    }
  });
  
  return topIdx;
};

/**
 * Container component that handles batch fetching and renders entity cards
 */
export function ChatRecommendationCards({ 
  shortlist, 
  maxCards = 3 
}: ChatRecommendationCardsProps) {
  // Get all entity IDs from shortlist
  const entityIds = shortlist
    .map(item => item.entityId)
    .filter((id): id is string => Boolean(id));
  
  // Batch fetch all entities
  const { data: entitiesMap, isLoading } = useBatchEntities(entityIds);
  
  // Show loading skeletons while fetching
  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Based on Common Groundz reviews:
        </p>
        {shortlist.slice(0, maxCards).map((_, idx) => (
          <EntityCardSkeleton key={idx} />
        ))}
      </div>
    );
  }
  
  // Get visible items
  const visibleItems = shortlist.slice(0, maxCards);
  const remainingCount = shortlist.length - maxCards;
  
  // Calculate top pick based on score (with entity fallback for resilience)
  // Gate computation until entities are loaded to prevent flicker
  const topPickIdx = isLoading ? -1 : getTopPickIndex(visibleItems, entitiesMap);
  
  return (
    <div className="space-y-3 mt-1">
      {visibleItems.map((item, idx) => (
        <ChatEntityCardWithCircle
          key={item.entityId || idx}
          item={item}
          entity={item.entityId ? entitiesMap?.get(item.entityId) : undefined}
          isTopPick={idx === topPickIdx}
        />
      ))}
      
      {remainingCount > 0 && (
        <button className="text-xs text-primary hover:underline transition-colors">
          +{remainingCount} more recommendations
        </button>
      )}
    </div>
  );
}

/**
 * Wrapper component to fetch circle rating for individual cards
 */
function ChatEntityCardWithCircle({ 
  item, 
  entity,
  isTopPick = false,
}: { 
  item: ShortlistItem; 
  entity?: any;
  isTopPick?: boolean;
}) {
  // Fetch circle rating for this entity
  const { circleRating, circleRatingCount, isLoading } = useCircleRating(item.entityId || '');
  
  return (
    <ChatEntityCard
      entityId={item.entityId || ''}
      entityName={item.entityName || item.product || 'Unknown'}
      entityType={item.entityType}
      verified={item.verified}
      score={item.score}
      reason={item.reason}
      signals={item.signals}
      entity={entity}
      circleRating={isLoading ? null : circleRating}
      circleRatingCount={circleRatingCount}
      isTopPick={isTopPick}
    />
  );
}
