
import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFeed } from '@/hooks/feed/use-feed';
import FeedItem from './FeedItem';
import FeedSkeleton from './FeedSkeleton';
import FeedEmptyState from './FeedEmptyState';
import { Button } from '@/components/ui/button';
import { RefreshCw, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const FeedFollowing = () => {
  const { user } = useAuth();
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
  } = useFeed('following');

  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load feed. Please try again.',
        variant: 'destructive'
      });
    }
  }, [error, toast]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">From people you follow</h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshFeed}
          disabled={isLoading}
          className="flex items-center gap-1"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>
      
      {isLoading ? (
        <FeedSkeleton />
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <div className="mb-4 flex justify-center">
            <UserPlus size={48} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium mb-2">No recommendations yet</h3>
          <p className="text-muted-foreground mb-6">
            Follow people to see their recommendations in your feed
          </p>
          <Button asChild>
            <Link to={`/profile/${user?.id}`}>Find people to follow</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-6">
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
            <div className="pt-4 flex justify-center">
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

export default FeedFollowing;
