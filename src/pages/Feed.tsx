import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw, Plus } from 'lucide-react';
import FeedForYou from '@/components/feed/FeedForYou';
import FeedFollowing from '@/components/feed/FeedFollowing';
import CreatePostButton from '@/components/feed/CreatePostButton';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { feedbackActions } from '@/services/feedbackService';

const Feed = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('for-you');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      
      // Trigger haptic and sound feedback for refresh
      feedbackActions.refresh();
      
      // Dispatch refresh events for both feed types
      window.dispatchEvent(new CustomEvent('refresh-for-you-feed'));
      window.dispatchEvent(new CustomEvent('refresh-following-feed'));
      
      // Keep refreshing state for a minimum time for better UX
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    } catch (error) {
      console.error('Error refreshing feed:', error);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const handleGlobalRefresh = () => {
      handleRefresh();
    };

    window.addEventListener('refresh-feed', handleGlobalRefresh);
    return () => {
      window.removeEventListener('refresh-feed', handleGlobalRefresh);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Feed</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                "transition-transform",
                isRefreshing && "animate-spin"
              )}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {user && (
              <CreatePostButton>
                <Button size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </CreatePostButton>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="for-you">For You</TabsTrigger>
            <TabsTrigger value="following">Following</TabsTrigger>
          </TabsList>
          
          <TabsContent value="for-you" className="mt-0">
            <FeedForYou refreshing={isRefreshing} />
          </TabsContent>
          
          <TabsContent value="following" className="mt-0">
            <FeedFollowing refreshing={isRefreshing} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Feed;
