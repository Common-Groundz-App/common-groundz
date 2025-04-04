
import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ProfileRecommendations from './ProfileRecommendations';
import ProfileCircles from './ProfileCircles';
import ProfileAbout from './ProfileAbout';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileTabsProps {
  profileUserId: string;
  isOwnProfile: boolean;
}

const ProfileTabs = ({ profileUserId, isOwnProfile }: ProfileTabsProps) => {
  const isMobile = useIsMobile(768);
  const { user } = useAuth();
  
  return <Tabs defaultValue="recommendations" className={`w-full ${isMobile ? 'my-6' : 'my-[112px]'} px-0`}>
      <div className="bg-background pb-1 mb-2 border-b">
        <TabsList className="w-full rounded-none bg-transparent p-0 h-auto overflow-x-auto border-0">
          <TabsTrigger value="recommendations" className="rounded-none border-b-2 border-transparent px-4 md:px-6 py-3 font-medium data-[state=active]:border-brand-orange data-[state=active]:text-black">
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="circles" className="rounded-none border-b-2 border-transparent px-4 md:px-6 py-3 font-medium data-[state=active]:border-brand-orange data-[state=active]:text-black">
            Circles
          </TabsTrigger>
          <TabsTrigger value="about" className="rounded-none border-b-2 border-transparent px-4 md:px-6 py-3 font-medium data-[state=active]:border-brand-orange data-[state=active]:text-black">
            About
          </TabsTrigger>
        </TabsList>
      </div>
      
      <TabsContent value="recommendations" className="mt-4">
        <ProfileRecommendations profileUserId={profileUserId} />
      </TabsContent>
      
      <TabsContent value="circles" className="mt-4">
        <ProfileCircles profileUserId={profileUserId} isOwnProfile={isOwnProfile} />
      </TabsContent>
      
      <TabsContent value="about" className="mt-4">
        <ProfileAbout profileUserId={profileUserId} isOwnProfile={isOwnProfile} />
      </TabsContent>
    </Tabs>;
};

export default ProfileTabs;
