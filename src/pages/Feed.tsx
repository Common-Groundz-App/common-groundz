
import React, { useState, useEffect } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { PillTabs } from '@/components/ui/pill-tabs';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InfiniteFeedForYou from '@/components/feed/InfiniteFeedForYou';
import InfiniteFeedFollowing from '@/components/feed/InfiniteFeedFollowing';
import { useAuth } from '@/contexts/AuthContext';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

const Feed = () => {
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('for-you');
  const [refreshing, setRefreshing] = useState(false);
  const { startRender, endRender } = usePerformanceMonitor('Feed');

  useEffect(() => {
    startRender();
    return () => endRender();
  }, [startRender, endRender]);

  // Get the tab from URL params if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'following') {
      setActiveTab('following');
    } else {
      setActiveTab('for-you');
    }
  }, [location.search]);

  // Redirect to auth if not authenticated and not loading
  if (!isLoading && !user) {
    return <Navigate to="/auth" replace />;
  }

  const handleRefresh = () => {
    setRefreshing(true);
    
    // Dispatch refresh events
    if (activeTab === 'for-you') {
      window.dispatchEvent(new CustomEvent('refresh-for-you-feed'));
    } else {
      window.dispatchEvent(new CustomEvent('refresh-following-feed'));
    }
    
    // Reset refreshing state after animation
    setTimeout(() => setRefreshing(false), 2000);
  };

  const tabItems = [
    { 
      value: 'for-you', 
      label: 'For You',
      emoji: '🔥'
    },
    { 
      value: 'following', 
      label: 'Following',
      emoji: '👥'
    }
  ];

  const renderTabContent = () => {
    if (activeTab === 'for-you') {
      return <InfiniteFeedForYou refreshing={refreshing} />;
    } else {
      return <InfiniteFeedFollowing refreshing={refreshing} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Feed</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        <PillTabs
          items={tabItems}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        
        <div className="mt-6">
          {renderTabContent()}
        </div>
      </div>
      
      <Footer />
      
      {/* Mobile Bottom Navigation */}
      <div className="xl:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
};

export default Feed;
