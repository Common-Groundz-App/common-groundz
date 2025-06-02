import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocation } from 'react-router-dom';
import { cn } from "@/lib/utils";
import Logo from '@/components/Logo';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import FeedForYou from '@/components/feed/FeedForYou';
import FeedFollowing from '@/components/feed/FeedFollowing';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartComposerButton } from '@/components/feed/SmartComposerButton';
import { Bell, Search, ChevronDown, ArrowUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Toaster } from '@/components/ui/toaster';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { checkForNewContent, getLastRefreshTime, setLastRefreshTime, NewContentCheckResult } from '@/services/feedContentService';
import { feedbackActions } from '@/services/feedbackService';

const Feed = React.memo(() => {
  const { user, isLoading } = useAuth();

  console.log('🍽️ [Feed] Rendering - isLoading:', isLoading, 'user:', user ? 'authenticated' : 'not authenticated');

  // CRITICAL: Don't render complex feed logic until auth is ready
  if (isLoading) {
    console.log('⏳ [Feed] Auth still loading, showing spinner...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Loading feed...</p>
        </div>
      </div>
    );
  }

  // Redirect unauthenticated users - this should be handled by routing but adding as safeguard
  if (!user) {
    console.log('🔀 [Feed] No user, this should not happen in /home route');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Authentication required</p>
        </div>
      </div>
    );
  }

  console.log('✅ [Feed] Auth ready, rendering feed content...');

  // Keep useIsMobile only for logic, not layout rendering
  const isMobile = useIsMobile();
  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState("for-you");
  const { unreadCount } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [pullIntent, setPullIntent] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [startY, setStartY] = useState(0);
  
  // New content detection state
  const [newContentAvailable, setNewContentAvailable] = useState(false);
  const [newPostCount, setNewPostCount] = useState(0);
  const [hasScrolledDown, setHasScrolledDown] = useState(false);
  const [showNewPosts, setShowNewPosts] = useState(false);
  
  // Add missing refs
  const lastScrollTop = useRef(0);
  const frameId = useRef(0);
  const lastUpdateTime = useRef(0);
  const contentCheckInterval = useRef<NodeJS.Timeout>();
  
  // Add missing constants
  const pullThreshold = 80;
  const startThreshold = 10;
  const contentCheckIntervalMs = 3 * 60 * 1000; // 3 minutes
  
  const getInitialActiveTab = () => {
    if (location.pathname === '/home' || location.pathname === '/feed') {
      return 'Home';
    }
    return 'Home';
  };

  // Real content detection function
  const checkForNewContentPeriodically = useCallback(async () => {
    if (!user) return;
    
    try {
      const lastRefreshTime = getLastRefreshTime(activeTab, user.id);
      const result = await checkForNewContent(activeTab as 'for_you' | 'following', user.id, lastRefreshTime);
      
      if (result.hasNewContent && !newContentAvailable) {
        setNewContentAvailable(true);
        setNewPostCount(result.newItemCount);
        console.log(`🆕 Found ${result.newItemCount} new items for ${activeTab} feed`);
      }
    } catch (error) {
      console.error('Error checking for new content:', error);
    }
  }, [user, activeTab, newContentAvailable]);

  // Set up periodic content checking
  useEffect(() => {
    if (!user) return;
    
    // Check immediately
    checkForNewContentPeriodically();
    
    // Set up interval
    contentCheckInterval.current = setInterval(checkForNewContentPeriodically, contentCheckIntervalMs);
    
    return () => {
      if (contentCheckInterval.current) {
        clearInterval(contentCheckInterval.current);
      }
    };
  }, [user, activeTab, checkForNewContentPeriodically]);

  // Check for scroll direction and show/hide new posts button
  useEffect(() => {
    const handleScroll = () => {
      const st = window.scrollY;
      
      // Detect if user has scrolled down at all
      if (st > 100) {
        setHasScrolledDown(true);
      }
      
      // Show button when scrolling up and new posts available
      if (st < lastScrollTop.current && newContentAvailable && hasScrolledDown) {
        setShowNewPosts(true);
      } else if (st > lastScrollTop.current + 50) {
        // Hide when scrolling down significantly
        setShowNewPosts(false);
      }
      
      // Hide when at top
      if (st <= 50) {
        setShowNewPosts(false);
      }
      
      lastScrollTop.current = st <= 0 ? 0 : st;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [newContentAvailable, hasScrolledDown]);

  const handleRefresh = useCallback(() => {
    if (refreshing) return; // Prevent multiple refreshes
    
    // Trigger feedback for refresh action
    feedbackActions.refresh();
    
    // Use requestAnimationFrame to ensure scroll happens after DOM updates
    requestAnimationFrame(() => {
      // Account for mobile header - scroll to 64px on mobile (pt-16 = 4rem = 64px) and 0 on desktop
      const scrollTop = window.innerWidth < 1280 ? 64 : 0; // xl breakpoint is 1280px
      window.scrollTo({ top: scrollTop, behavior: 'smooth' });
    });
    
    setRefreshing(true);
    setNewContentAvailable(false);
    setShowNewPosts(false);
    setNewPostCount(0);
    
    // Update last refresh time
    if (user) {
      setLastRefreshTime(activeTab, user.id);
    }
    
    // Trigger refresh event
    if (activeTab === "for-you") {
      const event = new CustomEvent('refresh-for-you-feed');
      window.dispatchEvent(event);
    } else {
      const event = new CustomEvent('refresh-following-feed');
      window.dispatchEvent(event);
    }
    
    // Auto-hide refreshing state after reasonable time
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, [activeTab, refreshing, user]);

  // Check if we're at the top of the window
  const isScrollAtTop = useCallback(() => {
    return window.scrollY <= 1;
  }, []);

  // Throttle function to limit update frequency
  const throttlePullProgress = (progress: number) => {
    const now = Date.now();
    if (now - lastUpdateTime.current > 16) { // ~60fps
      lastUpdateTime.current = now;
      setPullProgress(progress);
    }
  };

  // Handle touch/mouse start event with improved intent detection
  const handleTouchStart = (e: TouchEvent | MouseEvent) => {
    // Ignore if already refreshing
    if (refreshing) return;
    
    // For mouse events, only track if left button is pressed
    if ('buttons' in e && e.buttons !== 1) return;
    
    if (isScrollAtTop()) {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setStartY(clientY);
      setIsActive(true);
      setPullIntent(false); // Reset pull intent
      
      // Cancel any existing animation frame
      if (frameId.current) {
        cancelAnimationFrame(frameId.current);
      }
    }
  };

  // Handle touch/mouse move with animation frame for smoother updates
  const handleTouchMove = (e: TouchEvent | MouseEvent) => {
    // If not active or already refreshing, ignore
    if (!isActive || refreshing) return;
    
    // For mouse events, check if left button is still pressed
    if ('buttons' in e && e.buttons !== 1) {
      handleTouchEnd();
      return;
    }
    
    // If scroll is not at top anymore, cancel pull
    if (!isScrollAtTop()) {
      setPullProgress(0);
      setIsActive(false);
      return;
    }
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const diff = clientY - startY;
    
    // Only start showing pull UI after exceeding minimum threshold
    if (diff > startThreshold) {
      setPullIntent(true);
      const progress = Math.min(diff * 0.5, pullThreshold);
      
      // Use requestAnimationFrame for smoother updates
      if (frameId.current) {
        cancelAnimationFrame(frameId.current);
      }
      
      frameId.current = requestAnimationFrame(() => {
        throttlePullProgress(progress);
      });
    } else {
      setPullIntent(false);
      setPullProgress(0);
    }
  };

  const handleTouchEnd = () => {
    // Cancel any existing animation frame
    if (frameId.current) {
      cancelAnimationFrame(frameId.current);
      frameId.current = 0;
    }
    
    // Only trigger refresh if we had pull intent and exceeded threshold
    if (pullIntent && pullProgress >= pullThreshold) {
      handleRefresh();
    }
    
    // Reset states
    setIsActive(false);
    setPullIntent(false);
    setPullProgress(0);
  };

  const handlePostCreated = () => {
    // Trigger feedback for post creation
    feedbackActions.post();
    
    // Reset new content state and refresh
    setNewContentAvailable(false);
    setShowNewPosts(false);
    setNewPostCount(0);
    
    if (activeTab === "for-you") {
      const event = new CustomEvent('refresh-for-you-feed');
      window.dispatchEvent(event);
    } else {
      const event = new CustomEvent('refresh-following-feed');
      window.dispatchEvent(event);
    }
  };

  // Handle tab change - reset new content state
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setNewContentAvailable(false);
    setShowNewPosts(false);
    setNewPostCount(0);
    setHasScrolledDown(false);
  }, []);

  // Attach pull-to-refresh handlers at document level
  useEffect(() => {
    // Add event listeners to document instead of a specific div
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    
    document.addEventListener('mousedown', handleTouchStart);
    document.addEventListener('mousemove', handleTouchMove);
    document.addEventListener('mouseup', handleTouchEnd);
    document.addEventListener('mouseleave', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      
      document.removeEventListener('mousedown', handleTouchStart);
      document.removeEventListener('mousemove', handleTouchMove);
      document.removeEventListener('mouseup', handleTouchEnd);
      document.removeEventListener('mouseleave', handleTouchEnd);
    };
  }, [refreshing, isActive, startY, pullIntent, pullProgress]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Mobile Header - Only show on mobile screens */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
        <div className="container p-3 mx-auto flex justify-between items-center">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const event = new CustomEvent('open-search-dialog');
                window.dispatchEvent(event);
              }}
              className="p-2 rounded-full hover:bg-accent"
            >
              <Search size={20} />
            </button>
            {user && (
              <button
                onClick={() => {
                  const event = new CustomEvent('open-notifications');
                  window.dispatchEvent(event);
                }}
                className="p-2 rounded-full hover:bg-accent relative"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Pull-to-Refresh Indicator - Fixed at top of viewport */}
      <AnimatePresence>
        {pullIntent && (
          <motion.div 
            className="fixed top-0 left-0 right-0 z-50 flex justify-center items-center overflow-hidden bg-background/70 backdrop-blur-sm"
            initial={{ height: 0 }}
            animate={{ height: pullProgress }}
            exit={{ height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <motion.div
                animate={{
                  rotate: pullProgress >= pullThreshold ? 180 : (pullProgress / pullThreshold) * 180,
                  scale: pullProgress >= pullThreshold ? 1.2 : 1,
                }}
                transition={{ type: "spring" }}
              >
                <ChevronDown 
                  size={24} 
                  className={cn(
                    "text-brand-orange transition-transform",
                    pullProgress >= pullThreshold ? "text-brand-orange" : "text-muted-foreground"
                  )}
                />
              </motion.div>
              <motion.span 
                className={cn(
                  "text-sm mt-1 font-medium",
                  pullProgress >= pullThreshold ? "text-brand-orange" : "text-muted-foreground"
                )}
              >
                {pullProgress >= pullThreshold ? "Release to refresh" : "Pull down to refresh"}
              </motion.span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="flex flex-1">
        {/* Desktop Sidebar - Only show on xl+ screens */}
        <div className="hidden xl:block">
          <VerticalTubelightNavbar 
            initialActiveTab={getInitialActiveTab()}
            className="fixed left-0 top-0 h-screen pt-4 pl-4" 
          />
        </div>
        
        <div className="flex-1 flex flex-col pt-16 xl:pt-0 xl:ml-64">
          {/* Main Content Area - Three Column Layout on Desktop */}
          <div className="w-full mx-auto grid justify-center xl:grid-cols-7 gap-4 px-4 py-6">
            {/* Left Column for Navigation on Smaller Desktop */}
            <div className="hidden xl:block col-span-1">
              {/* This is just a spacer since VerticalTubelightNavbar is fixed */}
            </div>
            
            {/* Middle Column - Feed Content */}
            <div className="col-span-1 xl:col-span-4 max-w-2xl w-full mx-auto px-0 xl:px-4">
              {/* Feed Header - Part of normal document flow */}
              <div className="px-4 py-6 md:py-4 mb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-bold">Home</h1>
                    <p className="text-muted-foreground">Your personalized feed</p>
                  </div>
                  
                  <SmartComposerButton onContentCreated={handlePostCreated} />
                </div>
              </div>
              
              {/* Feed Tabs - Part of normal document flow */}
              <div className="w-full">
                <div className="flex items-center w-full text-muted-foreground bg-background border-b">
                  <div 
                    onClick={() => handleTabChange("for-you")} 
                    className={cn(
                      "relative cursor-pointer font-semibold px-6 py-3 transition-colors w-1/2 text-center",
                      activeTab === "for-you" ? "text-primary" : "hover:text-primary"
                    )}
                  >
                    <span className="text-lg">For You</span>
                    {activeTab === "for-you" && (
                      <motion.div
                        layoutId="feed-tab-indicator"
                        className="absolute inset-0 -z-10"
                        initial={false}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 30
                        }}
                      >
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand-orange rounded-t-full">
                          <div className="absolute w-12 h-6 bg-brand-orange/20 rounded-full blur-md -top-2 -left-2" />
                          <div className="absolute w-8 h-6 bg-brand-orange/20 rounded-full blur-md -top-1" />
                          <div className="absolute w-4 h-4 bg-brand-orange/20 rounded-full blur-sm top-0 left-2" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                  
                  <div 
                    onClick={() => handleTabChange("following")} 
                    className={cn(
                      "relative cursor-pointer font-semibold px-6 py-3 transition-colors w-1/2 text-center",
                      activeTab === "following" ? "text-primary" : "hover:text-primary"
                    )}
                  >
                    <span className="text-lg">Following</span>
                    {activeTab === "following" && (
                      <motion.div
                        layoutId="feed-tab-indicator"
                        className="absolute inset-0 -z-10"
                        initial={false}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 30
                        }}
                      >
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand-orange rounded-t-full">
                          <div className="absolute w-12 h-6 bg-brand-orange/20 rounded-full blur-md -top-2 -left-2" />
                          <div className="absolute w-8 h-6 bg-brand-orange/20 rounded-full blur-md -top-1" />
                          <div className="absolute w-4 h-4 bg-brand-orange/20 rounded-full blur-sm top-0 left-2" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
                
                {/* New Posts Button - Fixed position with improved design */}
                <AnimatePresence>
                  {showNewPosts && newContentAvailable && (
                    <motion.div 
                      className="sticky z-30 py-2 px-4 flex justify-center top-16 xl:top-0"
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    >
                      <motion.button
                        onClick={handleRefresh}
                        className="bg-brand-orange text-white py-1.5 px-4 rounded-full font-medium flex items-center justify-center gap-2 shadow-sm hover:bg-brand-orange/90 transition-colors"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <ArrowUp size={14} />
                        <span>{newPostCount > 9 ? '9+' : newPostCount} New Post{(newPostCount > 9 || newPostCount !== 1) ? 's' : ''}</span>
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Feed Content - No overflow or height constraints */}
                <div className="px-4">
                  {activeTab === "for-you" ? (
                    <FeedForYou refreshing={refreshing} />
                  ) : (
                    <FeedFollowing refreshing={refreshing} />
                  )}
                </div>
              </div>
            </div>
            
            {/* Right Column - Trending & Recommendations - Desktop Only */}
            <div className="hidden xl:block col-span-2">
              <div className="sticky top-4 space-y-4">
                {/* Search */}
                <div className="bg-background rounded-xl border p-4">
                  <button 
                    onClick={() => {
                      const event = new CustomEvent('open-search-dialog');
                      window.dispatchEvent(event);
                    }}
                    className="flex items-center w-full gap-2 text-muted-foreground rounded-md border px-3 py-2 hover:bg-accent transition-colors"
                  >
                    <Search size={18} />
                    <span>Search...</span>
                  </button>
                </div>

                {/* Trending Topics */}
                <div className="bg-background rounded-xl border p-4">
                  <h3 className="font-semibold text-lg mb-3">Trending Topics</h3>
                  <div className="space-y-3">
                    {["Photography", "Technology", "Travel", "Art", "Food"].map((topic, i) => (
                      <div key={topic} className="flex justify-between items-center group cursor-pointer hover:bg-accent/20 -mx-2 px-2 py-1 rounded-md">
                        <div>
                          <div className="text-xs text-muted-foreground">Trending #{i + 1}</div>
                          <div className="font-medium">{topic}</div>
                          <div className="text-xs text-muted-foreground">{200 - i * 30}+ posts</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Who to Follow */}
                <div className="bg-background rounded-xl border p-4">
                  <h3 className="font-semibold text-lg mb-3">Who to Follow</h3>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-xs">User</span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">User Name {i}</div>
                            <div className="text-xs text-muted-foreground">@username{i}</div>
                          </div>
                        </div>
                        <button className="text-xs bg-primary text-primary-foreground rounded-full px-3 py-1 hover:bg-primary/90 transition-colors">
                          Follow
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Bottom Navigation - Only show on mobile screens */}
      <div className="xl:hidden">
        <BottomNavigation />
      </div>
      <Toaster />
    </div>
  );
});

Feed.displayName = 'Feed';

export default Feed;
