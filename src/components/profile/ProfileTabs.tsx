
import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ProfileRecommendations from './ProfileRecommendations';

const ProfileTabs = () => {
  return (
    <Tabs defaultValue="recommendations" className="w-full">
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-1">
        <TabsList className="border-b w-full rounded-none bg-transparent p-0 h-auto overflow-x-auto">
          <TabsTrigger 
            value="recommendations"
            className="rounded-none border-b-2 border-transparent px-4 md:px-6 py-3 font-medium data-[state=active]:border-brand-orange data-[state=active]:text-black"
          >
            Recommendations
          </TabsTrigger>
          <TabsTrigger 
            value="circles"
            className="rounded-none border-b-2 border-transparent px-4 md:px-6 py-3 font-medium data-[state=active]:border-brand-orange data-[state=active]:text-black"
          >
            Circles
          </TabsTrigger>
          <TabsTrigger 
            value="about"
            className="rounded-none border-b-2 border-transparent px-4 md:px-6 py-3 font-medium data-[state=active]:border-brand-orange data-[state=active]:text-black"
          >
            About
          </TabsTrigger>
        </TabsList>
      </div>
      
      <TabsContent value="recommendations" className="mt-6">
        <ProfileRecommendations />
      </TabsContent>
      
      <TabsContent value="circles" className="mt-6">
        <div className="p-4 text-center text-gray-500">
          Circles content will go here
        </div>
      </TabsContent>
      
      <TabsContent value="about" className="mt-6">
        <div className="p-4 text-center text-gray-500">
          About content will go here
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default ProfileTabs;
