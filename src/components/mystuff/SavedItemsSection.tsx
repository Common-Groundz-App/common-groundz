import React, { useState } from 'react';
import { Bookmark, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSavedItems, SavedItemType, SavedItem } from '@/hooks/use-saved-items';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import SavedPostCard from './saved/SavedPostCard';
import SavedReviewCard from './saved/SavedReviewCard';
import SavedRecommendationCard from './saved/SavedRecommendationCard';
import SavedEntityCard from './saved/SavedEntityCard';

const FILTER_OPTIONS: { value: SavedItemType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'post', label: 'Posts' },
  { value: 'review', label: 'Reviews' },
  { value: 'recommendation', label: 'Recommendations' },
  { value: 'entity', label: 'Places & Products' },
];

const SavedItemsSection = () => {
  const [typeFilter, setTypeFilter] = useState<SavedItemType>('all');
  const { items, isLoading, loadMore, hasMore, unsaveItem, isUnsaving } = useSavedItems(typeFilter);
  const { toast } = useToast();

  const handleUnsave = async (item: SavedItem) => {
    try {
      await unsaveItem(item);
      toast({
        title: 'Removed from saved',
        description: 'Item has been removed from your saved items.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove item. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const renderItem = (item: SavedItem) => {
    switch (item.type) {
      case 'post':
        return <SavedPostCard key={item.id} item={item} onUnsave={() => handleUnsave(item)} />;
      case 'review':
        return <SavedReviewCard key={item.id} item={item} onUnsave={() => handleUnsave(item)} />;
      case 'recommendation':
        return <SavedRecommendationCard key={item.id} item={item} onUnsave={() => handleUnsave(item)} />;
      case 'entity':
        return <SavedEntityCard key={item.id} item={item} onUnsave={() => handleUnsave(item)} />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={typeFilter === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter(option.value)}
            className={cn(
              'rounded-full',
              typeFilter === option.value && 'bg-primary text-primary-foreground'
            )}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Items or Empty State */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Bookmark className="h-12 w-12 text-muted-foreground" />
          </div>
          
          <h3 className="text-xl font-semibold mb-2">No saved items yet</h3>
          <p className="text-muted-foreground max-w-sm">
            Save posts, reviews, recommendations, and places to find them here.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {items.map(renderItem)}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isUnsaving}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SavedItemsSection;
