
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NavBarComponent from '@/components/NavBarComponent';
import FeedForYou from '@/components/feed/FeedForYou';
import FeedFollowing from '@/components/feed/FeedFollowing';
import { SidebarNavigation } from '@/components/navigation/SidebarNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const Feed = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      
      <div className="flex flex-1 pt-16">
        {!isMobile && (
          <div className="w-64 fixed left-0 top-16 bottom-0 border-r border-border">
            <SidebarNavigation />
          </div>
        )}
        
        <div className={`flex-1 ${!isMobile ? 'ml-64' : ''} max-w-4xl mx-auto px-4 py-6 md:px-6`}>
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Feed</h1>
            <p className="text-muted-foreground">Discover recommendations from the community</p>
          </div>
          
          <Tabs defaultValue="for-you" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
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
      
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default Feed;
