
import { TubelightTabs, TabsContent } from '@/components/ui/tubelight-tabs';
import { FileText, ThumbsUp, MessageSquare, Users } from 'lucide-react';
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
  const tabItems = [
    {
      value: "posts",
      label: "Posts",
      icon: FileText
    },
    {
      value: "recommendations",
      label: "Recs",
      icon: ThumbsUp
    },
    {
      value: "reviews",
      label: "Reviews",
      icon: MessageSquare
    },
    {
      value: "circles",
      label: "Circles",
      icon: Users
    }
  ];

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
    </TubelightTabs>
  );
};

export default ProfileTabs;
