
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import NavBarComponent from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileSidebar from '@/components/profile/ProfileSidebar';
import ProfileContent from '@/components/profile/ProfileContent';

const Profile = () => {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      
      {/* Hero banner with gradient */}
      <div className="w-full h-64 bg-gradient-to-r from-brand-blue/30 via-brand-teal/20 to-brand-orange/20"></div>
      
      <div className="container mx-auto px-4 -mt-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Sidebar */}
          <div className="md:col-span-1">
            <ProfileSidebar 
              name="Alex Johnson"
              title="Food & Travel Enthusiast"
              bio="Sharing my favorite discoveries from around the world."
              location="San Francisco, CA"
              memberSince="Jan 2023"
              followers={105}
              stats={{
                groundzScore: 4.8,
                circleCertified: 24,
                totalRecommendations: 36,
                inCircles: 8
              }}
            />
          </div>
          
          {/* Profile Content */}
          <div className="md:col-span-2">
            <ProfileContent />
          </div>
        </div>
      </div>
      
      <div className="flex-grow"></div>
      <Footer />
    </div>
  );
};

export default Profile;
