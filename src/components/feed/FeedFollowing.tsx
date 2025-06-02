
import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFeed } from '@/hooks/feed/use-feed';
import FeedItem from './FeedItem';
import FeedSkeleton from './FeedSkeleton';
import { Button } from '@/components/ui/button';
import { UserPlus, AlertCircle, Loader } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { motion, AnimatePresence } from 'framer-motion';

interface FeedFollowingProps {
  refreshing?: boolean;
}

const FeedFollowing: React.FC<FeedFollowingProps> = ({ refreshing = false }) => {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  // CRITICAL: Don't render feed logic until auth is ready
  if (isLoading) {
    return <FeedSkeleton />;
  }

  // Don't render if no user
  if (!user) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Authentication required</p>
        </div>
      </div>
    );
  }

  const { 
    items, 
    isLoading: feedLoading, 
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

  // Handle refreshing prop changes
  useEffect(() => {
    if (refreshing) {
      refreshFeed();
    }
  }, [refreshing, refreshFeed]);

  // Show loading skeleton only for initial load or when explicitly refreshing
  if (feedLoading && items.length === 0) {
    return <FeedSkeleton />;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            There was a problem loading the feed.
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshFeed}
              className="ml-2"
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : items.length === 0 && !feedLoading ? (
        <Card className="border-dashed">
          <CardContent className="text-center py-12 flex flex-col items-center">
            <div className="mb-4 p-4 bg-muted rounded-full">
              <UserPlus size={40} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No recommendations yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Follow people to see their recommendations in your feed
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
          <AnimatePresence>
            {refreshing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full py-2 flex justify-center items-center gap-2 text-brand-orange"
              >
                <Loader className="animate-spin" size={18} />
                <span className="text-sm font-medium">Refreshing your feed...</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          <motion.div 
            className="space-y-8"
            animate={{ opacity: refreshing ? 0.7 : 1 }}
            transition={{ duration: 0.2 }}
          >
            {items.map(item => (
              <FeedItem 
                key={item.id} 
                item={item} 
                onLike={handleLike}
                onSave={handleSave}
              />
            ))}
          </motion.div>
          
          {hasMore && (
            <div className="pt-6 flex justify-center">
              <Button 
                variant="outline" 
                onClick={loadMore} 
                disabled={isLoadingMore}
                className="flex items-center gap-2"
              >
                {isLoadingMore ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Loading...</span>
                  </>
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
