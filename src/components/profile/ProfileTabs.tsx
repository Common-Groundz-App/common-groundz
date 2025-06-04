import { TubelightTabs, TabsContent } from '@/components/ui/tubelight-tabs';
import { MenuBar } from '@/components/ui/bottom-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { BookOpen, Star, Users, User } from 'lucide-react';
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
  const isMobile = useIsMobile();

  const tabItems = [
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

  // Mobile menu items with proper icon components
  const mobileMenuItems = [
    {
      value: "posts",
      label: "Posts",
      icon: (props: React.SVGProps<SVGSVGElement>) => <BookOpen {...props} />
    },
    {
      value: "recommendations", 
      label: "Recs",
      icon: (props: React.SVGProps<SVGSVGElement>) => <Star {...props} />
    },
    {
      value: "reviews",
      label: "Reviews", 
      icon: (props: React.SVGProps<SVGSVGElement>) => <Users {...props} />
    },
    {
      value: "circles",
      label: "Circles",
      icon: (props: React.SVGProps<SVGSVGElement>) => <User {...props} />
    }
  ];

  return (
    <div className="w-full">
      {isMobile ? (
        <div className="flex justify-center mb-6">
          <MenuBar 
            items={mobileMenuItems}
            activeValue={activeTab}
            onValueChange={onTabChange}
          />
        </div>
      ) : (
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
      )}

      {/* Tab content that works for both mobile and desktop */}
      {isMobile && (
        <div className="w-full">
          {activeTab === "posts" && (
            <ProfilePosts 
              profileUserId={profileUserId} 
              isOwnProfile={isOwnProfile} 
            />
          )}
          
          {activeTab === "recommendations" && (
            <ProfileRecommendations 
              profileUserId={profileUserId}
              isOwnProfile={isOwnProfile}
            />
          )}
          
          {activeTab === "reviews" && (
            <ProfileReviews 
              profileUserId={profileUserId} 
              isOwnProfile={isOwnProfile}
            />
          )}
          
          {activeTab === "circles" && (
            <ProfileCircles 
              profileUserId={profileUserId} 
              isOwnProfile={isOwnProfile}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileTabs;
