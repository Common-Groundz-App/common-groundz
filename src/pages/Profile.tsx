
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import NavBarComponent from '@/components/NavBarComponent';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileContent from '@/components/profile/ProfileContent';
import Footer from '@/components/Footer';

const Profile = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <NavBarComponent />
      
      {/* Main content with proper spacing */}
      <main className="w-full">
        {/* Profile header with cover image and user info */}
        <ProfileHeader user={user} />
        
        {/* Profile content with tabs and reviews */}
        <div className="container mx-auto px-4 -mt-6">
          <ProfileContent user={user} />
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Profile;
