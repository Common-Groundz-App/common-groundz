
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import NavBarComponent from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import ProfileContent from '@/components/profile/ProfileContent';
import ProfileSidebar from '@/components/profile/ProfileSidebar';

const Profile = () => {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      
      {/* Hero banner with gradient */}
      <div className="w-full h-64 bg-gradient-to-r from-brand-blue/90 via-brand-teal/80 to-brand-orange/70 relative overflow-hidden">
        <img 
          src="/lovable-uploads/d2dd59cc-afbe-4df1-9fd7-ed038c630c79.png" 
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
