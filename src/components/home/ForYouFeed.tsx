import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useHome } from '@/hooks/home/use-home';
import FeedItem from '../feed/FeedItem';
import FeedSkeleton from '../feed/FeedSkeleton';
import FeedEmptyState from '../feed/FeedEmptyState';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const ForYouFeed = () => {
  const { toast } = useToast();
  const { 
    items, 
    isLoading, 
    error, 
    hasMore, 
    loadMore, 
    isLoadingMore,
    refreshHome,
    handleLike,
    handleSave,
    handleDelete
  } = useHome('for_you');

  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load home feed. Please try again.',
        variant: 'destructive'
      });
    }
  }, [error, toast]);

  useEffect(() => {
    const handleRefresh = () => refreshHome();
    window.addEventListener('refresh-for-you-home', handleRefresh);
    
    return () => {
      window.removeEventListener('refresh-for-you-home', handleRefresh);
    };
  }, [refreshHome]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshHome}
          disabled={isLoading}
          className="flex items-center gap-1"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>
      
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            There was a problem loading the feed.
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshHome}
              className="ml-2"
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
          <div className="space-y-8">
            {items.map(item => (
              <FeedItem 
                key={item.id} 
                item={item} 
                onLike={handleLike}
                onSave={handleSave}
                onComment={(id) => console.log('Comment on', id)}
                onDelete={handleDelete}
                refreshFeed={refreshHome}
              />
            ))}
          </div>
          
          {hasMore && (
            <div className="pt-6 flex justify-center">
              <Button 
                variant="outline" 
                onClick={loadMore} 
                disabled={isLoadingMore}
              >
                {isLoadingMore ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ForYouFeed;
