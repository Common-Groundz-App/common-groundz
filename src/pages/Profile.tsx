
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProfileCard from '@/components/profile/ProfileCard';
import RecommendationsGrid from '@/components/profile/RecommendationsGrid';
import NavBarComponent from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';

const Profile = () => {
  const [activeTab, setActiveTab] = useState('recommendations');
  const { user } = useAuth();
  
  // Mock data - in a real app, this would come from your database
  const profile = {
    name: "Alex Johnson",
    bio: "Foodie, film buff, and tech enthusiast. Always looking for the next great recommendation!",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200&h=200",
    location: "San Francisco, CA",
    memberSince: "January 2023",
    stats: {
      groundzScoreAvg: 4.2,
      circleCertifiedRecs: 8,
      totalRecommendations: 24,
      inCircles: 15
    },
    social: {
      twitter: "alexj",
      instagram: "alex.johnson",
      linkedin: "alexjohnson"
    }
  };
  
  // In a real app, this would be determined by comparing the logged in user with the profile being viewed
  const isOwnProfile = true;
  
  return (
    <div className="min-h-screen bg-background">
      <NavBarComponent />
      
      <main className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left side - Profile card */}
          <div className="w-full lg:w-1/3">
            <ProfileCard profile={profile} isOwnProfile={isOwnProfile} />
          </div>
          
          {/* Right side - Content area */}
          <div className="w-full lg:w-2/3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-3 mb-8">
                <TabsTrigger 
                  value="recommendations" 
                  className="data-[state=active]:bg-brand-orange data-[state=active]:text-white"
                >
                  Recommendations
                </TabsTrigger>
                <TabsTrigger 
                  value="logs" 
                  className="data-[state=active]:bg-brand-orange data-[state=active]:text-white"
                >
                  Logs/Updates
                </TabsTrigger>
                <TabsTrigger 
                  value="liked" 
                  className="data-[state=active]:bg-brand-orange data-[state=active]:text-white"
                >
                  Liked Items
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="recommendations">
                <RecommendationsGrid isOwnProfile={isOwnProfile} />
              </TabsContent>
              
              <TabsContent value="logs">
                <div className="text-center py-16">
                  <h3 className="text-xl font-medium text-muted-foreground">Coming soon!</h3>
                  <p className="mt-2">Activity logs and updates will be available in a future update.</p>
                </div>
              </TabsContent>
              
              <TabsContent value="liked">
                <div className="text-center py-16">
                  <h3 className="text-xl font-medium text-muted-foreground">Coming soon!</h3>
                  <p className="mt-2">Liked items will be available in a future update.</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Profile;
