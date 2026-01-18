import { useBatchEntities } from '@/hooks/use-batch-entities';
import { ChatEntityCard } from './ChatEntityCard';
import { EntityCardSkeleton } from './EntityCardSkeleton';
import { useCircleRating } from '@/hooks/use-circle-rating';

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
 */
const getTopPickIndex = (items: ShortlistItem[]): number => {
  if (items.length === 0) return -1;
  
  let maxScore = -1;
  let topIdx = -1; // -1 means no top pick
  
  items.forEach((item, idx) => {
    const rating = item.signals?.avgRating || 0;
    const reviews = item.signals?.reviewCount || 0;
    
    // GUARDRAIL: Minimum 2 reviews to be eligible for top pick
    if (reviews < 2) return;
    
    // Weighted score: rating * log(reviewCount + 2)
    // This balances quality with confidence (more reviews = higher confidence)
    const score = rating * Math.log(reviews + 2);
    
    if (score > maxScore) {
      maxScore = score;
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
  
  // Calculate top pick based on score (not just position)
  const topPickIdx = getTopPickIndex(visibleItems);
  
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
