
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NavBarComponent from '@/components/NavBarComponent';
import FeedForYou from '@/components/feed/FeedForYou';
import FeedFollowing from '@/components/feed/FeedFollowing';
import { SidebarNavigation } from '@/components/navigation/SidebarNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

const Feed = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      
      <div className="flex flex-1">
        {!isMobile && <SidebarNavigation />}
        
        <div className={cn(
          "flex-1 max-w-4xl mx-auto px-4 py-6 md:px-6", 
          isMobile ? "pt-20" : "pt-16 md:ml-64"
        )}>
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Feed</h1>
            <p className="text-muted-foreground">Discover recommendations from the community</p>
          </div>
          
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertTitle>Development Mode</AlertTitle>
            <AlertDescription>
              This feed is displaying recommendations using a fallback approach. 
              Some features might be limited.
            </AlertDescription>
          </Alert>
          
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
