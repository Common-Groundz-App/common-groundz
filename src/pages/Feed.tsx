import React, { useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocation } from 'react-router-dom';
import { cn } from "@/lib/utils";
import Logo from '@/components/Logo';
import { Home, Star, Search, User } from "lucide-react";
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import FeedForYou from '@/components/feed/FeedForYou';
import FeedFollowing from '@/components/feed/FeedFollowing';
import { motion } from 'framer-motion';
import { CreatePostButton } from '@/components/feed/CreatePostButton';
import { Glow } from '@/components/ui/glow';

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
    <div className="min-h-screen flex flex-col bg-background">
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
          <div className="w-full max-w-4xl mx-auto">
            <div className="px-5 py-6 md:py-8">
              <div className="flex justify-between items-center">
                <div className="text-left">
                  <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-brand-orange to-brand-blue bg-clip-text text-transparent">Feed</h1>
                  <p className="text-muted-foreground text-sm md:text-base">Discover recommendations from the community</p>
                </div>
                
                <CreatePostButton onPostCreated={handlePostCreated} />
              </div>
            </div>
            
            <div className="w-full">
              <div className="flex items-center w-full text-muted-foreground border-b relative">
                <div 
                  onClick={() => setActiveTab("for-you")} 
                  className={cn(
                    "relative cursor-pointer font-semibold px-6 py-3 transition-colors w-1/2 text-center",
                    activeTab === "for-you" ? "text-brand-orange" : "hover:text-primary"
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
                      <div className="absolute top-0 left-0 right-0 h-[3px] bg-brand-orange">
                        <div className="absolute -top-1 left-0 right-0 h-4 bg-gradient-to-b from-brand-orange/50 to-transparent blur-md" />
                        <div className="absolute -top-3 left-1/4 right-1/4 h-6 bg-brand-orange/30 rounded-full blur-lg" />
                      </div>
                      
                      <div className="absolute h-full w-full bg-brand-orange/5 rounded-md" />
                    </motion.div>
                  )}
                </div>
                
                <div 
                  onClick={() => setActiveTab("following")} 
                  className={cn(
                    "relative cursor-pointer font-semibold px-6 py-3 transition-colors w-1/2 text-center",
                    activeTab === "following" ? "text-brand-orange" : "hover:text-primary"
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
                      <div className="absolute top-0 left-0 right-0 h-[3px] bg-brand-orange">
                        <div className="absolute -top-1 left-0 right-0 h-4 bg-gradient-to-b from-brand-orange/50 to-transparent blur-md" />
                        <div className="absolute -top-3 left-1/4 right-1/4 h-6 bg-brand-orange/30 rounded-full blur-lg" />
                      </div>
                      
                      <div className="absolute h-full w-full bg-brand-orange/5 rounded-md" />
                    </motion.div>
                  )}
                </div>
              </div>
              
              <div className="px-5 py-6">
                <div className="animate-fade-in">
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
      </div>
      
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default Feed;
