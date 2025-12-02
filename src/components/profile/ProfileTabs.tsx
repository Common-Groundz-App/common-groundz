
import { TubelightTabs, TabsContent } from '@/components/ui/tubelight-tabs';
import { BookOpen, Star, Users, User, Package } from 'lucide-react';
import ProfilePosts from './ProfilePosts';
import ProfileRecommendations from './ProfileRecommendations';
import ProfileReviews from './ProfileReviews';
import ProfileCircles from './ProfileCircles';
import ProfileStuff from './ProfileStuff';

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
  // Base tabs that always show
  const baseTabs = [
    {
      value: "posts",
      label: "Posts",
      icon: BookOpen
    },
    {
      value: "recommendations",
      label: "Recs",
      icon: Star
    },
    {
      value: "reviews",
      label: "Reviews",
      icon: Users
    },
    {
      value: "circles",
      label: "Circles",
      icon: User
    }
  ];

  // Add "Stuff" tab only for other users' profiles (not own profile)
  const tabItems = !isOwnProfile 
    ? [...baseTabs, { value: "stuff", label: "Stuff", icon: Package }]
    : baseTabs;

  return (
    <TubelightTabs 
      defaultValue={activeTab} 
      onValueChange={onTabChange}
      items={tabItems}
      className="w-full"
    >
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

      {/* Stuff tab - only shown for other users' profiles */}
      {!isOwnProfile && (
        <TabsContent value="stuff">
          <ProfileStuff 
            profileUserId={profileUserId}
            isOwnProfile={isOwnProfile}
          />
        </TabsContent>
      )}
    </TubelightTabs>
  );
};

export default ProfileTabs;
