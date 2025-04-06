
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import Footer from '@/components/Footer';
import FeedForYou from '@/components/feed/FeedForYou';
import FeedFollowing from '@/components/feed/FeedFollowing';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { Home, Star, Search, User } from "lucide-react";
import { useLocation } from 'react-router-dom';
import { cn } from "@/lib/utils";
import Logo from '@/components/Logo';

const Feed = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  
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
            
            <Tabs defaultValue="for-you" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8">
                <TabsTrigger value="for-you">For You</TabsTrigger>
                <TabsTrigger value="following">Following</TabsTrigger>
              </TabsList>
              
              <TabsContent value="for-you">
                <FeedForYou />
              </TabsContent>
              
              <TabsContent value="following">
                <FeedFollowing />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default Feed;
