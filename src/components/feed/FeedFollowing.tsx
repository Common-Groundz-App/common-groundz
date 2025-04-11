
import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFeed } from '@/hooks/feed/use-feed';
import FeedItem from './FeedItem';
import FeedSkeleton from './FeedSkeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw, UserPlus, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

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
  
  useEffect(() => {
    const handleRefresh = () => refreshFeed();
    window.addEventListener('refresh-following-feed', handleRefresh);
    
    return () => {
      window.removeEventListener('refresh-following-feed', handleRefresh);
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
        <Card className="border-dashed overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="text-center py-12 flex flex-col items-center">
            <div className="mb-4 p-5 bg-brand-orange/10 rounded-full">
              <UserPlus size={40} className="text-brand-orange" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No recommendations yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Follow people to see their recommendations and posts in your feed
            </p>
            <Button 
              size="lg"
              asChild
              className="px-8 bg-brand-orange hover:bg-brand-orange/90 transition-all"
            >
              <Link to={`/profile/${user?.id}`}>Find people to follow</Link>
            </Button>
          </CardContent>
        </Card>
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

export default FeedFollowing;
