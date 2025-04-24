import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useHome } from '@/hooks/home/use-home';
import FeedItem from './FeedItem';
import FeedSkeleton from './FeedSkeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw, UserPlus, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const FollowingFeed = () => {
  const { user } = useAuth();
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
    handleSave
  } = useHome('following');

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
    window.addEventListener('refresh-following-home', handleRefresh);
    
    return () => {
      window.removeEventListener('refresh-following-home', handleRefresh);
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
            There was a problem loading the home feed.
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
        <Card className="border-dashed">
          <CardContent className="text-center py-12 flex flex-col items-center">
            <div className="mb-4 p-4 bg-muted rounded-full">
              <UserPlus size={40} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No recommendations yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Follow people to see their recommendations in your home feed
            </p>
            <Button 
              size="lg"
              asChild
              className="px-6"
            >
              <Link to={`/profile/${user?.id}`}>Find people to follow</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-8">
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

export default FollowingFeed;
