import React, { useEffect } from 'react';
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
import { CreatePostButton } from '@/components/feed/CreatePostButton';

const Feed = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState("for-you");
  
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Feed', url: '/feed', icon: Star },
    { name: 'Search', url: '#', icon: Search, onClick: () => {
      const event = new CustomEvent('open-search-dialog');
      window.dispatchEvent(event);
    }},
    { name: 'Profile', url: '/profile', icon: User }
  ];
  
  const getInitialActiveTab = () => {
    if (location.pathname === '/feed') {
      return 'Feed';
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
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
          <div className="container p-3 mx-auto flex justify-start">
            <Logo size="sm" />
          </div>
        </div>
      )}
      
      <div className="flex flex-1">
        {!isMobile && (
          <VerticalTubelightNavbar 
            items={navItems} 
            initialActiveTab={getInitialActiveTab()}
            className="fixed left-0 top-0 h-screen pt-4" 
          />
        )}
        
        <div className={cn(
          "flex-1 flex flex-col", 
          !isMobile && "md:ml-64",
          isMobile && "pt-16"
        )}>
          <div className="max-w-4xl mx-auto w-full">
            <div className="px-4 py-6 md:py-8 mb-2">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold">Feed</h1>
                  <p className="text-muted-foreground">Discover recommendations from the community</p>
                </div>
                
                <CreatePostButton onPostCreated={handlePostCreated} />
              </div>
            </div>
            
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
              
              <div className="px-4 mt-6">
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
