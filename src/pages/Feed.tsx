
import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocation } from 'react-router-dom';
import { cn } from "@/lib/utils";
import Logo from '@/components/Logo';
import { Home, Star, Search, User } from "lucide-react";
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import Footer from '@/components/Footer';
import FeedForYou from '@/components/feed/FeedForYou';
import FeedFollowing from '@/components/feed/FeedFollowing';
import { motion } from 'framer-motion';

const Feed = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState("for-you");
  
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Feed', url: '/feed', icon: Star },
    { name: 'Search', url: '#', icon: Search, onClick: () => {
      // Open the search dialog
      const event = new CustomEvent('open-search-dialog');
      window.dispatchEvent(event);
    }},
    { name: 'Profile', url: '/profile', icon: User }
  ];
  
  // Determine active tab based on current route
  const getInitialActiveTab = () => {
    if (location.pathname === '/feed') {
      return 'Feed';
    }
    return 'Home';
  };
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Mobile header - only shown when width < 768px */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
          <div className="container p-3 mx-auto flex justify-start">
            <Logo size="sm" />
          </div>
        </div>
      )}
      
      {/* Only show the vertical navbar on non-mobile screens */}
      <div className="flex flex-1">
        {!isMobile && (
          <VerticalTubelightNavbar 
            items={navItems} 
            initialActiveTab={getInitialActiveTab()}
            className="fixed left-0 top-0 h-screen pt-4" 
          />
        )}
        
        <div className={cn(
          "flex-1 px-4 py-6 md:py-8", 
          !isMobile && "md:ml-64", // Add margin when sidebar is visible
          isMobile && "pt-16" // Add padding when mobile header is visible
        )}>
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Feed</h1>
              <p className="text-muted-foreground">Discover recommendations from the community</p>
            </div>
            
            {/* Custom tabs with glow effect similar to sidebar */}
            <div className="w-full mb-8">
              <div className="inline-flex items-center justify-center gap-2 py-1 px-1 rounded-full bg-muted p-1 text-muted-foreground">
                {/* For You Tab */}
                <div 
                  onClick={() => setActiveTab("for-you")} 
                  className={cn(
                    "relative cursor-pointer text-sm font-semibold px-6 py-2 rounded-full transition-colors w-1/2 text-center",
                    "text-foreground/80 hover:text-primary", 
                    activeTab === "for-you" && "bg-muted text-primary"
                  )}
                >
                  <span>For You</span>
                  {activeTab === "for-you" && (
                    <motion.div
                      layoutId="feed-tab-indicator"
                      className="absolute inset-0 w-full bg-primary/10 rounded-full -z-10"
                      initial={false}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30
                      }}
                    >
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand-orange rounded-t-full">
                        <div className="absolute w-12 h-6 bg-brand-orange/20 rounded-full blur-md -top-2 -left-2" />
                        <div className="absolute w-8 h-6 bg-brand-orange/20 rounded-full blur-md -top-1" />
                        <div className="absolute w-4 h-4 bg-brand-orange/20 rounded-full blur-sm top-0 left-2" />
                      </div>
                    </motion.div>
                  )}
                </div>
                
                {/* Following Tab */}
                <div 
                  onClick={() => setActiveTab("following")} 
                  className={cn(
                    "relative cursor-pointer text-sm font-semibold px-6 py-2 rounded-full transition-colors w-1/2 text-center",
                    "text-foreground/80 hover:text-primary", 
                    activeTab === "following" && "bg-muted text-primary"
                  )}
                >
                  <span>Following</span>
                  {activeTab === "following" && (
                    <motion.div
                      layoutId="feed-tab-indicator"
                      className="absolute inset-0 w-full bg-primary/10 rounded-full -z-10"
                      initial={false}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30
                      }}
                    >
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand-orange rounded-t-full">
                        <div className="absolute w-12 h-6 bg-brand-orange/20 rounded-full blur-md -top-2 -left-2" />
                        <div className="absolute w-8 h-6 bg-brand-orange/20 rounded-full blur-md -top-1" />
                        <div className="absolute w-4 h-4 bg-brand-orange/20 rounded-full blur-sm top-0 left-2" />
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
              
              {/* Content based on active tab */}
              <div className="mt-6">
                {activeTab === "for-you" ? (
                  <FeedForYou />
                ) : (
                  <FeedFollowing />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default Feed;
