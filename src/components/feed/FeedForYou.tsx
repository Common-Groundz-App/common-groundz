
import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFeed } from '@/hooks/feed/use-feed';
import FeedItem from './FeedItem';
import FeedSkeleton from './FeedSkeleton';
import FeedEmptyState from './FeedEmptyState';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const FeedForYou = () => {
  const { toast } = useToast();
  const { 
    items, 
    isLoading, 
    error, 
    hasMore, 
    loadMore, 
    isLoadingMore,
    refreshFeed,
    handleLike,
    handleSave
  } = useFeed('for_you');

  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load feed. Please try again.',
        variant: 'destructive'
      });
    }
  }, [error, toast]);

  useEffect(() => {
    const handleRefresh = () => refreshFeed();
    window.addEventListener('refresh-for-you-feed', handleRefresh);
    
    return () => {
      window.removeEventListener('refresh-for-you-feed', handleRefresh);
    };
  }, [refreshFeed]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshFeed}
          disabled={isLoading}
          className="flex items-center gap-1.5"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </Button>
      </div>
      
      {error ? (
        <Alert variant="destructive" className="rounded-lg border-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error loading feed</AlertTitle>
          </div>
          <AlertDescription className="mt-2">
            <p className="mb-3">There was a problem loading your feed.</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshFeed}
              className="bg-white/20"
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <FeedSkeleton />
      ) : items.length === 0 ? (
        <FeedEmptyState />
      ) : (
        <>
          <div className="space-y-6 md:space-y-8">
            {items.map(item => (
              <FeedItem 
                key={item.id} 
                item={item} 
                onLike={handleLike}
                onSave={handleSave}
              />
            ))}
          </div>
          
          {hasMore && (
            <div className="pt-6 flex justify-center">
              <Button 
                variant="outline" 
                onClick={loadMore} 
                disabled={isLoadingMore}
                className="px-8 py-2 border-brand-orange/30 hover:border-brand-orange/60 transition-colors"
              >
                {isLoadingMore ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FeedForYou;
