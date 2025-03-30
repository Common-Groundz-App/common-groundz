
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
      
      {/* Hero banner with gradient and image */}
      <div className="w-full h-64 bg-gradient-to-r from-brand-blue/90 via-brand-teal/80 to-brand-orange/70 relative overflow-hidden">
        <img 
          src="/lovable-uploads/87c43c69-609c-4783-9425-7a25bb42926e.png" 
          alt="Cover" 
          className="w-full h-full object-cover opacity-30 absolute inset-0 mix-blend-overlay"
        />
      </div>
      
      <div className="container mx-auto px-4 -mt-32 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Profile Sidebar */}
          <div className="md:col-span-4">
            <ProfileSidebar 
              name="Alex Johnson"
              title="Food & Travel Enthusiast"
              bio="Sharing my favorite discoveries from around the world. Always looking for new experiences and hidden gems."
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
          <div className="md:col-span-8">
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
