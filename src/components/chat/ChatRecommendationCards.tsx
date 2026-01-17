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
  
  return (
    <div className="space-y-3 mt-1">
      {visibleItems.map((item, idx) => (
        <ChatEntityCardWithCircle
          key={item.entityId || idx}
          item={item}
          entity={item.entityId ? entitiesMap?.get(item.entityId) : undefined}
          isTopPick={idx === 0}
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
