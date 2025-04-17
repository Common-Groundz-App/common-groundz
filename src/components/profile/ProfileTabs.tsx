
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ProfilePosts from './ProfilePosts';
import ProfileRecommendations from './ProfileRecommendations';
import ProfileReviews from './ProfileReviews';
import ProfileCircles from './ProfileCircles';

interface ProfileTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOwnProfile: boolean;
  profileUserId: string;
  username: string;
}

const ProfileTabs = ({ 
  activeTab, 
  onTabChange, 
  isOwnProfile, 
  profileUserId,
  username
}: ProfileTabsProps) => {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="w-full max-w-2xl mx-auto grid grid-cols-4 mb-8">
        <TabsTrigger value="posts">Posts</TabsTrigger>
        <TabsTrigger value="recommendations">Recs</TabsTrigger>
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
        <TabsTrigger value="circles">Circles</TabsTrigger>
      </TabsList>
      
      <TabsContent value="posts">
        <ProfilePosts 
          profileUserId={profileUserId} 
          isOwnProfile={isOwnProfile} 
        />
      </TabsContent>
      
      <TabsContent value="recommendations">
        <ProfileRecommendations 
          profileUserId={profileUserId} 
          isOwnProfile={isOwnProfile}
        />
      </TabsContent>
      
      <TabsContent value="reviews">
        <ProfileReviews 
          profileUserId={profileUserId} 
          isOwnProfile={isOwnProfile}
        />
      </TabsContent>
      
      <TabsContent value="circles">
        <ProfileCircles 
          profileUserId={profileUserId} 
          isOwnProfile={isOwnProfile}
        />
      </TabsContent>
    </Tabs>
  );
};

export default ProfileTabs;
