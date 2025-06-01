
import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFeed } from '@/hooks/feed/use-feed';
import FeedItem from './FeedItem';
import FeedSkeleton from './FeedSkeleton';
import FeedEmptyState from './FeedEmptyState';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface FeedForYouProps {
  refreshing?: boolean;
}

const FeedForYou: React.FC<FeedForYouProps> = ({ refreshing = false }) => {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  console.log('📰 [FeedForYou] Rendering - isLoading:', isLoading, 'user:', user ? 'authenticated' : 'not authenticated');

  // CRITICAL: Don't render feed logic until auth is ready
  if (isLoading) {
    console.log('⏳ [FeedForYou] Auth loading, showing skeleton...');
    return <FeedSkeleton />;
  }

  // Don't render if no user
  if (!user) {
    console.log('❌ [FeedForYou] No user, should not render');
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
    handleSave,
    handleDelete
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

  // Handle refreshing prop changes
  useEffect(() => {
    if (refreshing) {
      refreshFeed();
    }
  }, [refreshing, refreshFeed]);

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
      ) : feedLoading ? (
        <FeedSkeleton />
      ) : items.length === 0 ? (
        <FeedEmptyState />
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
                onComment={(id) => console.log('Comment on', id)}
                onDelete={handleDelete}
                refreshFeed={refreshFeed}
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

export default FeedForYou;
