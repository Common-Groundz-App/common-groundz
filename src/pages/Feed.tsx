
import React, { useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocation } from 'react-router-dom';
import { cn } from "@/lib/utils";
import Logo from '@/components/Logo';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import FeedForYou from '@/components/feed/FeedForYou';
import FeedFollowing from '@/components/feed/FeedFollowing';
import { motion } from 'framer-motion';
import { CreatePostButton } from '@/components/feed/CreatePostButton';
import { Bell, Heart, Bookmark, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { FixedWidthLayout } from '@/components/layout/FixedWidthLayout';

// Define CSS variables for consistent column widths
const SIDEBAR_WIDTH = "275px";
const CONTENT_WIDTH = "600px";
const RIGHT_COLUMN_WIDTH = "350px";

const Feed = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState("for-you");
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  
  const getInitialActiveTab = () => {
    if (location.pathname === '/home' || location.pathname === '/feed') {
      return 'Home';
    }
    return 'Home';
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
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Mobile Header */}
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
      
      <FixedWidthLayout className="flex-1">
        <div className="flex flex-1">
          {/* Left Sidebar - Only visible on desktop */}
          {!isMobile && (
            <VerticalTubelightNavbar 
              initialActiveTab={getInitialActiveTab()}
              className="fixed left-1/2 -translate-x-[calc(50%+275px/2+300px)] top-0 h-screen pt-4 w-[275px]" 
            />
          )}
          
          <div className={cn(
            "flex-1 flex flex-col",
            !isMobile && "md:ml-[84px] lg:ml-[275px]", // Account for collapsed and expanded sidebar
            isMobile && "pt-16" // Account for mobile header
          )}>
            {/* Main Content Area - Fixed Width Layout */}
            <div className="flex w-full">
              {/* Middle Column - Feed Content */}
              <div className={cn(
                "w-full md:w-[600px] border-x",
                isMobile && "px-0" // Full width on mobile
              )}>
                {/* Feed Header */}
                <div className="px-4 py-6 md:py-4 mb-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <h1 className="text-2xl font-bold">Home</h1>
                      <p className="text-muted-foreground">Your personalized feed</p>
                    </div>
                    
                    <CreatePostButton onPostCreated={handlePostCreated} />
                  </div>
                </div>
                
                {/* Feed Tabs */}
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
                  
                  {/* Feed Content */}
                  <div className="px-4">
                    {activeTab === "for-you" ? (
                      <FeedForYou />
                    ) : (
                      <FeedFollowing />
                    )}
                  </div>
                </div>
              </div>
              
              {/* Right Column - Trending & Recommendations - Desktop Only */}
              {!isMobile && (
                <div className="hidden lg:block w-[350px] pl-6">
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
      </FixedWidthLayout>
      
      {/* Mobile Bottom Navigation */}
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default Feed;
