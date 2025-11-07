
import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFeed } from '@/hooks/feed/use-feed';
import { useEnhancedInfiniteScroll } from '@/hooks/useEnhancedInfiniteScroll';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useMemoryOptimization } from '@/hooks/useMemoryOptimization';
import FeedItem from './FeedItem';
import FeedSkeleton from './FeedSkeleton';
import FeedEmptyState from './FeedEmptyState';
import FeedEndState from './FeedEndState';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

interface EnhancedFeedForYouProps {
  refreshing?: boolean;
}

const EnhancedFeedForYou: React.FC<EnhancedFeedForYouProps> = ({ refreshing = false }) => {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { startRender, endRender } = usePerformanceMonitor('FeedForYou');
  
  // Memory optimization
  useMemoryOptimization({
    componentName: 'FeedForYou',
    cleanupInterval: 60000, // 1 minute
    maxMemoryUsage: 100 // 100MB
  });

  // Call hooks unconditionally
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

  // Enhanced infinite scroll with performance monitoring
  const { loadMoreRef } = useEnhancedInfiniteScroll({
    hasMore,
    isLoading: isLoadingMore,
    loadMore,
    threshold: 300,
    rootMargin: '100px',
    enabled: !feedLoading && !error && !!user
  });

  useEffect(() => {
    startRender();
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load feed. Please try again.',
        variant: 'destructive'
      });
    }
    
    endRender();
  }, [error, toast, startRender, endRender]);

  useEffect(() => {
    const handleRefresh = () => refreshFeed();
    window.addEventListener('refresh-for-you-feed', handleRefresh);
    
    return () => {
      window.removeEventListener('refresh-for-you-feed', handleRefresh);
    };
  }, [refreshFeed]);

  useEffect(() => {
    if (refreshing) {
      refreshFeed();
    }
  }, [refreshing, refreshFeed]);

  // Handle auth and loading states in render logic
  if (authLoading || (feedLoading && items.length === 0)) {
    return <FeedSkeleton />;
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Authentication required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            There was a problem loading the feed. Please refresh to try again.
          </AlertDescription>
        </Alert>
      ) : items.length === 0 && !feedLoading ? (
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
            {items.map((item) => (
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
          
          {/* Infinite scroll trigger */}
          <div ref={loadMoreRef} className="py-4">
            {isLoadingMore && (
              <div className="flex justify-center items-center gap-2">
                <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading more...</span>
              </div>
            )}
            {!hasMore && items.length > 0 && !isLoadingMore && <FeedEndState />}
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(EnhancedFeedForYou);
