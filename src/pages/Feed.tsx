
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
import { CreatePostButton } from '@/components/feed/CreatePostButton';
import { Bell, Search, RefreshCw, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Toaster } from '@/components/ui/toaster';
import { ScrollArea } from '@/components/ui/scroll-area';

const Feed = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState("for-you");
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [pullIntent, setPullIntent] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [startY, setStartY] = useState(0);
  const [newContentAvailable, setNewContentAvailable] = useState(false);
  const [newPostCount, setNewPostCount] = useState(0);
  const [showNewPosts, setShowNewPosts] = useState(false);
  const [hasScrolledDown, setHasScrolledDown] = useState(false);
  const lastScrollTop = useRef(0);
  const pullThreshold = 80; // Pixels needed to pull down to trigger refresh
  const startThreshold = 10; // Minimum drag distance before showing pull UI
  const lastUpdateTime = useRef(0);
  const frameId = useRef(0);
  
  const getInitialActiveTab = () => {
    if (location.pathname === '/home' || location.pathname === '/feed') {
      return 'Home';
    }
    return 'Home';
  };

  // Check for scroll direction
  useEffect(() => {
    const handleScroll = () => {
      const st = window.scrollY;
      
      // Detect if user has scrolled down at all
      if (st > 50) {
        setHasScrolledDown(true);
      }
      
      // Show button when scrolling up and new posts available
      if (st < lastScrollTop.current && newContentAvailable && hasScrolledDown) {
        setShowNewPosts(true);
      } else if (st > lastScrollTop.current + 50) {
        // Hide when scrolling down significantly
        setShowNewPosts(false);
      }
      
      lastScrollTop.current = st <= 0 ? 0 : st;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [newContentAvailable, hasScrolledDown]);

  const checkForNewContent = useCallback(() => {
    // In a real implementation, this would check the API for new content
    // For now, we'll simulate new content being available randomly
    const hasNewContent = Math.random() > 0.5;
    if (hasNewContent && !newContentAvailable) {
      setNewContentAvailable(true);
      setNewPostCount(Math.floor(Math.random() * 5) + 1); // Random number of new posts (1-5)
    }
  }, [newContentAvailable]);

  // Set up automatic refresh interval
  useEffect(() => {
    const interval = setInterval(() => {
      checkForNewContent();
    }, 3 * 60 * 1000); // Check every 3 minutes
    
    return () => clearInterval(interval);
  }, [checkForNewContent]);

  const handleRefresh = useCallback(() => {
    if (refreshing) return; // Prevent multiple refreshes
    
    setRefreshing(true);
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
    
    // Provide haptic feedback on supported devices
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    // Simulate network delay
    setTimeout(() => {
      setRefreshing(false);
      // Scroll to top after refresh
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 1000);
  }, [activeTab, refreshing]);
  
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
    if (activeTab === "for-you") {
      const event = new CustomEvent('refresh-for-you-feed');
      window.dispatchEvent(event);
    } else {
      const event = new CustomEvent('refresh-following-feed');
      window.dispatchEvent(event);
    }
  };

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
      {/* Mobile Header - Fixed Position */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
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
      )}
      
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
        {/* Left Sidebar - Only visible on desktop */}
        {!isMobile && (
          <VerticalTubelightNavbar 
            initialActiveTab={getInitialActiveTab()}
            className="fixed left-0 top-0 h-screen pt-4 pl-4" 
          />
        )}
        
        <div className={cn(
          "flex-1 flex flex-col",
          !isMobile && "md:ml-16 lg:ml-64", // Account for collapsed and expanded sidebar
          isMobile && "pt-16" // Account for mobile header
        )}>
          {/* Main Content Area - Three Column Layout on Desktop */}
          <div className={cn(
            "w-full mx-auto grid justify-center",
            !isMobile && "grid-cols-1 lg:grid-cols-7 xl:grid-cols-7 gap-4 px-4 py-6"
          )}>
            {/* Left Column for Navigation on Smaller Desktop */}
            {!isMobile && (
              <div className="hidden lg:block col-span-1">
                {/* This is just a spacer since VerticalTubelightNavbar is fixed */}
              </div>
            )}
            
            {/* Middle Column - Feed Content */}
            <div className={cn(
              "col-span-1 lg:col-span-4 xl:col-span-4 max-w-2xl w-full mx-auto",
              isMobile && "px-0" // Full width on mobile
            )}>
              {/* Feed Header - Part of normal document flow */}
              <div className="px-4 py-6 md:py-4 mb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-bold">Home</h1>
                    <p className="text-muted-foreground">Your personalized feed</p>
                  </div>
                  
                  <CreatePostButton onPostCreated={handlePostCreated} />
                </div>
              </div>
              
              {/* Feed Tabs - Part of normal document flow */}
              <div className="w-full">
                <div className="flex items-center w-full text-muted-foreground bg-background border-b">
                  <div 
                    onClick={() => setActiveTab("for-you")} 
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
                    onClick={() => setActiveTab("following")} 
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
                      className={cn(
                        "sticky z-30 py-2 px-4 flex justify-center",
                        isMobile ? "top-16" : "top-0" // Position below mobile header when on mobile
                      )}
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
                        <RefreshCw size={14} />
                        <span>
                          {newPostCount > 1 ? `${newPostCount} New Posts` : "New Posts"}
                        </span>
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
            {!isMobile && (
              <div className="hidden lg:block col-span-2 xl:col-span-2">
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
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Bottom Navigation */}
      {isMobile && <BottomNavigation />}
      <Toaster />
    </div>
  );
};

export default Feed;
